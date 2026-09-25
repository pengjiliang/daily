// 流式队列：LLM 节点推送增量，Controller 异步消费并转发 SSE
export class StreamQueue {
  private items: string[] = []
  private waiters: (() => void)[] = []
  private ended = false

  push(s: string) {
    if (this.ended) return
    this.items.push(s)
    this.waiters.shift()?.()
  }

  end() {
    this.ended = true
    this.waiters.shift()?.()
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.items.length) yield this.items.shift()
      else if (this.ended) return
      else await new Promise<void>((r) => this.waiters.push(r))
    }
  }
}
