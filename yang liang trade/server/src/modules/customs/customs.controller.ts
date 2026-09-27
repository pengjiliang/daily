import { BadRequestException, Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { CustomsService } from './customs.service'

@Controller('customs')
@UseGuards(JwtAuthGuard)
export class CustomsController {
  constructor(private customs: CustomsService) {}

  @Get('config')
  getConfig() {
    return this.customs.getConfig()
  }

  @Put('config')
  saveConfig(@Body() dto: Record<string, any>) {
    return this.customs.saveConfig(dto)
  }

  @Post('query')
  query(@Body() body: { website?: string }) {
    const website = String(body?.website || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
    if (!website) throw new BadRequestException('请输入客户网址')
    return this.customs.query(website)
  }
}
