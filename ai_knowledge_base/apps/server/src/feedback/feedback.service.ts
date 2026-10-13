/**
 * 反馈看板服务（亮点 4：反馈驱动的自优化闭环）。
 * 聚合 messages 表：热门点踩问题 Top10、按文档统计点踩引用来源、点踩原因分布。
 * 数据来源：ChatService.setMessageFeedback 写入的 feedback / feedbackReason /
 * 消息 sources（点踩时记录的引用）。
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FeedbackDashboard } from '@ai-knowledge-base/shared';
import { Message } from '../chat/message.entity.js';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
  ) {}

  /** 反馈看板：热门点踩问题 Top10 + 按文档统计点踩引用 + 原因分布 */
  async getDashboard(userId: number): Promise<FeedbackDashboard> {
    // ① 热门点踩问题：按点踩的回答对应的用户提问正文聚合
    const topDislikedQuestions = (await this.messagesRepository.query(
      `SELECT u.content AS content, COUNT(*)::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
         JOIN LATERAL (
           SELECT content FROM messages
            WHERE "conversationId" = c.id AND role = 'user' AND id < m.id
            ORDER BY id DESC LIMIT 1
         ) u ON true
        WHERE c."userId" = $1 AND m.role = 'assistant' AND m.feedback = 'dislike'
          AND btrim(u.content) <> ''
        GROUP BY u.content
        ORDER BY count DESC, MIN(m.id) ASC
        LIMIT 10`,
      [userId],
    )) as { content: string; count: number }[];

    // ② 按文档统计点踩引用：点踩回答的 sources 里知识库来源的 uploadFileId 聚合
    const rows = (await this.messagesRepository.query(
      `SELECT m.sources
         FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
        WHERE c."userId" = $1 AND m.role = 'assistant' AND m.feedback = 'dislike'
          AND m.sources IS NOT NULL`,
      [userId],
    )) as { sources: { uploadFileId: number | null; sourceType?: string }[] }[];

    const countByFile = new Map<number, number>();
    for (const row of rows) {
      const sources = Array.isArray(row.sources) ? row.sources : [];
      for (const source of sources) {
        if (source?.uploadFileId != null && source.sourceType === 'knowledge_base') {
          countByFile.set(source.uploadFileId, (countByFile.get(source.uploadFileId) ?? 0) + 1);
        }
      }
    }
    const topSourceIds = Array.from(countByFile.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topDislikedSources = topSourceIds.map(([uploadFileId, count]) => ({ uploadFileId, count, originalName: '' }));
    // 补文档名
    if (topSourceIds.length > 0) {
      const nameRows = (await this.messagesRepository.query(
        `SELECT id, "originalName" FROM upload_files WHERE id = ANY($1)`,
        [topSourceIds.map(([id]) => id)],
      )) as { id: number; originalName: string }[];
      const nameById = new Map(nameRows.map((r) => [r.id, r.originalName]));
      topDislikedSources.forEach((item) => {
        item.originalName = nameById.get(item.uploadFileId) ?? '已删除文档';
      });
    }

    // ③ 点踩原因分布
    const reasonBreakdown = (await this.messagesRepository.query(
      `SELECT COALESCE("feedbackReason", 'other') AS reason, COUNT(*)::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m."conversationId"
        WHERE c."userId" = $1 AND m.role = 'assistant' AND m.feedback = 'dislike'
        GROUP BY 1
        ORDER BY count DESC`,
      [userId],
    )) as { reason: string; count: number }[];

    return { topDislikedQuestions, topDislikedSources, reasonBreakdown };
  }
}
