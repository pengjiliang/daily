/**
 * server 根模块。
 * 组装配置中心、PostgreSQL 数据源（开发环境自动 synchronize 建表）、
 * 用户/鉴权/上传/聊天/共享四个业务模块，以及健康检查控制器。
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import configuration from './config/configuration.js';
import { SettingsModule } from './settings/settings.module.js';
import { StatsModule } from './stats/stats.module.js';
import { UsersModule } from './users/users.module.js';
import { UploadModule } from './upload/upload.module.js';
import { ChatModule } from './chat/chat.module.js';
import { ShareModule } from './share/share.module.js';
import { EvalModule } from './eval/eval.module.js';
import { UsageModule } from './usage/usage.module.js';
import { FeedbackModule } from './feedback/feedback.module.js';

@Module({
  imports: [
    // 全局配置：读取 .env，按 configuration.ts 结构暴露
    ConfigModule.forRoot({
      isGlobal: true,
      // 环境变量统一放在 monorepo 根目录 .env（dev 时 cwd 为 apps/server）
      envFilePath: [join(process.cwd(), '..', '..', '.env'), join(process.cwd(), '.env')],
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
        // 数据库结构变更统一走迁移；启动时自动执行未应用的迁移。
        // 开发环境可设 DB_SYNC=true 临时同步实体字段，生产保持关闭。
        synchronize: configService.getOrThrow<boolean>('database.synchronize'),
        migrationsRun: configService.getOrThrow<boolean>('database.migrationsRun'),
        // 迁移文件：dev（nest start）与 prod 都运行编译后的 dist，统一指向 dist/migrations
        migrations: [join(dirname(fileURLToPath(import.meta.url)), 'migrations', '*.js')],
        migrationsTransactionMode: 'each' as const,
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    UsersModule,
    AuthModule,
    UploadModule,
    ChatModule,
    SettingsModule,
    StatsModule,
    ShareModule,
    EvalModule,
    UsageModule,
    FeedbackModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
