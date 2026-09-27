import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/jwt-auth.guard'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() body: { username: string; password: string }) {
    return this.auth.register(body.username, body.password)
  }

  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password)
  }

  @Get('setup-status')
  setupStatus() {
    return this.auth.setupStatus()
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { username: string } }) {
    return this.auth.me(req.user.username)
  }
}
