import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { RetrievedChunk } from '@ai-knowledge-base/shared';

export type MessageRole = 'user' | 'assistant';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  conversationId: number;

  @Column({ type: 'varchar' })
  role: MessageRole;

  @Column('text')
  content: string;

  /** RAG 引用来源，仅 assistant 消息有值 */
  @Column({ type: 'jsonb', nullable: true })
  sources: RetrievedChunk[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
