/**
 * AI 业务模块：注册文档分块仓储、模型工厂（OpenAIModelProvider）、
 * 文档索引服务（DocumentIndexService）、问答服务（AskService）及对外 HTTP 控制器。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import { AIController } from './ai.controller.js';
import { AskService } from './ask.service.js';
import { DocumentIndexService } from './document-index.service.js';
import { OpenAIModelProvider } from './openai-model.provider.js';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentChunk])],
  controllers: [AIController],
  providers: [OpenAIModelProvider, DocumentIndexService, AskService],
})
export class AIModule {}
