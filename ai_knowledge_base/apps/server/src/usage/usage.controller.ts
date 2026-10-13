/**
 * 用量控制器（亮点 5：成本与用量看板）。
 * GET /usage?from=&to=：当前用户时间范围内的用量聚合。需登录。
 */
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { UsageDashboard } from '@ai-knowledge-base/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { UsageService } from './usage.service.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  getDashboard(
    @Req() request: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<UsageDashboard> {
    return this.usageService.getDashboard(request.user.userId, from, to);
  }
}
