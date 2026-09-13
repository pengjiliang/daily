/**
 * server 根模块。
 * 组装配置中心、PostgreSQL 数据源（开发环境自动 synchronize 建表）、
 * 用户/鉴权/上传/聊天四个业务模块，以及健康检查控制器。
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import configuration from './config/configuration.js';
import { UsersModule } from './users/users.module.js';
import { UploadModule } from './upload/upload.module.js';
import { ChatModule } from './chat/chat.module.js';

@Module({
  imports: [
    // 全局配置：读取 .env，按 configuration.ts 结构暴露
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('database.host'),
        port: configService.getOrThrow<number>('database.port'),
        username: configService.getOrThrow<string>('database.username'),
        password: configService.getOrThrow<string>('database.password'),
        database: configService.getOrThrow<string>('database.name'),
        autoLoadEntities: true, // 自动注册各模块通过 forFeature 注册的实体
        // 仅开发环境自动同步表结构；生产环境关闭（见 configuration）
        synchronize: configService.getOrThrow<boolean>('database.synchronize'),
      }),
    }),
    UsersModule,
    AuthModule,
    UploadModule,
    ChatModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
