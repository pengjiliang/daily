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