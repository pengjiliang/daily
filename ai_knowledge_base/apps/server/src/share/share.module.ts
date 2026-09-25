/**
 * 共享模块：share_records 实体仓储 + 共享服务（导出给 UploadModule 复用权限判断）。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadFile } from '../upload/upload-file.entity.js';
import { UsersModule } from '../users/users.module.js';
import { ShareController } from './share.controller.js';
import { ShareRecord } from './share.entity.js';
import { ShareService } from './share.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ShareRecord, UploadFile]), UsersModule],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
