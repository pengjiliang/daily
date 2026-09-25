import 'reflect-metadata'

// 加载项目根目录 .env（在应用模块 import 前执行）
const path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  // 放开请求体大小限制（富文本产品描述内嵌多张 base64 图片，默认 100kb 会超限）
  app.useBodyParser('json', { limit: '50mb' })
  app.useBodyParser('urlencoded', { extended: true, limit: '50mb' })
  app.enableCors()
  app.setGlobalPrefix('api')
  const port = Number(process.env.SERVER_PORT) || 3002
  await app.listen(port)
  Logger.log(`Server running at http://localhost:${port}`, 'Bootstrap')
}
bootstrap()
