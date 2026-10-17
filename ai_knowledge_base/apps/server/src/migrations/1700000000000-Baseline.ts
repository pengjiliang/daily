/**
 * 基线迁移：覆盖 server 与 ai-service 共享数据库的全部表结构。
 * 全部使用 CREATE TABLE IF NOT EXISTS，对已存在的库只补缺表/索引，不会破坏数据。
 * 迁移表（migrations）由 TypeORM 统一记录，避免重复执行。
 */
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1700000000000 implements MigrationInterface {
  name = 'Baseline1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "username" varchar NOT NULL,
        "password" varchar NOT NULL,
        "avatarUrl" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")`);

    // upload_files
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "upload_files" (
        "id" SERIAL PRIMARY KEY,
        "filename" varchar NOT NULL,
        "originalName" varchar NOT NULL,
        "folderName" varchar,
        "mimeType" varchar NOT NULL,
        "path" varchar NOT NULL,
        "size" bigint NOT NULL,
        "uploaderId" integer NOT NULL,
        "indexStatus" varchar NOT NULL DEFAULT 'pending',
        "chunkCount" integer,
        "indexedAt" timestamptz,
        "indexError" text,
        "errorKind" varchar,
        "indexAttempts" integer NOT NULL DEFAULT 0,
        "embeddingModel" varchar,
        "embeddingDim" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_upload_files_uploaderId" ON "upload_files" ("uploaderId")`);

    // ai_settings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_settings" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "chatProvider" varchar NOT NULL DEFAULT 'openai',
        "openaiBaseUrl" varchar,
        "openaiApiKey" varchar,
        "openaiChatModel" varchar,
        "anthropicBaseUrl" varchar,
        "anthropicApiKey" varchar,
        "anthropicChatModel" varchar,
        "embeddingBaseUrl" varchar,
        "embeddingApiKey" varchar,
        "embeddingModel" varchar,
        "temperature" double precision NOT NULL DEFAULT 0,
        "topK" integer NOT NULL DEFAULT 8,
        "keywordTopK" integer NOT NULL DEFAULT 8,
        "minScore" double precision NOT NULL DEFAULT 0.3,
        "rerankTopN" integer NOT NULL DEFAULT 5,
        "dailyTokenLimit" integer NOT NULL DEFAULT 0,
        "monthlyTokenLimit" integer NOT NULL DEFAULT 0,
        "reindexStatus" varchar NOT NULL DEFAULT 'idle',
        "reindexProgress" jsonb,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_settings_userId" UNIQUE ("userId")
      )`);

    // share_records
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "share_records" (
        "id" SERIAL PRIMARY KEY,
        "uploadFileId" integer NOT NULL,
        "ownerId" integer NOT NULL,
        "shareeId" integer NOT NULL,
        "permission" varchar NOT NULL DEFAULT 'read',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_share_records_uploadFileId_shareeId" UNIQUE ("uploadFileId", "shareeId")
      )`);

    // conversations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversations" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "title" varchar NOT NULL DEFAULT '新对话',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_conversations_userId" ON "conversations" ("userId")`);

    // messages
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" SERIAL PRIMARY KEY,
        "conversationId" integer NOT NULL,
        "role" varchar NOT NULL,
        "content" text NOT NULL,
        "sources" jsonb,
        "feedback" varchar,
        "feedbackReason" varchar,
        "feedbackSourceIndex" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_messages_conversationId" ON "messages" ("conversationId")`);

    // eval_sets / eval_cases / eval_runs / eval_results
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "eval_sets" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "eval_cases" (
        "id" SERIAL PRIMARY KEY,
        "evalSetId" integer NOT NULL,
        "question" varchar NOT NULL,
        "expectedFileId" integer,
        "expectedKeywords" jsonb,
        "note" text
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "eval_runs" (
        "id" SERIAL PRIMARY KEY,
        "evalSetId" integer NOT NULL,
        "config" jsonb NOT NULL,
        "caseCount" integer NOT NULL,
        "recallAtK" double precision NOT NULL DEFAULT 0,
        "mrr" double precision NOT NULL DEFAULT 0,
        "emptyRate" double precision NOT NULL DEFAULT 0,
        "citationAccuracy" double precision NOT NULL DEFAULT 0,
        "avgRetrieveSec" double precision NOT NULL DEFAULT 0,
        "avgAnswerSec" double precision NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "eval_results" (
        "id" SERIAL PRIMARY KEY,
        "runId" integer NOT NULL,
        "caseId" integer NOT NULL,
        "question" varchar NOT NULL,
        "expectedFileId" integer,
        "expectedKeywords" jsonb,
        "hitExpectedFile" boolean NOT NULL DEFAULT false,
        "expectedFileRank" integer,
        "mrrContribution" double precision NOT NULL DEFAULT 0,
        "empty" boolean NOT NULL DEFAULT false,
        "citationHit" boolean NOT NULL DEFAULT false,
        "retrieveSec" double precision NOT NULL DEFAULT 0,
        "answerSec" double precision NOT NULL DEFAULT 0,
        "kept" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);

    // ai_usage_events
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_usage_events" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "conversationId" integer,
        "messageId" integer,
        "provider" varchar NOT NULL,
        "model" varchar NOT NULL,
        "kind" varchar NOT NULL,
        "promptTokens" integer NOT NULL DEFAULT 0,
        "completionTokens" integer NOT NULL DEFAULT 0,
        "latencyMs" integer NOT NULL DEFAULT 0,
        "cached" boolean NOT NULL DEFAULT false,
        "usageSource" varchar NOT NULL DEFAULT 'legacy_estimate',
        "costUsd" numeric(14,8),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_usage_events_userId" ON "ai_usage_events" ("userId")`);

    // document_chunks
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_chunks" (
        "id" SERIAL PRIMARY KEY,
        "uploadFileId" integer NOT NULL,
        "content" text NOT NULL,
        "embedding" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_document_chunks_uploadFileId" ON "document_chunks" ("uploadFileId")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_document_chunks_content_trgm" ON "document_chunks" USING GIN ("content" gin_trgm_ops)`,
    );

    // semantic_cache
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "semantic_cache" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "question" text NOT NULL,
        "questionEmbedding" text NOT NULL,
        "answer" text NOT NULL,
        "sources" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "hitCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);

    // graph_entities / graph_relations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "graph_entities" (
        "id" SERIAL PRIMARY KEY,
        "uploadFileId" integer NOT NULL,
        "userId" integer NOT NULL,
        "name" varchar NOT NULL,
        "entityType" varchar NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_graph_entities_uploadFileId" ON "graph_entities" ("uploadFileId")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "graph_relations" (
        "id" SERIAL PRIMARY KEY,
        "uploadFileId" integer NOT NULL,
        "sourceEntityId" integer NOT NULL,
        "targetEntityId" integer NOT NULL,
        "relation" varchar NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_graph_relations_sourceEntityId" ON "graph_relations" ("sourceEntityId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_graph_relations_targetEntityId" ON "graph_relations" ("targetEntityId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "graph_relations"');
    await queryRunner.query('DROP TABLE IF EXISTS "graph_entities"');
    await queryRunner.query('DROP TABLE IF EXISTS "semantic_cache"');
    await queryRunner.query('DROP TABLE IF EXISTS "document_chunks"');
    await queryRunner.query('DROP TABLE IF EXISTS "ai_usage_events"');
    await queryRunner.query('DROP TABLE IF EXISTS "eval_results"');
    await queryRunner.query('DROP TABLE IF EXISTS "eval_runs"');
    await queryRunner.query('DROP TABLE IF EXISTS "eval_cases"');
    await queryRunner.query('DROP TABLE IF EXISTS "eval_sets"');
    await queryRunner.query('DROP TABLE IF EXISTS "messages"');
    await queryRunner.query('DROP TABLE IF EXISTS "conversations"');
    await queryRunner.query('DROP TABLE IF EXISTS "share_records"');
    await queryRunner.query('DROP TABLE IF EXISTS "ai_settings"');
    await queryRunner.query('DROP TABLE IF EXISTS "upload_files"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
  }
}
