export default () => ({
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    name: process.env.DATABASE_NAME ?? 'ai_knowledge_base',
    synchronize: process.env.NODE_ENV !== 'production',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'your_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  aiService: {
    url: process.env.AI_SERVICE_URL ?? 'http://localhost:3001',
  },
});
