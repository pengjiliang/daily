/**
 * 用户设置服务（ai-service 侧）：读取 ai_settings 表并按需合并 .env 默认值，
 * 返回模型提供方实际使用的“生效配置”。
 * 每次读取都查库（开销极小），模型实例由 ModelProvider 按配置指纹缓存重建，
 * 因此用户在设置页改完配置后无需重启即可生效。
 *
 * schema 归属：ai_settings 表由 server 端实体单独管理（synchronize），
 * 本服务只读（原生 SQL + 手动解密），不注册实体、不参与建表，
 * 避免两服务重复维护同一实体的定义冲突。
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { ChatProvider } from '@ai-knowledge-base/shared';
import { decryptSecret } from './secret-crypto.js';

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
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
}

@Injectable()
export class UserSettingsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /** 读取某用户的生效配置（用户行字段为空时回退 .env 默认值） */
  async getEffectiveSettings(userId: number): Promise<EffectiveSettings> {
    const rows = (await this.dataSource.query(
      'SELECT * FROM ai_settings WHERE "userId" = $1 LIMIT 1',
      [userId],
    )) as Array<Record<string, string | number | boolean | null>>;
    const raw = rows[0] ?? null;
    const row = raw ? decryptSettingsRow(raw) : null;
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
      dailyTokenLimit: row?.dailyTokenLimit ?? 0,
      monthlyTokenLimit: row?.monthlyTokenLimit ?? 0,
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

/** 原生 SQL 读出的 ai_settings 行（字段与 server 端 AiSettings 实体一一对应） */
interface SettingsRow {
  chatProvider: string | null;
  openaiBaseUrl: string | null;
  openaiApiKey: string | null;
  openaiChatModel: string | null;
  anthropicBaseUrl: string | null;
  anthropicApiKey: string | null;
  anthropicChatModel: string | null;
  embeddingBaseUrl: string | null;
  embeddingApiKey: string | null;
  embeddingModel: string | null;
  temperature: number | null;
  topK: number | null;
  keywordTopK: number | null;
  minScore: number | null;
  rerankTopN: number | null;
  dailyTokenLimit: number | null;
  monthlyTokenLimit: number | null;
}

/** 解密行内三个 API Key 密文列，返回类型化设置行 */
function decryptSettingsRow(row: Record<string, string | number | boolean | null>): SettingsRow {
  const casted = row as unknown as SettingsRow;
  return {
    ...casted,
    openaiApiKey: decryptSecret(casted.openaiApiKey),
    anthropicApiKey: decryptSecret(casted.anthropicApiKey),
    embeddingApiKey: decryptSecret(casted.embeddingApiKey),
  };
}
