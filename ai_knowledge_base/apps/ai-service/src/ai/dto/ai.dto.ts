import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

export class HistoryMessage {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
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
