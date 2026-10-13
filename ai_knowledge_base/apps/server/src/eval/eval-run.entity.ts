/**
 * 评估运行（eval_runs 表）：一次评估的参数快照 + 聚合指标。
 * 亮点 3：跑同一问题集对比不同检索参数（A/B），记录 recall@k / MRR / 空答率 / 引用准确率。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { EvalRunConfig } from '@ai-knowledge-base/shared';

@Entity('eval_runs')
export class EvalRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  evalSetId: number;

  /** 运行参数快照（jsonb）：topK / keywordTopK / minScore / rerankTopN */
  @Column({ type: 'jsonb' })
  config: EvalRunConfig;

  @Column({ type: 'int' })
  caseCount: number;

  @Column({ type: 'double precision', default: 0 })
  recallAtK: number;

  @Column({ type: 'double precision', default: 0 })
  mrr: number;

  @Column({ type: 'double precision', default: 0 })
  emptyRate: number;

  @Column({ type: 'double precision', default: 0 })
  citationAccuracy: number;

  @Column({ type: 'double precision', default: 0 })
  avgRetrieveSec: number;

  @Column({ type: 'double precision', default: 0 })
  avgAnswerSec: number;

  @CreateDateColumn()
  createdAt: Date;
}
