/**
 * 评估问题集（eval_sets 表）：一组有标准答案的评测问题（用户私有）。
 * 亮点 3「RAG 评估与回归看板」：用固定问题集回归检索质量，量化每次检索/重排改动。
 */
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EvalCase } from './eval-case.entity.js';

@Entity('eval_sets')
export class EvalSet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => EvalCase, (evalCase) => evalCase.evalSet, { cascade: true })
  cases: EvalCase[];

  @CreateDateColumn()
  createdAt: Date;
}
