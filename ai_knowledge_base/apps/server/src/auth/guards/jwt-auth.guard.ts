/**
 * 全局 JWT 守卫：继承 Passport 的 AuthGuard('jwt')。
 * 先查路由/控制器上是否存在 @Public() 元数据：有则直接放行，否则走标准 JWT 校验。
 */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // 方法级元数据优先，其次类级元数据
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 公开接口直接为 true；受保护接口交给 passport-jwt 校验令牌
    return isPublic || super.canActivate(context);
  }
}
