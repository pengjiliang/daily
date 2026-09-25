/**
 * AI 服务对外 HTTP 接口（供 server 端内部调用，无用户级鉴权）：
 * - POST /ai/index-document：文档抽取文本 → 切片 → 向量化入库
 * - POST /ai/ask：一次性问答（JSON 返回，旧链路保留）
 * - POST /ai/ask/stream：SSE 流式问答（sources / token / done / error 事件）
 * - DELETE /ai/document/:id：删除某文档的全部分块
 */
import { Body, Controller, Delete, Param, ParseIntPipe, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AskService, type AskResult } from './ask.service.js';
import type { RetrieveDebugView } from '@ai-knowledge-base/shared';
import { DocumentIndexService, type IndexDocumentResult } from './document-index.service.js';
import { AskDto, IndexDocumentDto } from './dto/ai.dto.js';

@Controller('ai')
export class AIController {
  constructor(
    private readonly documentIndexService: DocumentIndexService,
    private readonly askService: AskService,
  ) {}

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

  /** 检索调试：只跑检索、不生成回答，返回完整检索链路（供 RAG 调试/评估面板使用） */
  @Post('retrieve/debug')
  async retrieveDebug(@Body() dto: AskDto): Promise<RetrieveDebugView> {
    return this.askService.debugRetrieve(dto.question, dto.userId);
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
