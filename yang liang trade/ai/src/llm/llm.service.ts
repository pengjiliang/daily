import OpenAI from 'openai'

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam

export interface LlmConfig {
  baseURL?: string
  apiKey?: string
  model?: string
}

// 使用 OpenAI 兼容协议流式调用（豆包 / 火山引擎 / DeepSeek / OpenAI 等）
export async function* streamLLM(messages: ChatMessage[], cfg: LlmConfig) {
  const baseURL = cfg.baseURL || process.env.AI_BASE_URL
  const apiKey = cfg.apiKey || process.env.AI_API_KEY
  const model = cfg.model || process.env.AI_MODEL

  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('未配置有效的 API Key：请在根目录 .env 或后台「AI 模型配置」中填写')
  }
  if (!baseURL) throw new Error('未配置 AI_BASE_URL')

  const client = new OpenAI({ baseURL, apiKey })
  const stream = await client.chat.completions.create({ model, messages, stream: true })

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) yield delta
  }
}
