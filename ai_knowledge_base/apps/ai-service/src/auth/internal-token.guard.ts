/**
 * ai-service 内部调用守卫：校验 X-Internal-Token，拒绝外部伪造的问答/索引请求。
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-internal-token'];
    const expected = this.configService.get<string>('internalToken', '');
    const token = Array.isArray(provided) ? provided[0] : provided;
    if (!expected || typeof token !== 'string' || !safeEqual(token, expected)) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
