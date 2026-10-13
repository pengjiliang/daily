/**
 * 反馈看板控制器（亮点 4：反馈驱动的自优化闭环）。
 * GET /feedback/dashboard：当前用户的反馈聚合看板。需登录。
 */
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { FeedbackDashboard } from '@ai-knowledge-base/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { FeedbackService } from './feedback.service.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get('dashboard')
  getDashboard(@Req() request: AuthenticatedRequest): Promise<FeedbackDashboard> {
    return this.feedbackService.getDashboard(request.user.userId);
  }
}
