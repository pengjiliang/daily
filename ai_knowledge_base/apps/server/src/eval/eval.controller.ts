/**
 * 评估控制器（亮点 3：RAG 评估与回归看板）：
 * 评估集/用例 CRUD、运行评估、历史运行与明细查询。全部需登录（类级 JWT 守卫）。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { EvalRun as EvalRunRecord, EvalSet, EvalCase as EvalCaseView } from '@ai-knowledge-base/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { EvalService } from './eval.service.js';
import { EvalCompareDto } from './dto/eval-compare.dto.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('eval')
@UseGuards(JwtAuthGuard)
export class EvalController {
  constructor(private readonly evalService: EvalService) {}

  /** GET /eval/sets：当前用户的评估集列表 */
  @Get('sets')
  listSets(@Req() request: AuthenticatedRequest) {
    return this.evalService.listSets(request.user.userId);
  }

  /** POST /eval/sets：新建评估集 */
  @Post('sets')
  createSet(@Req() request: AuthenticatedRequest, @Body() body: { name?: string; description?: string }) {
    return this.evalService.createSet(request.user.userId, body.name ?? '', body.description);
  }

  /** GET /eval/sets/:id：评估集详情（含用例） */
  @Get('sets/:id')
  getSet(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.evalService.getSet(request.user.userId, id);
  }

  /** DELETE /eval/sets/:id：删除评估集（级联删用例与运行） */
  @Delete('sets/:id')
  async deleteSet(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.evalService.deleteSet(request.user.userId, id);
    return { deleted: true };
  }

  /** POST /eval/sets/:id/cases：往评估集添加用例 */
  @Post('sets/:id/cases')
  addCase(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { question?: string; expectedFileId?: number | null; expectedKeywords?: string[]; note?: string },
  ): Promise<EvalCaseView> {
    return this.evalService.addCase(request.user.userId, id, body);
  }

  /** PATCH /eval/cases/:id：编辑用例 */
  @Patch('cases/:id')
  updateCase(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { question?: string; expectedFileId?: number | null; expectedKeywords?: string[]; note?: string },
  ): Promise<EvalCaseView> {
    return this.evalService.updateCase(request.user.userId, id, body);
  }

  /** DELETE /eval/cases/:id：删除用例 */
  @Delete('cases/:id')
  async deleteCase(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.evalService.deleteCase(request.user.userId, id);
    return { deleted: true };
  }

  /** POST /eval/sets/:id/run：运行一次评估（逐题调 ai-service 检索，计算指标） */
  @Post('sets/:id/run')
  runEval(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.evalService.runEval(request.user.userId, id);
  }

  /** POST /eval/sets/:id/compare：同一评估集依次运行两套参数并返回 A/B 结果。 */
  @Post('sets/:id/compare')
  compareEval(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EvalCompareDto,
  ) {
    return this.evalService.compareEval(request.user.userId, id, body.a, body.b);
  }

  /** GET /eval/runs?setId=：某评估集的历史运行列表 */
  @Get('runs')
  listRuns(
    @Req() request: AuthenticatedRequest,
    @Query('setId', ParseIntPipe) setId: number,
  ): Promise<EvalRunRecord[]> {
    return this.evalService.listRuns(request.user.userId, setId);
  }

  /** GET /eval/runs/:id：运行明细（指标 + 逐题结果） */
  @Get('runs/:id')
  getRun(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.evalService.getRun(request.user.userId, id);
  }
}
