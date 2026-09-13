/**
 * 文档向量分块实体（document_chunks 表）。
 * 一条记录对应文档切片后的一个文本块及其 Embedding 向量，是向量/关键词检索的最小单元。
 * uploadFileId 与 server 端 upload_files 表逻辑关联（非同库外键，删除文件时由服务层清理）。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Transform number array to pgvector string format "[x1, x2, x3, ...]"
// 写入时把 number[] 转成 pgvector 字面量字符串；读取时去掉中括号按逗号/空白解析回数组
class VectorTransformer {
  to(value: number[] | null): string | null {
    if (!value) return null;
    return `[${value.join(',')}]`;
  }

  from(value: string | null): number[] | null {
    if (!value) return null;
    // Remove brackets and split by comma or space
    return value
      .trim()
      .slice(1, -1)
      .split(/[,\s]+/)
      .filter((x) => x)
      .map(parseFloat);
  }
}

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属上传文件 ID（对应 server 服务的 upload_files.id） */
  @Column()
  uploadFileId: number;

  /** 切片文本内容 */
  @Column('text')
  content: string;

  /** 文本向量（SQL 中通过 ::vector 显式转型为 pgvector 参与距离计算） */
  @Column({
    type: 'text',
    transformer: new VectorTransformer(),
  })
  embedding: number[];

  /** 附加元数据：原始文件名 originalName、MIME 类型、块序号等 */
  @Column('jsonb', { default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
