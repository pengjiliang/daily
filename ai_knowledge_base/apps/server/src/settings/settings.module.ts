/**
 * 设置模块：每个用户的 AI 模型/检索参数配置。
 * 依赖 UploadModule（保存时按用户文档触发重建索引）。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from '../upload/upload.module.js';
import { AiSettings } from './ai-settings.entity.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AiSettings]), UploadModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
