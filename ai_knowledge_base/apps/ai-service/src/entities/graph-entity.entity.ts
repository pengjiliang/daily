/**
 * 实体级知识图谱的实体节点（graph_entities 表）。
 * 文档索引完成后由 LLM 抽取「实体—关系—实体」三元组写入本表；
 * 按 uploadFileId + userId 隔离与回溯，重复索引同一文件时先删后插。
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('graph_entities')
export class GraphEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** 抽取自哪个上传文档（对应 server 端 upload_files.id） */
  @Column()
  uploadFileId: number;

  /** 归属用户 ID：实体图谱按用户隔离 */
  @Column()
  userId: number;

  /** 实体名（如"张三""研发部"） */
  @Column()
  name: string;

  /** 实体类型：人物/组织/地点/概念/项目/产品/事件/其他 */
  @Column()
  entityType: string;

  @CreateDateColumn()
  createdAt: Date;
}
