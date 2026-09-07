import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  @Get('health')
  @Public()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
