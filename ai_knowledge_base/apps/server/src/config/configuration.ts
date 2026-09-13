/**
 * server 配置工厂：把环境变量整理为结构化配置。
 * 包含服务端口、PostgreSQL 连接（开发环境默认开启 synchronize）、
 * JWT 密钥与有效期、ai-service 的内部调用地址。
 */
export default () => ({
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    name: process.env.DATABASE_NAME ?? 'ai_knowledge_base',
    // 非生产环境允许 TypeORM 自动建表/同步字段
    synchronize: process.env.NODE_ENV !== 'production',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'your_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  aiService: {
    // 文档索引、问答（含 SSE）都转发到该地址
    url: process.env.AI_SERVICE_URL ?? 'http://localhost:3001',
  },
});
