import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { ChatService } from './chat.service.js';
import { Conversation } from './conversation.entity.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { Message } from './message.entity.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  createConversation(@Req() request: AuthenticatedRequest): Promise<Conversation> {
    return this.chatService.createConversation(request.user.userId);
  }

  @Get('conversations')
  listConversations(@Req() request: AuthenticatedRequest): Promise<Conversation[]> {
    return this.chatService.listConversations(request.user.userId);
  }

  @Delete('conversations/:id')
  async deleteConversation(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.chatService.removeConversation(id, request.user.userId);
    return { deleted: true };
  }

  @Get('conversations/:id/messages')
  listMessages(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number): Promise<Message[]> {
    return this.chatService.listMessages(id, request.user.userId);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Res() response: Response,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMessageDto,
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

    // 浏览器断开时通知服务中止上游请求
    const abortController = new AbortController();
    const onAbort = () => abortController.abort();
    req.on('close', onAbort);

    try {
      const result = await this.chatService.sendMessageStream(
        id,
        req.user.userId,
        dto.content,
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
      if (!response.headersSent) {
        // 会话不存在/无权限等错误：尚未发送流头，按普通 HTTP 错误抛出
        throw error;
      }
      if (!abortController.signal.aborted && !response.writableEnded) {
        sendEvent('error', { message: error instanceof Error ? error.message : String(error) });
        response.end();
      }
    } finally {
      req.off('close', onAbort);
    }
  }
}
