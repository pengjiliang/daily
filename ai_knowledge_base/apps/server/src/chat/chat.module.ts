/**
 * 聊天模块：会话与消息的增删查，以及问答消息的流式转发。
 * 注册 Conversation/Message 两个实体；ChatService 内部以 fetch 调用 ai-service。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { Conversation } from './conversation.entity.js';
import { Message } from './message.entity.js';
import { EvalModule } from '../eval/eval.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message]), EvalModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
