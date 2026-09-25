/**
 * 上传模块：头像与知识文档的上传、列表、下载、删除。
 * 文档入库后由 UploadService 异步通知 ai-service 做解析与向量索引；
 * UsersModule 用于保存头像 URL 到用户资料；ShareModule 用于共享权限判断与共享文档列表。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { ShareModule } from '../share/share.module.js';
import { UploadController } from './upload.controller.js';
import { UploadFile } from './upload-file.entity.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UploadFile]), UsersModule, ShareModule],
  controllers: [UploadController],
  providers: [UploadService],
  // 供 SettingsModule 依赖注入：重建索引时调用 UploadService.reindexDocument
  exports: [UploadService],
})
export class UploadModule {}
