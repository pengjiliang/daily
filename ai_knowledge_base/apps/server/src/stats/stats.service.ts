/**
 * 统计服务：聚合当前用户的知识库使用情况。
 * - getStats：KPI 总览（文档数/会话数/提问数/回答数/命中率）+ 近 14 天提问趋势 + 热门问题 Top10；
 * - getGraph：知识图谱数据——每个上传文档为节点（含分块数），按两两文档「分块平均向量的余弦相似度」
 *   连线，超过阈值才连线，权重为归一化相似度。
 */
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { GraphData, GraphEdge, GraphNode, StatsPayload, StatsPopularQuestion, StatsTrendPoint } from '@ai-knowledge-base/shared';

/** 知识图谱连线阈值：两文档平均向量余弦相似度达到该值才连线 */
const GRAPH_EDGE_THRESHOLD = 0.5;
/** 趋势窗口天数 */
const TREND_DAYS = 14;
/** 热门问题条数上限 */
const POPULAR_LIMIT = 10;
/** 参与图谱计算的文档数量上限（个人知识库远小于此，防极端数据拖垮接口） */
const GRAPH_DOC_LIMIT = 500;

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** 统计总览：文档/会话/提问/回答/命中知识库的回答数及命中率 */
  async getStats(userId: number): Promise<StatsPayload> {
    const documentCount = await this.scalar<number>(
      `SELECT COUNT(*)::int FROM upload_files WHERE "uploaderId" = $1`,
      [userId],
    );
    const conversationCount = await this.scalar<number>(
      `SELECT COUNT(*)::int FROM conversations WHERE "userId" = $1`,
      [userId],
    );

    const messageRow = (
      await this.dataSource.query(
        `SELECT
           COUNT(*) FILTER (WHERE m.role = 'user')::int AS "questionCount",
           COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS "answerCount",
           COUNT(*) FILTER (
             WHERE m.role = 'assistant' AND COALESCE(m.sources, '[]'::jsonb) @> '[{"sourceType":"knowledge_base"}]'
           )::int AS "kbHitCount"
         FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
        WHERE c."userId" = $1`,
        [userId],
      )
    )[0] as { questionCount: number; answerCount: number; kbHitCount: number };

    const answerCount = messageRow.answerCount;
    const hitRate = answerCount > 0 ? Math.round((messageRow.kbHitCount / answerCount) * 1000) / 1000 : 0;

    return {
      overview: {
        documentCount,
        conversationCount,
        questionCount: messageRow.questionCount,
        answerCount,
        kbHitCount: messageRow.kbHitCount,
        hitRate,
      },
      trend: await this.getTrend(userId),
      popularQuestions: await this.getPopularQuestions(userId),
    };
  }

  /** 近 N 天每日提问趋势（缺失的天补 0，保证前端折线连续） */
  private async getTrend(userId: number): Promise<StatsTrendPoint[]> {
    const rows = (await this.dataSource.query(
      `SELECT to_char(date_trunc('day', m."createdAt"), 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
        WHERE c."userId" = $1
          AND m.role = 'user'
          AND m."createdAt" >= NOW() - INTERVAL '${TREND_DAYS - 1} days'
        GROUP BY 1
        ORDER BY 1`,
      [userId],
    )) as { date: string; count: number }[];

    const countByDate = new Map(rows.map((row) => [row.date, row.count]));
    const trend: StatsTrendPoint[] = [];
    for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      trend.push({ date: key, count: countByDate.get(key) ?? 0 });
    }
    return trend;
  }

  /** 热门问题：按提问正文聚合出现次数，次数相同按最早提问时间排前 */
  private async getPopularQuestions(userId: number): Promise<StatsPopularQuestion[]> {
    return (await this.dataSource.query(
      `SELECT m.content AS content, COUNT(*)::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
        WHERE c."userId" = $1
          AND m.role = 'user'
          AND btrim(m.content) <> ''
        GROUP BY m.content
        ORDER BY count DESC, MIN(m.id) ASC
        LIMIT ${POPULAR_LIMIT}`,
      [userId],
    )) as StatsPopularQuestion[];
  }

  /** 知识图谱：文档节点 + 按平均向量相似度连线 */
  async getGraph(userId: number): Promise<GraphData> {
    const fileRows = (await this.dataSource.query(
      `SELECT f.id, f."originalName" AS name, f."createdAt" AS "createdAt", COUNT(c.id)::int AS "chunkCount"
         FROM upload_files f
         LEFT JOIN document_chunks c ON c."uploadFileId" = f.id
        WHERE f."uploaderId" = $1
        GROUP BY f.id, f."originalName", f."createdAt"
        ORDER BY f.id
        LIMIT ${GRAPH_DOC_LIMIT}`,
      [userId],
    )) as { id: number; name: string; createdAt: string; chunkCount: number }[];

    if (fileRows.length === 0) {
      return { nodes: [], edges: [] };
    }

    const meanRows = (await this.dataSource.query(
      `SELECT c."uploadFileId" AS id, AVG(c.embedding::vector) AS mean
         FROM document_chunks c
         JOIN upload_files f ON f.id = c."uploadFileId"
        WHERE f."uploaderId" = $1
        GROUP BY c."uploadFileId"`,
      [userId],
    )) as { id: number; mean: string }[];

    const meanMap = new Map<number, number[]>();
    for (const row of meanRows) {
      const parsed = parseVector(row.mean);
      if (parsed.length > 0) {
        meanMap.set(row.id, parsed);
      }
    }

    const nodes: GraphNode[] = fileRows.map((file) => ({
      id: file.id,
      name: file.name,
      chunkCount: file.chunkCount,
      createdAt: file.createdAt,
    }));

    const edges: GraphEdge[] = [];
    const ids = Array.from(meanMap.keys());
    for (let i = 0; i < ids.length; i += 1) {
      const a = meanMap.get(ids[i]);
      if (!a) continue;
      for (let j = i + 1; j < ids.length; j += 1) {
        const b = meanMap.get(ids[j]);
        if (!b) continue;
        const weight = cosineSimilarity(a, b);
        if (weight >= GRAPH_EDGE_THRESHOLD) {
          edges.push({ source: ids[i], target: ids[j], weight: Math.round(weight * 1000) / 1000 });
        }
      }
    }

    return { nodes, edges };
  }

  /** 执行返回单行单列的标量查询 */
  private async scalar<T>(sql: string, params: unknown[]): Promise<T> {
    const rows = (await this.dataSource.query(sql, params)) as [{ [key: string]: T }];
    return rows[0][Object.keys(rows[0])[0]];
  }
}

/** pgvector 平均向量以字符串形式返回（形如 [0.1,0.2,...]），解析为 number[] */
function parseVector(value: string): number[] {
  if (!value) {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed.map((n) => Number(n)) : [];
  } catch {
    return [];
  }
}

/** 余弦相似度 */
function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}