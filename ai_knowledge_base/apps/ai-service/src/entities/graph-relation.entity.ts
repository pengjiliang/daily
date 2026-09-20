/**
 * 实体级知识图谱的关系连线（graph_relations 表）。
 * 对应一个「实体A —关系— 实体B」三元组；两端实体为 graph_entities 的主键，
 * 同源同目标同关系在抽取时去重，重复索引同一文件时先删后插。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('graph_relations')
export class GraphRelation {
  @PrimaryGeneratedColumn()
  id: number;

  /** 抽取自哪个上传文档（对应 server 端 upload_files.id） */
  @Column()
  uploadFileId: number;

  /** 起点实体（graph_entities.id） */
  @Column()
  sourceEntityId: number;

  /** 终点实体（graph_entities.id） */
  @Column()
  targetEntityId: number;

  /** 关系描述（如"任职于""参与""位于"） */
  @Column()
  relation: string;

  @CreateDateColumn()
  createdAt: Date;
}
