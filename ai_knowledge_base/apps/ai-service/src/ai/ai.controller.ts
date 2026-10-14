/**
 * AI 服务对外 HTTP 接口（供 server 端内部调用，须携带 X-Internal-Token）：
 * - POST /ai/index-document：文档抽取文本 → 切片 → 向量化入库
 * - POST /ai/ask：一次性问答（JSON 返回，旧链路保留）
 * - POST /ai/ask/stream：SSE 流式问答（sources / token / done / error 事件）
 * - DELETE /ai/document/:id：删除某文档的全部分块
 */
import { BadGatewayException, Body, Controller, Delete, Logger, Param, ParseIntPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AskService, type AskResult } from './ask.service.js';
import type { RetrieveDebugView } from '@ai-knowledge-base/shared';
import { DocumentIndexService, type IndexDocumentResult } from './document-index.service.js';
import { AskDto, IndexDocumentDto, InvalidateCacheDto, RetrieveDebugDto, TestConnectionDto } from './dto/ai.dto.js';
import { InternalTokenGuard } from '../auth/internal-token.guard.js';
import { ModelProvider } from './openai-model.provider.js';
import { UserSettingsService } from '../settings/user-settings.service.js';
import { UsageEvent } from '../entities/usage-event.entity.js';
import { modelCostUsd } from './usage-pricing.js';

@Controller('ai')
@UseGuards(InternalTokenGuard)
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private readonly documentIndexService: DocumentIndexService,
    private readonly askService: AskService,
    private readonly models: ModelProvider,
    private readonly userSettings: UserSettingsService,
    @InjectRepository(UsageEvent) private readonly usageEvents: Repository<UsageEvent>,
  ) {}

  /** 对话/向量模型配置测试：实际发起小请求，用量计入看板但不保存配置。 */
  @Post('test-connection')
  async testConnection(@Body() dto: TestConnectionDto): Promise<{ message: string }> {
    const settings = await this.userSettings.getEffectiveSettings(dto.userId);
    const startedAt = Date.now();
    let provider: string;
    let model: string;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    if (dto.kind === 'chat') {
      const chatProvider = dto.chatProvider ?? settings.chatProvider;
      const saved = chatProvider === 'anthropic' ? settings.anthropic : settings.openai;
      const input = chatProvider === 'anthropic' ? dto.anthropic : dto.openai;
      const config = {
        baseUrl: input?.baseUrl?.trim() || saved.baseUrl,
        apiKey: input?.apiKey?.trim() || saved.apiKey,
        chatModel: input?.model?.trim() || saved.chatModel,
      };
      let result: Awaited<ReturnType<ModelProvider['testChat']>>;
      try {
        result = await this.models.testChat(chatProvider, config, dto.temperature ?? settings.temperature);
      } catch (error) {
        throw this.connectionTestError(error, config.apiKey);
      }
      provider = chatProvider;
      model = config.chatModel;
      promptTokens = result.usage?.input_tokens;
      completionTokens = result.usage?.output_tokens;
    } else {
      const config = {
        baseUrl: dto.embedding?.baseUrl?.trim() || settings.embedding.baseUrl,
        apiKey: dto.embedding?.apiKey?.trim() || settings.embedding.apiKey,
        model: dto.embedding?.model?.trim() || settings.embedding.model,
      };
      let result: Awaited<ReturnType<ModelProvider['testEmbedding']>>;
      try {
        result = await this.models.testEmbedding(config);
      } catch (error) {
        throw this.connectionTestError(error, config.apiKey);
      }
      provider = 'openai-compatible';
      model = config.model;
      promptTokens = result.promptTokens;
    }

    try {
      await this.usageEvents.save(this.usageEvents.create({
        userId: dto.userId,
        conversationId: null,
        messageId: null,
        provider,
        model,
        kind: 'connection_test',
        promptTokens: promptTokens ?? 0,
        completionTokens: completionTokens ?? 0,
        latencyMs: Date.now() - startedAt,
        cached: false,
        usageSource: promptTokens === undefined || (dto.kind === 'chat' && completionTokens === undefined) ? 'unavailable' : 'provider',
        costUsd: promptTokens === undefined || (dto.kind === 'chat' && completionTokens === undefined)
          ? null
          : modelCostUsd(model, promptTokens, completionTokens ?? 0),
      }));
    } catch (error) {
      this.logger.warn(`Failed to record connection test usage: ${String(error)}`);
    }
    return { message: '连接成功，配置有效' };
  }

  private connectionTestError(error: unknown, apiKey: string): BadGatewayException {
    const message = error instanceof Error ? error.message : '模型调用失败';
    return new BadGatewayException(apiKey ? message.replaceAll(apiKey, '[已隐藏]') : message);
  }

  @Post('index-document')
  async indexDocument(@Body() dto: IndexDocumentDto): Promise<IndexDocumentResult> {
    return this.documentIndexService.indexDocument(dto);
  }

  /** 文档删除后由 server 调用：同步清理该文件的全部分块，避免孤儿分块继续被检索命中 */
  @Delete('document/:uploadFileId')
  async deleteDocumentChunks(
    @Param('uploadFileId', ParseIntPipe) uploadFileId: number,
  ): Promise<{ uploadFileId: number; deleted: number }> {
    return this.documentIndexService.deleteChunksByUploadFileId(uploadFileId);
  }

  @Post('ask')
  async ask(@Body() dto: AskDto): Promise<AskResult> {
    return this.askService.ask(dto);
  }

  /** 文档索引完成/删除后由 server 调用：清空该用户语义缓存，避免命中过期答案 */
  @Post('cache/invalidate')
  async invalidateCache(@Body() dto: InvalidateCacheDto): Promise<{ deleted: number }> {
    return this.askService.invalidateCacheForUser(dto.userId);
  }

  /** 检索调试：只跑检索、不生成回答，返回完整检索链路（供 RAG 调试/评估面板使用） */
  @Post('retrieve/debug')
  async retrieveDebug(@Body() dto: RetrieveDebugDto): Promise<RetrieveDebugView> {
    return this.askService.debugRetrieve(dto.question, dto.userId, dto.config);
  }

  /**
   * 流式问答（SSE）。
   * 事件：sources（检索到的知识库片段）、token（回答增量）、done（最终结果）、error。
   */
  @Post('ask/stream')
  async askStream(
    @Body() dto: AskDto,
    @Req() req: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders?.();

    const sendEvent = (event: string, data: unknown): void => {
      response.write(`event: ${event}\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 客户端（server）断开时，中止正在进行的模型调用
    const abortController = new AbortController();
    const onAbort = () => abortController.abort();
    req.on('close', onAbort);

    try {
      const result = await this.askService.askStream(
        dto,
        {
          onSources: (sources) => sendEvent('sources', sources),
          onToken: (token) => sendEvent('token', token),
        },
        abortController.signal,
      );
      if (!response.writableEnded) {
        sendEvent('done', result);
        response.end();
      }
    } catch (error) {
      if (!abortController.signal.aborted && !response.writableEnded) {
        sendEvent('error', { message: error instanceof Error ? error.message : String(error) });
        response.end();
      }
    } finally {
      req.off('close', onAbort);
    }
  }
}
