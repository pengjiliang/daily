/**
 * 数据库初始化服务：模块启动时确保 pgvector / pg_trgm 扩展可用，
 * 通过 dataSource.synchronize() 同步实体表结构，并补建 content 列的 trigram GIN 索引。
 * CREATE EXTENSION / CREATE INDEX 均为 IF NOT EXISTS 幂等写法，每次启动可安全重复执行。
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseInitializationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitializationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    // pg_trgm：混合检索的关键词（字面子串）召回依赖的 trigram 扩展
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await this.dataSource.synchronize();
    // trigram GIN 索引加速 content ILIKE '%term%' 子串查询（需在表同步之后创建）
    await this.dataSource.query(
      'CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm ON document_chunks USING GIN (content gin_trgm_ops)',
    );
    this.logger.log('pgvector + pg_trgm extensions enabled and AI schema synchronized');
  }
}
