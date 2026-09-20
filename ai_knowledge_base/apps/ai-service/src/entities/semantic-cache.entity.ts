/**
 * 语义缓存实体（semantic_cache 表）：按用户缓存问答结果，用于「同类问题去重」。
 * 保存问题文本 + 问题向量 + 答案 + 引用来源；命中判断在 ai-service 内按余弦相似度完成，
 * 用户重复或近义提问时直接返回上次结果，跳过检索与模型调用，节省成本并保证同类问题答案一致。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { RetrievedChunk } from '@ai-knowledge-base/shared';

@Entity('semantic_cache')
export class SemanticCache {
  @PrimaryGeneratedColumn()
  id: number;

  /** 归属用户 ID：缓存按用户隔离，避免跨用户返回他人知识库的结果 */
  @Column()
  userId: number;

  /** 原始问题文本（便于排查与展示） */
  @Column('text')
  question: string;

  /** 问题向量（text 存储 pgvector 字面量，SQL 中 ::vector 转型参与距离计算） */
  @Column('text')
  questionEmbedding: string;

  /** 缓存答案（完整回答正文） */
  @Column('text')
  answer: string;

  /** 缓存来源（知识库片段 + 外部资料，与正常回答一致的契约） */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  sources: RetrievedChunk[];

  /** 命中次数（仅统计用，便于观察哪些问题被反复问） */
  @Column({ type: 'int', default: 0 })
  hitCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}