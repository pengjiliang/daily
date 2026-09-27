import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
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

  @Get('message')
  message(@Query('uid') uid?: string) {
    return this.service.message(uid || '')
  }

  @Post('check-replies')
  checkReplies() {
    return this.service.checkReplies()
  }

  @Post('send')
  send(@Req() req, @Body() dto: MailSendDto) {
    const baseUrl = req.protocol + '://' + req.get('host')
    return this.service.send(dto, baseUrl)
  }
}

// 公开路由：邮件客户端加载追踪像素时无管理员 token，不能走 JwtAuthGuard
@Controller('mail/track')
export class MailTrackController {
  constructor(private service: MailService) {}
  @Get(':token')
  async track(@Param('token') token: string, @Res() res) {
    await this.service.track(token)
    res.status(204).end()
  }
}

