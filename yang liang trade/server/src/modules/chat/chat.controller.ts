import { Body, Controller, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ChatService } from './chat.service'

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  async chat(@Body() body: { message: string; history?: { role: string; text: string }[] }, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const modelConfig = await this.chatService.getActiveConfig()
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:3003'
    const payload = { message: body.message, history: body.history || [], modelConfig }

    try {
      const upstream = await fetch(`${aiUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text()
        res.write(`data: ${JSON.stringify({ error: text || 'AI 服务返回异常' })}\n\n`)
        res.end()
        return
      }
      const reader = upstream.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(Buffer.from(value))
      }
      res.end()
    } catch {
      res.write(`data: ${JSON.stringify({ error: '无法连接 AI 服务，请确认 ai 服务已启动且模型配置正确' })}\n\n`)
      res.end()
    }
  }
}

