import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { retrieveKnowledge, companyIntro } from '../knowledge/products'
import { streamLLM, LlmConfig, ChatMessage } from '../llm/llm.service'
import { StreamQueue } from './stream-queue'

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<string>,
  history: Annotation<{ role: string; text: string }[]>,
  systemPrompt: Annotation<string>,
  queue: Annotation<StreamQueue | null>
})

export interface GraphParams {
  question: string
  history: { role: string; text: string }[]
  modelConfig: LlmConfig & { systemPrompt?: string }
  queue: StreamQueue
}

// LangGraph 图：检索产品知识（RAG）→ 大模型流式生成
export async function runChatGraph(params: GraphParams) {
  const graph = new StateGraph(StateAnnotation)
    .addNode('retrieve', async (state) => ({
      context: retrieveKnowledge(state.question)
    }))
    .addNode('generate', async (state) => {
      await streamAnswer(state, params.modelConfig)
      return {}
    })
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', END)
    .compile()

  await graph.invoke({
    question: params.question,
    history: params.history,
    systemPrompt: params.modelConfig.systemPrompt || '',
    queue: params.queue
  })
}

async function streamAnswer(
  state: { question: string; context: string; history: { role: string; text: string }[]; systemPrompt: string; queue: StreamQueue | null },
  modelConfig: LlmConfig & { systemPrompt?: string }
) {
  const { question, context, history, systemPrompt, queue } = state
  if (!queue) throw new Error('stream queue missing')

  const messages: ChatMessage[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  if (context) messages.push({ role: 'system', content: `以下是可用的公司产品资料（仅供参考，若与问题无关请忽略）：\n${context}` })
  else messages.push({ role: 'system', content: companyIntro })
  for (const m of history || []) messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text })
  messages.push({ role: 'user', content: question })

  try {
    for await (const delta of streamLLM(messages, modelConfig)) {
      queue.push(delta)
    }
  } catch (e: any) {
    queue.push(`\n[AI 服务提示] ${e?.message || '模型调用失败'}。请检查根目录 .env 或后台「AI 模型配置」。`)
  }
  queue.end()
}
