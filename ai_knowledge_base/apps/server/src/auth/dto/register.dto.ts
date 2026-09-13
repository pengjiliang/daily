/**
 * 注册请求 DTO。
 * confirmPassword 仅用于兼容前端可能传入的确认密码字段（可选，后端不强制一致性）；
 * 密码的一致性校验在前端表单完成。
 */
import { IsString, Length, MaxLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 20)
  username: string;

  @IsString()
  @Length(6, 72)
  password: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
