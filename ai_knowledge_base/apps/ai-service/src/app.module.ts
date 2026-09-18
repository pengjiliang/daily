/**
 * ai-service 根模块。
 * 组装配置中心（环境变量）、PostgreSQL + pgvector 数据源、AI 业务模块（AIModule），
 * 以及启动时自动建扩展/建表的 DatabaseInitializationService。
 * 注意：本服务关闭 TypeORM synchronize，表结构由初始化服务统一管理。
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AppController } from './app.controller.js';
import { AIModule } from './ai/ai.module.js';
import configuration from './config/configuration.js';
import { AiSettings } from './entities/ai-settings.entity.js';
import { DocumentChunk } from './entities/document-chunk.entity.js';
import { DatabaseInitializationService } from './services/database-initialization.service.js';

@Module({
  imports: [
    // 全局配置：读取 .env 并按 configuration.ts 的结构暴露
    ConfigModule.forRoot({
      isGlobal: true,
      // 环境变量统一放在 monorepo 根目录 .env（dev 时 cwd 为 apps/ai-service）
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
        entities: [DocumentChunk, AiSettings],
        synchronize: false, // 不在此处自动同步，改由 DatabaseInitializationService 控制
      }),
    }),
    AIModule,
  ],
  controllers: [AppController],
  providers: [DatabaseInitializationService],
})
export class AppModule {}
