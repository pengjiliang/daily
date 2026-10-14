/**
 * passport-jwt 策略：从 Authorization: Bearer <token> 提取并验证 JWT，
 * 校验通过后把 validate() 的返回值挂到 request.user，供控制器取当前登录用户。
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AUTH_COOKIE_NAME } from '../auth.service.js';

/** 签发的 JWT 载荷结构：sub 为用户 ID */
export interface JwtPayload {
  sub: number;
  username: string;
}

/** 从 HttpOnly Cookie 提取 JWT；无 Cookie 时回退 Authorization: Bearer（兼容过渡） */
function extractJwtFromRequest(request: Request): string | null {
    const fromCookie = request.cookies?.[AUTH_COOKIE_NAME];
    if (typeof fromCookie === 'string' && fromCookie) {
        return fromCookie;
    }
    return ExtractJwt.fromAuthHeaderAsBearerToken()(request);
}

/** 注入 request.user 的登录用户结构 */
export interface AuthenticatedUser {
  userId: number;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false, // 过期令牌直接校验失败
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  /** Passport 校验签名/有效期通过后调用：把载荷映射为 request.user */
  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, username: payload.username };
  }
}
