import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { MailService, MailLoginDto, MailSendDto } from './mail.service'

@Controller('mail')
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(private service: MailService) {}

  @Get('config')
  getConfig() {
    return this.service.getConfig()
  }

  @Post('login')
  login(@Body() dto: MailLoginDto) {
    return this.service.login(dto)
  }

  @Delete('config')
  remove() {
    return this.service.remove()
  }

  @Get('inbox')
  inbox(@Query('limit') limit?: string) {
    return this.service.inbox(limit)
  }

  @Post('send')
  send(@Body() dto: MailSendDto) {
    return this.service.send(dto)
  }
}
