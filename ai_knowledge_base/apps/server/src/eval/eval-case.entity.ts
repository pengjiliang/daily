/**
 * 评估用例（eval_cases 表）：问题 + 期望命中的文档 / 关键片段关键词。
 * 指标计算：recall@k = 期望文件进入检索 kept；引用准确率 = kept 内容命中任一期望关键词。
 */
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EvalSet } from './eval-set.entity.js';

@Entity('eval_cases')
export class EvalCase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  evalSetId: number;

  @ManyToOne(() => EvalSet, (evalSet) => evalSet.cases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evalSetId' })
  evalSet: EvalSet;

  @Column({ type: 'varchar' })
  question: string;

  /** 期望命中的文档 id（检索 kept 中应出现该文件） */
  @Column({ type: 'int', nullable: true })
  expectedFileId: number | null;

  /** 期望命中的关键片段关键词（jsonb 数组） */
  @Column({ type: 'jsonb', nullable: true })
  expectedKeywords: string[] | null;

  /** 期望答案要点（备注用） */
  @Column({ type: 'text', nullable: true })
  note: string | null;
}
