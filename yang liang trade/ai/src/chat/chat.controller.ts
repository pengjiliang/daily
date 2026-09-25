import { Body, Controller, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import { runChatGraph } from './chat-graph'
import { StreamQueue } from './stream-queue'

@Controller('ai/chat')
export class ChatController {
  @Post()
  async chat(
    @Body() body: { message: string; history?: { role: string; text: string }[]; modelConfig?: any },
    @Res() res: Response
  ) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const queue = new StreamQueue()
    const run = runChatGraph({
      question: body.message,
      history: body.history || [],
      modelConfig: body.modelConfig || {},
      queue
    })

    // 异常时也结束队列，避免客户端挂起
    run.catch((e) => {
      queue.push(`\n[系统错误] ${e?.message || '未知错误'}`)
      queue.end()
    })

    for await (const chunk of queue) {
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`)
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  }
}
