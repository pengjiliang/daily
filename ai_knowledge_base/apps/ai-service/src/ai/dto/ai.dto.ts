/**
 * AI 模块入参 DTO 与校验规则。
 * IndexDocumentDto：server 通知文档建索引的请求体；
 * AskDto：问答请求体（一次性 / SSE 流式共用）；
 * HistoryMessage 为跨端共享类型，定义在 packages/shared。
 */
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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

  /** 是否启用图谱问答增强：检索后额外从实体图谱取相关关系注入回答上下文（默认开启） */
  @IsOptional()
  @IsBoolean()
  graphEnabled?: boolean;
}

/** 评估 A/B 检索参数覆盖值（只用于内部检索调试请求）。 */
export class RetrieveConfigDto {
  @IsInt()
  @Min(1)
  @Max(50)
  topK: number;

  @IsInt()
  @Min(1)
  @Max(50)
  keywordTopK: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  minScore: number;

  @IsInt()
  @Min(1)
  @Max(30)
  rerankTopN: number;
}

export class RetrieveDebugDto extends AskDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RetrieveConfigDto)
  config?: RetrieveConfigDto;
}

/** 清空某用户语义缓存的请求体（文档变更后由 server 调用） */
export class InvalidateCacheDto {
  @IsInt()
  userId: number;
}

/** 单个模型配置（连接测试时可选，缺省沿用该用户已保存/环境默认配置）。 */
export class ModelConnectionConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;
}

/** 仅供 server 内部调用的连接测试参数；userId 由 server 从登录态注入。 */
export class TestConnectionDto {
  @IsInt()
  userId: number;

  @IsIn(['chat', 'embedding'])
  kind: 'chat' | 'embedding';

  @IsOptional()
  @IsIn(['openai', 'anthropic'])
  chatProvider?: 'openai' | 'anthropic';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelConnectionConfigDto)
  openai?: ModelConnectionConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelConnectionConfigDto)
  anthropic?: ModelConnectionConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelConnectionConfigDto)
  embedding?: ModelConnectionConfigDto;
}
