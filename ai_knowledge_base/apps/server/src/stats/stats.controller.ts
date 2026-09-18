/**
 * 统计控制器：GET /stats 返回使用统计，GET /stats/graph 返回知识图谱数据（均需登录）。
 */
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { GraphData, StatsPayload } from '@ai-knowledge-base/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { StatsService } from './stats.service.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** GET /stats：当前用户的知识库使用统计 */
  @Get()
  getStats(@Req() request: AuthenticatedRequest): Promise<StatsPayload> {
    return this.statsService.getStats(request.user.userId);
  }

  /** GET /stats/graph：当前用户的知识图谱（文档节点 + 相似度连线） */
  @Get('graph')
  getGraph(@Req() request: AuthenticatedRequest): Promise<GraphData> {
    return this.statsService.getGraph(request.user.userId);
  }
}