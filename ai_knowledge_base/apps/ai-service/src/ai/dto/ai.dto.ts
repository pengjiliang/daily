/**
 * AI 模块入参 DTO 与校验规则。
 * IndexDocumentDto：server 通知文档建索引的请求体；
 * AskDto：问答请求体（一次性 / SSE 流式共用）；
 * HistoryMessage 为跨端共享类型，定义在 packages/shared。
 */
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { HistoryMessage } from '@ai-knowledge-base/shared';

// 跨端共享类型：定义见 packages/shared，此处仅转发
export type { HistoryMessage };

/** server 上传文档后通知本服务建索引的请求体 */
export class IndexDocumentDto {
  @IsInt()
  uploadFileId: number;

  /** 上传者用户 ID：按用户隔离，使用该用户配置的向量模型建索引 */
  @IsInt()
  uploaderId: number;

  /** server 本机磁盘上的文件绝对路径（两服务需共享同一存储或部署在同机） */
  @IsString()
  @MinLength(1)
  filePath: string;

  /** 用户上传时的原始文件名（写入分块 metadata，供检索结果展示/去重） */
  @IsString()
  @MinLength(1)
  originalName: string;

  @IsString()
  @MinLength(1)
  mimeType: string;
}

/** 问答请求体：问题必填（1~2000 字），会话 ID 与历史对话可选（历史用于多轮上下文） */
export class AskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  question: string;

  /** 当前登录用户 id：检索按用户隔离（只查询该用户上传的文档分块），由 server 端从 JWT 透传 */
  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  history?: HistoryMessage[];
}