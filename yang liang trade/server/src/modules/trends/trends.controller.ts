import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { TrendsService } from './trends.service'

@Controller('trends')
@UseGuards(JwtAuthGuard)
export class TrendsController {
  constructor(private trends: TrendsService) {}

  @Get('overview')
  overview() {
    return this.trends.overview()
  }

  @Get('config')
  getConfig() {
    return this.trends.getConfig()
  }

  @Put('config')
  saveConfig(@Body() dto: Record<string, any>) {
    return this.trends.saveConfig(dto)
  }
}
