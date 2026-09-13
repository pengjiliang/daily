/**
 * 用户实体（users 表）：账号、bcrypt 密码哈希、头像访问路径与时间戳。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /** 登录用户名，全局唯一 */
  @Column({ unique: true, type: 'varchar' })
  username: string;

  /** bcrypt 密码哈希（切勿明文返回给前端） */
  @Column({ type: 'varchar' })
  password: string;

  /** 头像 URL（/uploads/avatars/...），未设置头像时为 null */
  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
