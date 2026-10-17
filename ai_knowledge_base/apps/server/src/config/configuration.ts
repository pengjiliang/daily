/**
 * server 配置工厂：把环境变量整理为结构化配置。
 * 包含服务端口、PostgreSQL 连接（开发环境默认开启 synchronize）、
 * JWT 密钥与有效期、ai-service 的内部调用地址。
 */
import { assertInternalToken, assertJwtSecret } from '../auth/assert-secrets.js';

export default () => ({
  port: Number.parseInt(process.env.SERVER_PORT ?? '3000', 10),
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    name: process.env.DATABASE_NAME ?? 'ai_knowledge_base',
    // 数据库结构变更统一走迁移（migrations/ 目录）；启动时自动执行未应用的迁移。
    // DB_SYNC=true 仅用于开发环境快速同步实体字段，生产应保持关闭（默认 false）。
    synchronize: process.env.DB_SYNC ? process.env.DB_SYNC === 'true' : false,
    migrationsRun: process.env.DB_MIGRATIONS_RUN ? process.env.DB_MIGRATIONS_RUN === 'true' : true,
  },
  jwt: {
    secret: assertJwtSecret(process.env.JWT_SECRET),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  aiService: {
    // 文档索引、问答（含 SSE）都转发到该地址（ai-service 默认只绑 127.0.0.1）
    url: process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:3001',
    internalToken: assertInternalToken(process.env.INTERNAL_AI_TOKEN),
  },
  // OpenAI 兼容模型默认配置：与 ai-service 保持一致，供「设置页」回显默认值（用户未配置时展示）
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? '',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-ada-002',
    chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  },
  // 检索/生成参数默认值：与 ai-service 的 ask.service 常量保持一致
  ai: {
    temperature: Number.parseFloat(process.env.AI_TEMPERATURE ?? '0'),
    topK: Number.parseInt(process.env.AI_TOP_K ?? '8', 10),
    keywordTopK: Number.parseInt(process.env.AI_KEYWORD_TOP_K ?? '8', 10),
    minScore: Number.parseFloat(process.env.AI_MIN_SCORE ?? '0.3'),
    rerankTopN: Number.parseInt(process.env.AI_RERANK_TOP_N ?? '5', 10),
  },
});
