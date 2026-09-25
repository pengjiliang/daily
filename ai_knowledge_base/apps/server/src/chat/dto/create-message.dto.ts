/** 发送消息请求 DTO：问题文本，1~2000 字符；graphEnabled 为可选的图谱问答增强开关 */
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  /** 是否启用图谱问答增强（实体关系注入，默认开启） */
  @IsOptional()
  @IsBoolean()
  graphEnabled?: boolean;
}
