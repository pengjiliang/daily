/**
 * 业务后端（server / BFF）启动入口，默认监听 3000 端口。
 * 面向前端提供鉴权、文件上传、会话与问答接口，内部再调用 ai-service（3001）。
 * 同时托管 /uploads 静态资源、全局入参校验、面向 Vite 开发服务器的 CORS。
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { AVATARS_DIRECTORY } from './upload/upload.storage.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // 解析 Cookie：登录态 JWT 存放在 HttpOnly Cookie 中
  app.use(cookieParser());
  // 粘贴文本导入上限 20 万字符，需高于 Nest 默认 100kb
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  // 仅开放头像等确需公开的静态资源；知识库文档一律经鉴权下载接口返回，
  // 避免文档文件绕过登录/共享权限被直接访问。
  app.use('/uploads/avatars', express.static(AVATARS_DIRECTORY));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动去除 DTO 未声明字段
      forbidNonWhitelisted: true, // 携带未声明字段时直接报 400
      transform: true, // 入参按 DTO 类型自动转换
    }),
  );
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true, // 前端跨源携带登录态 Cookie
  });
  await app.listen(process.env.SERVER_PORT ?? 3000);
}
await bootstrap();
