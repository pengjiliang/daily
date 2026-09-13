/**
 * 用户模块：注册 User 实体仓储并提供 UsersService；
 * exports 给 AuthModule、UploadModule 复用（登录校验、头像更新）。
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
