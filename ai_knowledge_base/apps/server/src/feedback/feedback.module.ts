/**
 * 反馈看板模块（亮点 4：反馈驱动的自优化闭环）。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../chat/message.entity.js';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Message])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
