/**
 * AI 设置实体（ai_settings 表）：每个用户一行（userId 唯一）。
 * 存放用户自定义的对话/向量模型配置与检索参数；字段为空时回退 .env 默认值。
 * server 与 ai-service 共用同一数据库，两处实体定义必须保持一致
 * （TypeORM synchronize 会按实体同步表结构，字段不一致可能互相改表冲突）。
 */
import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ChatProvider, ReindexProgress, ReindexStatus } from '@ai-knowledge-base/shared';

@Entity('ai_settings')
export class AiSettings {
  @PrimaryGeneratedColumn()
  id: number;

  /** 归属用户 ID（唯一：每用户一行配置） */
  @Column({ unique: true })
  userId: number;

  /** 对话提供商：openai（兼容网关，如火山方舟/豆包）或 anthropic（Claude 原生协议） */
  @Column({ type: 'varchar', default: 'openai' })
  chatProvider: ChatProvider;

  /** OpenAI 兼容对话配置（留空回退 .env） */
  @Column({ type: 'varchar', nullable: true })
  openaiBaseUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  openaiApiKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  openaiChatModel: string | null;

  /** Anthropic 对话配置（Anthropic 不提供 Embedding，向量模型仍用 OpenAI 兼容协议） */
  @Column({ type: 'varchar', nullable: true })
  anthropicBaseUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  anthropicApiKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  anthropicChatModel: string | null;

  /** 向量（Embedding）模型配置：恒为 OpenAI 兼容协议 */
  @Column({ type: 'varchar', nullable: true })
  embeddingBaseUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  embeddingApiKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  embeddingModel: string | null;

  /** 生成温度（0~2） */
  @Column({ type: 'double precision', default: 0 })
  temperature: number;

  /** 向量路检索候选数 */
  @Column({ type: 'int', default: 8 })
  topK: number;

  /** 关键词（字面）路候选数 */
  @Column({ type: 'int', default: 8 })
  keywordTopK: number;

  /** 向量路绝对相似度阈值 */
  @Column({ type: 'double precision', default: 0.3 })
  minScore: number;

  /** 重排后保留片段数 */
  @Column({ type: 'int', default: 5 })
  rerankTopN: number;

  /** 重建索引状态：idle/pending/running/done/failed */
  @Column({ type: 'varchar', default: 'idle' })
  reindexStatus: ReindexStatus;

  /** 重建索引进度（jsonb） */
  @Column({ type: 'jsonb', nullable: true })
  reindexProgress: ReindexProgress | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
