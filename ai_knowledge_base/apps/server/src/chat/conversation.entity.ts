/**
 * 会话实体（conversations 表）：一个用户可拥有多个会话，会话级联持有消息。
 * updatedAt 同时用于会话列表排序，每轮问答后刷新。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  /** 归属用户 ID（访问时必须校验与登录用户一致） */
  @Column()
  userId: number;

  /** 会话标题，默认“新对话” */
  @Column({ default: '新对话' })
  title: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
