/**
 * server 应用级控制器：仅提供免鉴权健康检查接口，供部署/探活使用。
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  /** GET /health：服务存活探针（@Public 跳过全局 JWT 守卫） */
  @Get('health')
  @Public()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
