import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('upload_files')
export class UploadFile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column()
  path: string;

  @Column('bigint')
  size: number;

  @Column()
  uploaderId: number;

  @CreateDateColumn()
  createdAt: Date;
}
