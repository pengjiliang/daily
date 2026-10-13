/**
 * 评估结果明细（eval_results 表）：一次运行中每条用例的逐题指标。
 * kept 保存本次检索保留片段（供逐题排查「哪一步丢了正确片段」）。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { RetrieveLegItem } from '@ai-knowledge-base/shared';

@Entity('eval_results')
export class EvalResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  runId: number;

  @Column()
  caseId: number;

  @Column({ type: 'varchar' })
  question: string;

  @Column({ type: 'int', nullable: true })
  expectedFileId: number | null;

  @Column({ type: 'jsonb', nullable: true })
  expectedKeywords: string[] | null;

  @Column({ type: 'boolean', default: false })
  hitExpectedFile: boolean;

  @Column({ type: 'int', nullable: true })
  expectedFileRank: number | null;

  @Column({ type: 'double precision', default: 0 })
  mrrContribution: number;

  @Column({ type: 'boolean', default: false })
  empty: boolean;

  @Column({ type: 'boolean', default: false })
  citationHit: boolean;

  @Column({ type: 'double precision', default: 0 })
  retrieveSec: number;

  @Column({ type: 'double precision', default: 0 })
  answerSec: number;

  /** 本次检索 kept 片段（jsonb，供逐题排查） */
  @Column({ type: 'jsonb', nullable: true })
  kept: (RetrieveLegItem & { similarity: number })[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
