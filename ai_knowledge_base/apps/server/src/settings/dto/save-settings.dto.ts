/**
 * PUT /settings 请求体校验：与前端设置页表单一一对应。
 * apiKey 传空/缺省表示不修改（保留已保存或 .env 的值），
 * 因此每个模型组的所有字段均为可选，缺省字段不覆盖原值。
 */
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ChatProvider } from '@ai-knowledge-base/shared';

/** 单个模型组配置：baseUrl / apiKey / model，均为可选（缺省表示不修改） */
export class ProviderSettingsDto {
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

/** 设置保存请求体：所有字段可选，PUT 只覆盖本次传入的字段 */
export class SaveSettingsDto {
  @IsOptional()
  @IsIn(['openai', 'anthropic'])
  chatProvider?: ChatProvider;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  keywordTopK?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  rerankTopN?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderSettingsDto)
  openai?: ProviderSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderSettingsDto)
  anthropic?: ProviderSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderSettingsDto)
  embedding?: ProviderSettingsDto;
}
