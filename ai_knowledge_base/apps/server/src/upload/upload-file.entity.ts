/**
 * 上传文件实体（upload_files 表）：文档与上传元数据。
 * ai-service 的 document_chunks 通过 uploadFileId 关联到本表（两个服务共享同一个库）。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('upload_files')
export class UploadFile {
  @PrimaryGeneratedColumn()
  id: number;

  /** 磁盘上的实际文件名（UUID + 扩展名，避免重名覆盖） */
  @Column()
  filename: string;

  /** 用户上传时的原始文件名（可能含中文，用于展示与下载） */
  @Column()
  originalName: string;

  /**
   * 所属文件夹的相对路径（如 `2026/文档`），文件夹上传时由前端显式传入；
   * 单文件上传为 NULL。前端按此字段分组展示"文件夹列表 / 文件列表"。
   */
  @Column({ type: 'varchar', nullable: true })
  folderName: string | null;

  @Column()
  mimeType: string;

  /** 相对 UPLOAD_ROOT 的存储路径，如 documents/xxx.pdf */
  @Column()
  path: string;

  /** 文件字节数（bigint 列映射为 number） */
  @Column('bigint')
  size: number;

  /** 上传者用户 ID，所有访问都校验归属 */
  @Column()
  uploaderId: number;

  @CreateDateColumn()
  createdAt: Date;
}
