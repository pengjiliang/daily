/**
 * 业务后端（server / BFF）启动入口，默认监听 3000 端口。
 * 面向前端提供鉴权、文件上传、会话与问答接口，内部再调用 ai-service（3001）。
 * 同时托管 /uploads 静态资源、全局入参校验、面向 Vite 开发服务器的 CORS。
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 头像/文档等本地上传文件的静态目录
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动去除 DTO 未声明字段
      forbidNonWhitelisted: true, // 携带未声明字段时直接报 400
      transform: true, // 入参按 DTO 类型自动转换
    }),
  );
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
