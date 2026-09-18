/**
 * AI 业务模块：注册文档分块仓储、模型工厂（ModelProvider）、用户设置服务（UserSettingsService）、
 * 文档索引服务（DocumentIndexService）、问答服务（AskService）及对外 HTTP 控制器。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import { AiSettings } from '../entities/ai-settings.entity.js';
import { UserSettingsService } from '../settings/user-settings.service.js';
import { AIController } from './ai.controller.js';
import { AskService } from './ask.service.js';
import { DocumentIndexService } from './document-index.service.js';
import { ModelProvider } from './openai-model.provider.js';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentChunk, AiSettings])],
  controllers: [AIController],
  providers: [ModelProvider, UserSettingsService, DocumentIndexService, AskService],
})
export class AIModule {}