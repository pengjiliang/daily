/**
 * ai-service 应用级控制器：仅提供健康检查接口，供部署/探活使用。
 */
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  /** GET /health：服务存活探针 */
  @Get('health')
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
