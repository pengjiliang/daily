import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AiConfig } from '../../entities/ai-config.entity'

export interface AiConfigDto {
  name: string; type: string; baseURL: string; apiKey: string;
  model: string; systemPrompt?: string; isDefault?: boolean
}

@Injectable()
export class AiConfigService {
  constructor(@InjectRepository(AiConfig) private repo: Repository<AiConfig>) {}

  // 首次访问时，若尚无任何配置，则以根目录 .env 生成一条默认配置
  private async ensureDefault() {
    const count = await this.repo.count()
    if (count === 0) {
      await this.repo.save({
        name: '根目录 .env 默认配置',
        type: 'OpenAI 兼容',
        baseURL: process.env.AI_BASE_URL || '',
        apiKey: process.env.AI_API_KEY || '',
        model: process.env.AI_MODEL || '',
        systemPrompt: process.env.AI_SYSTEM_PROMPT || '你是扬良贸易有限公司的AI智能客服。',
        isDefault: true
      })
    }
  }

  async list() {
    await this.ensureDefault()
    return this.repo.find({ order: { id: 'ASC' } })
  }

  // 当前生效配置（后台切换的默认配置，无则回退 .env）
  async getActive() {
    await this.ensureDefault()
    const list = await this.repo.find({ order: { id: 'ASC' } })
    return list.find((c) => c.isDefault) || list[0] || null
  }

  async create(dto: AiConfigDto) {
    await this.ensureDefault()
    const item = await this.repo.save({
      name: dto.name,
      type: dto.type,
      baseURL: dto.baseURL,
      apiKey: dto.apiKey,
      model: dto.model,
      systemPrompt: dto.systemPrompt || '',
      isDefault: dto.isDefault === true
    })
    if (item.isDefault) await this.clearOthers(item.id)
    return item
  }

  async update(id: number, dto: Partial<AiConfigDto>) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundException('配置不存在')
    Object.assign(item, dto)
    if (dto.isDefault === true) await this.clearOthers(id)
    return this.repo.save(item)
  }

  async remove(id: number) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundException('配置不存在')
    await this.repo.remove(item)
    const rest = await this.repo.find({ order: { id: 'ASC' } })
    if (item.isDefault && rest.length) {
      rest[0].isDefault = true
      await this.repo.save(rest[0])
    }
    return { success: true }
  }

  async setDefault(id: number) {
    const item = await this.repo.findOne({ where: { id } })
    if (!item) throw new NotFoundException('配置不存在')
    await this.clearOthers(id)
    item.isDefault = true
    return this.repo.save(item)
  }

  private async clearOthers(exceptId: number) {
    const list = await this.repo.find()
    for (const c of list) {
      if (c.id !== exceptId && c.isDefault) {
        c.isDefault = false
        await this.repo.save(c)
      }
    }
  }
}
