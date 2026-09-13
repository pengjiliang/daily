/** 登录请求 DTO：用户名 3~20 字符，密码 6~72 字符 */
import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 20)
  username: string;

  @IsString()
  @Length(6, 72)
  password: string;
}
