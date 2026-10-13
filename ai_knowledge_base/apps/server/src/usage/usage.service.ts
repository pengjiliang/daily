/**
 * 用量服务（亮点 5：成本与用量看板）。
 * 聚合 ai_usage_events 表（ai-service 在问答链路各模型调用点写入）：
 * 总览 token/调用数/缓存命中率、按天趋势、按类型（kind）排行、按模型排行。
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UsageDashboard, UsageDailyPoint } from '@ai-knowledge-base/shared';
import { UsageEvent } from './usage-event.entity.js';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @InjectRepository(UsageEvent)
    private readonly usageRepository: Repository<UsageEvent>,
  ) {}

  /** 成本与用量看板聚合（按用户隔离） */
  async getDashboard(userId: number, from?: string, to?: string): Promise<UsageDashboard> {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();

    // ① 总览：token 与调用数、缓存命中数
    const totalRow = (
      await this.usageRepository.query(
        `SELECT
           COALESCE(SUM("promptTokens"), 0)::int AS "promptTokens",
           COALESCE(SUM("completionTokens"), 0)::int AS "completionTokens",
           COUNT(*)::int AS calls,
           COALESCE(SUM(("cached")::int), 0)::int AS "cacheHits"
         FROM ai_usage_events
        WHERE "userId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3`,
        [userId, fromDate, toDate],
      )
    )[0] as { promptTokens: number; completionTokens: number; calls: number; cacheHits: number };

    const calls = totalRow.calls;
    const cacheHitRate = calls > 0 ? Math.round((totalRow.cacheHits / calls) * 1000) / 1000 : 0;

    // ② 按天趋势
    const dailyRows = (await this.usageRepository.query(
      `SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS date,
              COALESCE(SUM("promptTokens"), 0)::int AS "promptTokens",
              COALESCE(SUM("completionTokens"), 0)::int AS "completionTokens",
              COUNT(*)::int AS calls
         FROM ai_usage_events
        WHERE "userId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
        GROUP BY 1
        ORDER BY 1`,
      [userId, fromDate, toDate],
    )) as UsageDailyPoint[];

    // ③ 按类型（kind）聚合：直接暴露"哪一步最烧钱"
    const byKind = (await this.usageRepository.query(
      `SELECT kind, COUNT(*)::int AS calls,
              COALESCE(SUM("promptTokens"), 0)::int AS "promptTokens",
              COALESCE(SUM("completionTokens"), 0)::int AS "completionTokens"
         FROM ai_usage_events
        WHERE "userId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
        GROUP BY kind
        ORDER BY calls DESC`,
      [userId, fromDate, toDate],
    )) as { kind: string; calls: number; promptTokens: number; completionTokens: number }[];

    // ④ 按模型聚合
    const byModel = (await this.usageRepository.query(
      `SELECT model, COUNT(*)::int AS calls,
              COALESCE(SUM("promptTokens"), 0)::int AS "promptTokens",
              COALESCE(SUM("completionTokens"), 0)::int AS "completionTokens"
         FROM ai_usage_events
        WHERE "userId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
        GROUP BY model
        ORDER BY calls DESC`,
      [userId, fromDate, toDate],
    )) as { model: string; calls: number; promptTokens: number; completionTokens: number }[];

    return {
      total: {
        promptTokens: totalRow.promptTokens,
        completionTokens: totalRow.completionTokens,
        calls,
        cacheHits: totalRow.cacheHits,
      },
      cacheHitRate,
      daily: dailyRows,
      byKind,
      byModel,
    };
  }
}
