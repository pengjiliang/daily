/**
 * 用量事件实体（ai_usage_events 表）：与 ai-service 侧定义保持一致（同库双实体模式）。
 * 亮点 5「成本与用量看板」：server 聚合查询，ai-service 写入。
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

  @Column({ type: 'varchar' })
  kind: UsageKind;

  @Column({ type: 'int', default: 0 })
  promptTokens: number;

  @Column({ type: 'int', default: 0 })
  completionTokens: number;

  @Column({ type: 'int', default: 0 })
  latencyMs: number;

  @Column({ type: 'boolean', default: false })
  cached: boolean;

  @Column({ type: 'varchar', default: 'legacy_estimate' })
  usageSource: 'provider' | 'unavailable' | 'legacy_estimate';

  @Column({ type: 'numeric', precision: 14, scale: 8, nullable: true })
  costUsd: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
