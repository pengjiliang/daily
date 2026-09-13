/**
 * 鉴权控制器：注册、登录（均为 @Public 免登录）与获取当前登录用户资料。
 */
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, PublicUser } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { AuthenticatedUser } from './strategies/jwt.strategy.js';

/** Express 请求附加已登录用户信息（由 JwtStrategy.validate 注入） */
type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /auth/register：注册新用户，返回不含密码的用户信息 */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  /** POST /auth/login：校验账密并签发 JWT */
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** GET /auth/profile：根据 JWT 中的用户 ID 返回当前用户资料 */
  @Get('profile')
  profile(@Req() request: AuthenticatedRequest): Promise<PublicUser> {
    return this.authService.getProfile(request.user.userId);
  }
}
