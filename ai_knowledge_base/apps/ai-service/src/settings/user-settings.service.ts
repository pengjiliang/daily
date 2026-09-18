/**
 * 用户设置服务（ai-service 侧）：读取 ai_settings 表并按需合并 .env 默认值，
 * 返回模型提供方实际使用的“生效配置”。
 * 每次读取都查库（开销极小），模型实例由 ModelProvider 按配置指纹缓存重建，
 * 因此用户在设置页改完配置后无需重启即可生效。
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ChatProvider } from '@ai-knowledge-base/shared';
import { AiSettings } from '../entities/ai-settings.entity.js';

/** 用户生效设置：字段为“用户行 ?? .env 默认”合并后的最终值 */
export interface EffectiveSettings {
  chatProvider: ChatProvider;
  openai: { baseUrl: string; apiKey: string; chatModel: string };
  anthropic: { baseUrl: string; apiKey: string; chatModel: string };
  embedding: { baseUrl: string; apiKey: string; model: string };
  temperature: number;
  topK: number;
  keywordTopK: number;
  minScore: number;
  rerankTopN: number;
}

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(AiSettings)
    private readonly settingsRepository: Repository<AiSettings>,
    private readonly configService: ConfigService,
  ) {}

  /** 读取某用户的生效配置（用户行字段为空时回退 .env 默认值） */
  async getEffectiveSettings(userId: number): Promise<EffectiveSettings> {
    const row = await this.settingsRepository.findOneBy({ userId });
    const env = this.envDefaults();
    return {
      chatProvider: (row?.chatProvider ?? env.chatProvider) as ChatProvider,
      openai: {
        baseUrl: row?.openaiBaseUrl ?? env.openai.baseUrl,
        apiKey: row?.openaiApiKey ?? env.openai.apiKey,
        chatModel: row?.openaiChatModel ?? env.openai.chatModel,
      },
      anthropic: {
        baseUrl: row?.anthropicBaseUrl ?? env.anthropic.baseUrl,
        apiKey: row?.anthropicApiKey ?? env.anthropic.apiKey,
        chatModel: row?.anthropicChatModel ?? env.anthropic.chatModel,
      },
      embedding: {
        baseUrl: row?.embeddingBaseUrl ?? env.embedding.baseUrl,
        apiKey: row?.embeddingApiKey ?? env.embedding.apiKey,
        model: row?.embeddingModel ?? env.embedding.model,
      },
      temperature: row?.temperature ?? env.ai.temperature,
      topK: row?.topK ?? env.ai.topK,
      keywordTopK: row?.keywordTopK ?? env.ai.keywordTopK,
      minScore: row?.minScore ?? env.ai.minScore,
      rerankTopN: row?.rerankTopN ?? env.ai.rerankTopN,
    };
  }

  /** .env 层默认设置（与 server 的 settings.service 保持一致） */
  private envDefaults() {
    return {
      chatProvider: 'openai' as ChatProvider,
      openai: {
        baseUrl: this.configService.get<string>('openai.baseUrl', '') ?? '',
        apiKey: this.configService.get<string>('openai.apiKey', '') ?? '',
        chatModel: this.configService.get<string>('openai.chatModel', 'gpt-4o-mini') ?? 'gpt-4o-mini',
      },
      anthropic: { baseUrl: '', apiKey: '', chatModel: '' },
      embedding: {
        baseUrl: this.configService.get<string>('openai.baseUrl', '') ?? '',
        apiKey: this.configService.get<string>('openai.apiKey', '') ?? '',
        model:
          this.configService.get<string>('openai.embeddingModel', 'text-embedding-ada-002') ??
          'text-embedding-ada-002',
      },
      ai: {
        temperature: this.configService.get<number>('ai.temperature', 0) ?? 0,
        topK: this.configService.get<number>('ai.topK', 8) ?? 8,
        keywordTopK: this.configService.get<number>('ai.keywordTopK', 8) ?? 8,
        minScore: this.configService.get<number>('ai.minScore', 0.3) ?? 0.3,
        rerankTopN: this.configService.get<number>('ai.rerankTopN', 5) ?? 5,
      },
    };
  }
}
