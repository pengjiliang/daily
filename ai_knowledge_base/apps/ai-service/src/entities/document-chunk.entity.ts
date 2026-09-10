import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Transform number array to pgvector string format "[x1, x2, x3, ...]"
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

  @Column()
  uploadFileId: number;

  @Column('text')
  content: string;

  @Column({
    type: 'text',
    transformer: new VectorTransformer(),
  })
  embedding: number[];

  @Column('jsonb', { default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
