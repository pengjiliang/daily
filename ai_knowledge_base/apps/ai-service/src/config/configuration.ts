/**
 * ai-service 配置工厂：把环境变量整理为结构化配置（端口、PostgreSQL 连接、OpenAI 兼容模型配置）。
 * 通过 NestJS ConfigService 以 configService.get('openai.chatModel') 等方式读取。
 * OPENAI_BASE_URL 指向 OpenAI 兼容网关（如火山方舟/豆包），为空时使用官方地址。
 */
export default () => ({
  port: Number.parseInt(process.env.AI_SERVICE_PORT ?? '3001', 10),
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? '',
    name: process.env.DATABASE_NAME ?? 'ai_knowledge_base',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? '',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-ada-002',
    chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  },
  // 检索/生成参数默认值：与 ask.service 导出的常量保持一致
  ai: {
    temperature: Number.parseFloat(process.env.AI_TEMPERATURE ?? '0'),
    topK: Number.parseInt(process.env.AI_TOP_K ?? '8', 10),
    keywordTopK: Number.parseInt(process.env.AI_KEYWORD_TOP_K ?? '8', 10),
    minScore: Number.parseFloat(process.env.AI_MIN_SCORE ?? '0.3'),
    rerankTopN: Number.parseInt(process.env.AI_RERANK_TOP_N ?? '5', 10),
  },
});
