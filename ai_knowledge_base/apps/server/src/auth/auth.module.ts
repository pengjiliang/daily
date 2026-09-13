/**
 * 鉴权模块：注册/登录/个人资料接口、JWT 签发与校验。
 * 通过 APP_GUARD 把 JwtAuthGuard 注册为全局守卫——默认所有接口都需要登录，
 * 仅标注了 @Public() 的路由（如登录、注册、health）放行。
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // JWT 密钥与有效期从配置读取
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>('jwt.expiresIn') as never,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD, // 全局生效：未显式 @Public 的接口一律校验 JWT
      useClass: JwtAuthGuard,
    },
  ],
})
export class AuthModule {}
