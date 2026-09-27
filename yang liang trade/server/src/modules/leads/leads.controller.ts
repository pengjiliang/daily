import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'crypto'
import { Repository } from 'typeorm'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { Lead } from '../../entities/lead.entity'
import { Campaign } from '../../entities/campaign.entity'
import { GooglePlacesService, LeadData, ScrapeOptions } from './google-places.service'

type ScrapeStatus = 'pending' | 'running' | 'success' | 'failed'

interface ScrapeJob {
  id: string
  status: ScrapeStatus
  options: ScrapeOptions
  createdAt: string
  startedAt?: string
  finishedAt?: string
  mode?: string
  inserted?: number
  skipped?: number
  error?: string
}

const REGIONS = new Set(['se', 'sa', 'ca', 'na'])
const TYPES = new Set(['药店', '诊所', '医院', '医疗器械经销商', '医疗耗材商店'])
const MODES = new Set(['demo', 'osm', 'google', 'ypk'])

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  private readonly scrapeJobs = new Map<string, ScrapeJob>()
  private readonly scrapeQueue: string[] = []
  private scrapeRunning = false

  constructor(
    @InjectRepository(Lead) private leads: Repository<Lead>,
    @InjectRepository(Campaign) private campaigns: Repository<Campaign>,
    private google: GooglePlacesService
  ) {}

  @Post('scrape')
  startScrape(@Body() body: ScrapeOptions) {
    const job: ScrapeJob = {
      id: randomUUID(),
      status: 'pending',
      options: this.validateOptions(body),
      createdAt: new Date().toISOString()
    }
    this.scrapeJobs.set(job.id, job)
    this.scrapeQueue.push(job.id)
    this.runNextScrape()
    return this.jobView(job)
  }

  @Get('scrape/:id')
  getScrapeJob(@Param('id') id: string) {
    const job = this.scrapeJobs.get(id)
    if (!job) throw new NotFoundException('抓取任务不存在')
    return this.jobView(job)
  }

  @Get()
  async list(@Query('page') pageValue?: string, @Query('pageSize') pageSizeValue?: string) {
    const page = Math.max(1, Math.floor(Number(pageValue) || 1))
    const pageSize = Math.min(500, Math.max(1, Math.floor(Number(pageSizeValue) || 10)))
    const [items, total] = await this.leads.findAndCount({
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return { items, total, page, pageSize }
  }

  @Delete()
  async clear() {
    await this.leads.clear()
    return { success: true }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const item = await this.leads.findOne({ where: { id: Number(id) } })
    if (!item) return { error: '线索不存在' }
    await this.leads.remove(item)
    return { success: true }
  }

  @Get('campaigns')
  listCampaigns() {
    return this.campaigns.find({ order: { id: 'DESC' } })
  }

  @Post('campaigns')
  createCampaign(@Body() body: { channel: string; count: number; status?: string; note?: string; detail?: string }) {
    return this.campaigns.save({
      channel: body.channel,
      count: Number(body.count) || 0,
      status: body.status || '已发送',
      note: body.note || '',
      detail: body.detail || ''
    })
  }

  private validateOptions(body: ScrapeOptions): ScrapeOptions {
    const regions = Array.isArray(body?.regions)
      ? [...new Set(body.regions.filter((r) => REGIONS.has(r)))]
      : []
    if (!regions.length) throw new BadRequestException('请选择有效的目标区域')

    const types = Array.isArray(body?.types)
      ? [...new Set(body.types.filter((t) => TYPES.has(t)))]
      : []
    if (!types.length) throw new BadRequestException('请选择有效的目标类型')

    const mode = (body?.mode || 'demo') as ScrapeOptions['mode']
    if (!MODES.has(mode!)) throw new BadRequestException('数据源不正确')

    return {
      keyword: String(body?.keyword || '').trim().slice(0, 100),
      regions,
      types,
      mode,
      limit: Math.min(100, Math.max(1, Number(body?.limit) || 100))
    }
  }

  private runNextScrape() {
    if (this.scrapeRunning) return
    const id = this.scrapeQueue.shift()
    if (!id) return
    const job = this.scrapeJobs.get(id)
    if (!job) return this.runNextScrape()

    this.scrapeRunning = true
    job.status = 'running'
    job.startedAt = new Date().toISOString()
    void this.executeScrape(job).finally(() => {
      this.scrapeRunning = false
      this.runNextScrape()
    })
  }

  private async executeScrape(job: ScrapeJob) {
    try {
      const result = await this.google.scrape(job.options)
      const saved = await this.saveUnique(result.leads)
      job.status = 'success'
      job.mode = result.mode
      job.inserted = saved.length
      job.skipped = result.leads.length - saved.length
    } catch (e) {
      job.status = 'failed'
      job.error = (e as Error).message || '抓取失败，请稍后重试'
    } finally {
      job.finishedAt = new Date().toISOString()
    }
  }

  private async saveUnique(leads: LeadData[]) {
    const existing = await this.leads.find()
    const keys = new Set<string>()
    for (const lead of existing) {
      for (const key of this.leadKeys(lead)) keys.add(key)
    }

    const fresh: Lead[] = []
    for (const lead of leads) {
      const leadKeys = this.leadKeys(lead)
      if (!leadKeys.length || leadKeys.some((key) => keys.has(key))) continue
      for (const key of leadKeys) keys.add(key)
      fresh.push(lead as Lead)
    }

    return fresh.length ? this.leads.save(fresh) : []
  }

  private leadKeys(lead: Partial<LeadData>) {
    const keys: string[] = []
    const phone = String(lead.phone || '').replace(/\D/g, '')
    if (phone.length >= 7) keys.push(`phone:${phone}`)

    const email = String(lead.email || '').trim().toLowerCase()
    if (email) keys.push(`email:${email}`)

    const website = String(lead.website || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
    if (website) keys.push(`website:${website}`)

    const name = String(lead.name || '').trim().toLowerCase()
    const city = String(lead.city || '').trim().toLowerCase()
    const address = String(lead.address || '').trim().toLowerCase()
    if (name) keys.push(`name:${name}|${city}|${address}`)

    return keys
  }

  private jobView(job: ScrapeJob) {
    const { options, ...view } = job
    return view
  }
}