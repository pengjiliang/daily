/**
 * 聊天控制器：会话管理（增/删/列表）、消息历史查询，以及问答消息发送。
 * 发送消息为 SSE 流式接口：先写 text/event-stream 响应头，
 * 再把 ai-service 的 sources/token 事件实时透传给前端，结束时发 done。
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { ChatService } from './chat.service.js';
import { Conversation } from './conversation.entity.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { Message } from './message.entity.js';

/** 带登录用户信息的请求类型（request.user 由 JWT 守卫注入） */
type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** POST /chat/conversations：为当前用户新建会话 */
  @Post('conversations')
  createConversation(@Req() request: AuthenticatedRequest): Promise<Conversation> {
    return this.chatService.createConversation(request.user.userId);
  }

  /** GET /chat/conversations：当前用户的会话列表（按更新时间倒序） */
  @Get('conversations')
  listConversations(@Req() request: AuthenticatedRequest): Promise<Conversation[]> {
    return this.chatService.listConversations(request.user.userId);
  }

  /** DELETE /chat/conversations/:id：删除自己的会话（级联删消息） */
  @Delete('conversations/:id')
  async deleteConversation(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.chatService.removeConversation(id, request.user.userId);
    return { deleted: true };
  }

  /** PATCH /chat/conversations/:id：手动重命名自己的会话标题 */
  @Patch('conversations/:id')
  async renameConversation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string },
  ) {
    if (!body.title?.trim()) {
      throw new BadRequestException('会话标题不能为空');
    }
    return this.chatService.renameConversation(id, request.user.userId, body.title);
  }

  /** GET /chat/conversations/:id/messages：查询某会话全部消息（按时间正序） */
  @Get('conversations/:id/messages')
  listMessages(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number): Promise<Message[]> {
    return this.chatService.listMessages(id, request.user.userId);
  }

  /** PATCH /chat/messages/:id/feedback：设置消息反馈（like/dislike，null 取消），校验消息归属 */
  @Patch('messages/:id/feedback')
  async setMessageFeedback(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { feedback?: 'like' | 'dislike' | null },
  ): Promise<Message> {
    const feedback = body.feedback ?? null;
    if (feedback !== null && feedback !== 'like' && feedback !== 'dislike') {
      throw new BadRequestException('无效的反馈类型');
    }
    return this.chatService.setMessageFeedback(id, request.user.userId, feedback);
  }

  /**
   * POST /chat/conversations/:id/messages：发送消息，SSE 流式返回。
   * 事件协议：sources（来源列表）→ token（逐段答案，多次）→ done（最终结果）；异常发 error。
   */
  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Res() response: Response,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMessageDto,
  ): Promise<void> {
    // SSE 响应头：no-transform/X-Accel-Buffering 防止中间代理缓冲导致流式失效
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
