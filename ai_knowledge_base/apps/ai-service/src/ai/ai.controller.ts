import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AskService, type AskResult } from './ask.service.js';
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

  @Post('ask')
  async ask(@Body() dto: AskDto): Promise<AskResult> {
    return this.askService.ask(dto);
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
