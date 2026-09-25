/**
 * 文档共享记录（share_records 表）：把一个上传文档共享给另一个用户。
 * - ownerId：文档所有者（等于 upload_files.uploaderId）；
 * - shareeId：被共享的用户；
 * - permission：read（只读，可检索/预览/下载）/ edit（可编辑，额外允许重命名）。
 * 删除等所有权操作仍只归 owner；同一文档对同一用户只允许一条记录（唯一约束）。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** 共享权限：read 只读 / edit 可编辑（重命名） */
export type SharePermission = 'read' | 'edit';

@Entity('share_records')
@Unique(['uploadFileId', 'shareeId'])
export class ShareRecord {
  @PrimaryGeneratedColumn()
  id: number;

  /** 被共享的上传文档 id（对应 upload_files.id） */
  @Column()
  uploadFileId: number;

  /** 文档所有者用户 id（= upload_files.uploaderId） */
  @Column()
  ownerId: number;

  /** 被共享用户 id */
  @Column()
  shareeId: number;

  /** 权限：read（只读）/ edit（可编辑） */
  @Column({ type: 'varchar', default: 'read' })
  permission: SharePermission;

  @CreateDateColumn()
  createdAt: Date;
}
