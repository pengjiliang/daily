/**
 * 消息实体（messages 表）：会话内的一轮用户提问或 AI 回答，按 id 正序即为对话时间线。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { RetrievedChunk } from '@ai-knowledge-base/shared';

/** 消息角色：用户提问 / AI 回答 */
export type MessageRole = 'user' | 'assistant';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属会话 ID */
  @Column()
  conversationId: number;

  @Column({ type: 'varchar' })
  role: MessageRole;

  /** 消息正文（user 为提问，assistant 为完整回答） */
  @Column('text')
  content: string;

  /** RAG 引用来源（知识库片段 + 外部资料），仅 assistant 消息有值 */
  @Column({ type: 'jsonb', nullable: true })
  sources: RetrievedChunk[] | null;

  /** 用户对 AI 回答的反馈：like（点赞）/ dislike（点踩），未评价为 null */
  @Column({ type: 'varchar', nullable: true })
  feedback: 'like' | 'dislike' | null;

  @CreateDateColumn()
  createdAt: Date;
}
