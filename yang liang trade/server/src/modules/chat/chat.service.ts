import { Injectable } from '@nestjs/common'
import { AiConfigService } from '../ai-config/ai-config.service'

@Injectable()
export class ChatService {
  constructor(private aiConfig: AiConfigService) {}

  // 当前生效的模型配置（后台切换的默认配置，无则回退 .env 默认）
  async getActiveConfig() {
    const cfg = await this.aiConfig.getActive()
    if (!cfg) return null
    return {
      baseURL: cfg.baseURL,
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemPrompt: cfg.systemPrompt
    }
  }
}
