import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
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
  sendMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chatService.sendMessage(id, request.user.userId, dto.content);
  }
}
