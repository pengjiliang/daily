import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { UploadController } from './upload.controller.js';
import { UploadFile } from './upload-file.entity.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UploadFile]), UsersModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
