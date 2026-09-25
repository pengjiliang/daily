import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { Lead } from '../../entities/lead.entity'
import { Campaign } from '../../entities/campaign.entity'
import { GooglePlacesService, LeadData, ScrapeOptions } from './google-places.service'

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(
    @InjectRepository(Lead) private leads: Repository<Lead>,
    @InjectRepository(Campaign) private campaigns: Repository<Campaign>,
    private google: GooglePlacesService
  ) {}

  @Post('scrape')
  async scrape(@Body() body: ScrapeOptions) {
    let mode: string
    let leads: LeadData[]
    try {
      const r = await this.google.scrape(body)
      mode = r.mode
      leads = r.leads
    } catch (e) {
      throw new BadRequestException((e as Error).message || '抓取失败，请稍后重试')
    }
    const saved = await this.leads.save(leads as Lead[])
    return { mode, count: saved.length, leads: saved }
  }

  @Get()
  list() {
    return this.leads.find({ order: { id: 'DESC' } })
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
}
