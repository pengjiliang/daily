/**
 * 设置服务：读取/保存每个用户的 AI 设置。
 * GET：合并「用户行 + .env 默认值」返回回显视图（apiKey 只返回是否已配置）；
 * PUT：保存用户配置；若向量模型（baseUrl/model）发生变化，标记重建索引（pending）
 *      并在后台逐文件通知 ai-service 重索引，进度实时写回 reindexProgress 供前端轮询。
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AiSettingsView, ChatProvider, ReindexProgress, ReindexStatus } from '@ai-knowledge-base/shared';
import { UploadService } from '../upload/upload.service.js';
import { AiSettings } from './ai-settings.entity.js';
import { SaveSettingsDto } from './dto/save-settings.dto.js';

/** .env 层默认设置（与 ai-service 的 configuration.ts 保持一致） */
interface EnvDefaults {
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
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(AiSettings)
    private readonly settingsRepository: Repository<AiSettings>,
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
  ) {}

  /** GET：合并用户行与 .env 默认值，返回回显视图（不返回 apiKey 明文） */
  async getSettings(userId: number): Promise<AiSettingsView> {
    const row = await this.settingsRepository.findOneBy({ userId });
    return this.resolveView(row);
  }

  /**
   * PUT：保存用户设置。apiKey 传空/缺省表示不修改（保留已保存值）；
   * 向量模型（baseUrl 或 model）实际生效值变化时，自动触发全部文档重建索引。
   */
  async saveSettings(userId: number, dto: SaveSettingsDto): Promise<AiSettingsView> {
    let row = await this.settingsRepository.findOneBy({ userId });
    if (!row) {
      row = this.settingsRepository.create({ userId });
    }

    // 记录保存前的向量配置生效值，用于对比是否变化
    const env = this.envDefaults();
    const previousEmbeddingKey = `${row.embeddingBaseUrl ?? env.embedding.baseUrl}|${row.embeddingModel ?? env.embedding.model}`;

    if (dto.chatProvider !== undefined) {
      row.chatProvider = dto.chatProvider;
    }
    if (dto.temperature !== undefined) {
      row.temperature = dto.temperature;
    }
    if (dto.topK !== undefined) {
      row.topK = dto.topK;
    }
    if (dto.keywordTopK !== undefined) {
      row.keywordTopK = dto.keywordTopK;
    }
    if (dto.minScore !== undefined) {
      row.minScore = dto.minScore;
    }
    if (dto.rerankTopN !== undefined) {
      row.rerankTopN = dto.rerankTopN;
    }

    if (dto.openai) {
      if (dto.openai.baseUrl !== undefined) {
        row.openaiBaseUrl = dto.openai.baseUrl.trim() || null;
      }
      if (dto.openai.apiKey !== undefined && dto.openai.apiKey.trim()) {
        row.openaiApiKey = dto.openai.apiKey.trim();
      }
      if (dto.openai.model !== undefined) {
        row.openaiChatModel = dto.openai.model.trim() || null;
      }
    }
    if (dto.anthropic) {
      if (dto.anthropic.baseUrl !== undefined) {
        row.anthropicBaseUrl = dto.anthropic.baseUrl.trim() || null;
      }
      if (dto.anthropic.apiKey !== undefined && dto.anthropic.apiKey.trim()) {
        row.anthropicApiKey = dto.anthropic.apiKey.trim();
      }
      if (dto.anthropic.model !== undefined) {
        row.anthropicChatModel = dto.anthropic.model.trim() || null;
      }
    }
    if (dto.embedding) {
      if (dto.embedding.baseUrl !== undefined) {
        row.embeddingBaseUrl = dto.embedding.baseUrl.trim() || null;
      }
      if (dto.embedding.apiKey !== undefined && dto.embedding.apiKey.trim()) {
        row.embeddingApiKey = dto.embedding.apiKey.trim();
      }
      if (dto.embedding.model !== undefined) {
        row.embeddingModel = dto.embedding.model.trim() || null;
      }
    }

    await this.settingsRepository.save(row);

    const currentEmbeddingKey = `${row.embeddingBaseUrl ?? env.embedding.baseUrl}|${row.embeddingModel ?? env.embedding.model}`;
    if (previousEmbeddingKey !== currentEmbeddingKey) {
      await this.markReindexPending(userId);
      // 后台执行，不阻塞保存响应
      void this.runReindex(userId);
    }

    return this.resolveView(row);
  }

  /** 向量模型变化后：置待重建状态并清空进度 */
  private async markReindexPending(userId: number): Promise<void> {
    await this.settingsRepository.update(
      { userId },
      { reindexStatus: 'pending', reindexProgress: { total: 0, done: 0, failed: 0 } },
    );
  }

  /**
   * 后台重建索引：遍历用户全部文档，逐个请求 ai-service 以新向量模型重索引，
   * 每完成一个就更新一次进度；全部成功置 done，全部失败置 failed。
   */
  private async runReindex(userId: number): Promise<void> {
    try {
      const documents = await this.uploadService.listDocuments(userId);
      const total = documents.length;
      await this.settingsRepository.update(
        { userId },
        { reindexStatus: 'running', reindexProgress: { total, done: 0, failed: 0 } },
      );

      let done = 0;
      let failed = 0;
      for (const document of documents) {
        try {
          await this.uploadService.reindexDocument(document);
          done += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn(`Reindex document ${document.id} failed: ${String(error)}`);
        }
        const progress: ReindexProgress = { total, done, failed, currentFile: document.originalName };
        await this.settingsRepository.update({ userId }, { reindexProgress: progress });
      }

      const status: ReindexStatus = failed > 0 && done === 0 ? 'failed' : 'done';
      await this.settingsRepository.update(
        { userId },
        { reindexStatus: status, reindexProgress: { total, done, failed, currentFile: undefined } },
      );
    } catch (error) {
      this.logger.error(`Reindex job for user ${userId} failed: ${String(error)}`);
      await this.settingsRepository.update({ userId }, { reindexStatus: 'failed' });
    }
  }

  /** 把（可能的空）用户行 + .env 默认合并为回显视图 */
  private resolveView(row: AiSettings | null): AiSettingsView {
    const env = this.envDefaults();
    const openaiApiKey = row?.openaiApiKey ?? env.openai.apiKey ?? '';
    const anthropicApiKey = row?.anthropicApiKey ?? env.anthropic.apiKey ?? '';
    const embeddingApiKey = row?.embeddingApiKey ?? env.embedding.apiKey ?? '';

    return {
      chatProvider: (row?.chatProvider ?? env.chatProvider) as ChatProvider,
      openai: {
        baseUrl: row?.openaiBaseUrl ?? env.openai.baseUrl,
        model: row?.openaiChatModel ?? env.openai.chatModel,
        hasApiKey: Boolean(openaiApiKey),
      },
      anthropic: {
        baseUrl: row?.anthropicBaseUrl ?? env.anthropic.baseUrl,
        model: row?.anthropicChatModel ?? env.anthropic.chatModel,
        hasApiKey: Boolean(anthropicApiKey),
      },
      embedding: {
        baseUrl: row?.embeddingBaseUrl ?? env.embedding.baseUrl,
        model: row?.embeddingModel ?? env.embedding.model,
        hasApiKey: Boolean(embeddingApiKey),
      },
      temperature: row?.temperature ?? env.temperature,
      topK: row?.topK ?? env.topK,
      keywordTopK: row?.keywordTopK ?? env.keywordTopK,
      minScore: row?.minScore ?? env.minScore,
      rerankTopN: row?.rerankTopN ?? env.rerankTopN,
      reindex: {
        status: (row?.reindexStatus ?? 'idle') as ReindexStatus,
        progress: row?.reindexProgress ?? null,
      },
    };
  }

  /** server 侧 .env 默认设置（与 ai-service 保持一致，供回显与合并） */
  private envDefaults(): EnvDefaults {
    return {
      chatProvider: 'openai',
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
      temperature: this.configService.get<number>('ai.temperature', 0) ?? 0,
      topK: this.configService.get<number>('ai.topK', 8) ?? 8,
      keywordTopK: this.configService.get<number>('ai.keywordTopK', 8) ?? 8,
      minScore: this.configService.get<number>('ai.minScore', 0.3) ?? 0.3,
      rerankTopN: this.configService.get<number>('ai.rerankTopN', 5) ?? 5,
    };
  }
}
