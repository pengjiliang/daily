import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { HistoryMessage } from '@ai-knowledge-base/shared';

// 跨端共享类型：定义见 packages/shared，此处仅转发
export type { HistoryMessage };

export class IndexDocumentDto {
  @IsInt()
  uploadFileId: number;

  @IsString()
  @MinLength(1)
  filePath: string;

  @IsString()
  @MinLength(1)
  originalName: string;

  @IsString()
  @MinLength(1)
  mimeType: string;
}

export class AskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  question: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  history?: HistoryMessage[];
}
