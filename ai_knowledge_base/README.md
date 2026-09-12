# AI 知识库（RAG）— ai_knowledge_base

基于 Vue3 + NestJS + pgvector + LangChain 的 RAG 知识库项目（pnpm monorepo）。

## 环境要求

- Node.js ≥ 18（当前环境在 Node 26 上验证）
- pnpm ≥ 10（推荐与根目录 `package.json` 中 `packageManager` 保持一致）

## 安装依赖

```bash
pnpm install
```

## 一键启动（前端 + 后端 + AI 服务）

在项目根目录（`ai_knowledge_base`）执行：

```bash
pnpm dev
```

该命令会在 `apps/web`、`apps/server`、`apps/ai-service` 三个端并行启动开发服务。

启动后访问地址：

| 服务 | 地址 |
| :--- | :--- |
| Web 前端 | http://localhost:5173 |
| 后端 API | http://localhost:3000 |
| AI 服务 | http://localhost:3001 |

## 目录结构

- `apps/web`：前端（Vue3 + Vite + Element Plus）
- `apps/server`：后端 API（NestJS + TypeORM + pgvector，含 SSE 流式转发）
- `apps/ai-service`：AI 服务（NestJS + LangGraph，文档向量化与 RAG 问答）
- `packages/shared`：跨端共享的纯类型包（`RetrievedChunk`、`AskResult` 等前后端契约，编译期擦除、无运行时依赖）

## 环境变量

- `apps/server/.env`：数据库（PostgreSQL/pgvector）、JWT、AI 服务地址
- `apps/ai-service/.env`：数据库、OpenAI 兼容 API（豆包/火山方舟）

> 提示：`.env` 已在 `.gitignore` 中忽略，请勿提交到仓库。