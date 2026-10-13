/**
 * 用量事件实体（ai_usage_events 表）：一次模型调用或缓存命中的计量记录。
 * 亮点 5「成本与用量看板」：问答链路各模型调用点写入，server 侧聚合展示。
 * server 与 ai-service 共用同一数据库，两处实体定义保持一致
 * （ai-service 由 DatabaseInitializationService 启动时同步建表）。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { UsageKind } from '@ai-knowledge-base/shared';

@Entity('ai_usage_events')
export class UsageEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'int', nullable: true })
  conversationId: number | null;

  @Column({ type: 'int', nullable: true })
  messageId: number | null;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  model: string;

  /** 调用类型：contextualize/rewrite/rerank/answer/external/suggestions/embedding/extraction/cache_hit */
  @Column({ type: 'varchar' })
  kind: UsageKind;

  @Column({ type: 'int', default: 0 })
  promptTokens: number;

  @Column({ type: 'int', default: 0 })
  completionTokens: number;

  /** 调用耗时 ms */
  @Column({ type: 'int', default: 0 })
  latencyMs: number;

  /** 是否缓存命中（kind=cache_hit 时为 true） */
  @Column({ type: 'boolean', default: false })
  cached: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
