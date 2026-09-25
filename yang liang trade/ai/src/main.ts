import 'reflect-metadata'

// 加载项目根目录 .env
const path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { loadKnowledge } from './knowledge/products'

async function bootstrap() {
  // 从数据库加载产品资料（三端并行启动时 server 可能尚未建表/seed，轻量重试）
  for (let i = 0; i < 5; i++) {
    const ok = await loadKnowledge().then(() => true).catch(() => false)
    if (ok) break
    await new Promise((r) => setTimeout(r, 2000))
  }

  const app = await NestFactory.create(AppModule)
  app.enableCors()
  const port = Number(process.env.AI_PORT) || 3003
  await app.listen(port)
  Logger.log(`AI service running at http://localhost:${port}`, 'Bootstrap')
}
bootstrap()
