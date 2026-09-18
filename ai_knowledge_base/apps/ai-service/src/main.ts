/**
 * AI 微服务（ai-service）启动入口，默认监听 3001 端口。
 * 职责：文档向量化索引、RAG 混合检索与问答（含 SSE 流式），供 server 端内部调用。
 * 全局启用 ValidationPipe：自动剥离 DTO 未声明字段、拒绝多余字段、完成类型转换。
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动去除 DTO 中未声明的属性
      forbidNonWhitelisted: true, // 出现未声明属性时直接报 400
      transform: true, // 按 DTO 类型自动转换入参（如 string → number）
    }),
  );
  await app.listen(process.env.AI_SERVICE_PORT ?? 3001);
}
await bootstrap();
