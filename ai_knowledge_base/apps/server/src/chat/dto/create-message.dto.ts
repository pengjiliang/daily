/** 发送消息请求 DTO：问题文本，1~2000 字符 */
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
