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

## 核心不变量（项目不维护自动化测试，改动时请人工核对）

> 验证方式：每次改动让 LLM 自查 + 手动走通真实链路（启动 `pnpm dev` 后逐项验证）。
> 以下三个不变量是历史测试覆盖过的关键契约，改动相关代码时请勿破坏：

1. **分数校准**（`apps/ai-service/src/ai/ask.service.ts` 的 `relativeSimilarity`）：原始 Embedding 相似度按本次检索最强匹配归一化——最强匹配固定返回 `0.9`，其余按比例平滑缩放；`score` 为原始相似度、`similarity` 为校准后相关度，两者一并返回给前端（前端展示"相关度 xx%（原始 xx%）"）。

2. **检索 SQL 参数化**（`apps/ai-service/src/ai/ask.service.ts` 的 `retrieve`）：embedding 向量必须通过 `$1` 参数传入（`embedding::vector <=> $1::vector`），禁止字符串拼接；`LIMIT` 仅允许常量（`TOP_K`）内联，不允许用户输入进入 SQL。

3. **SSE 流式协议**（`apps/web` ↔ `apps/server` ↔ `apps/ai-service`）：帧格式为 `event: <事件名>\ndata: <JSON>\n\n`；事件包括 `sources`（检索片段数组）、`token`（回答增量字符串）、`done`（最终 `AskResult`）、`error`（错误信息）；客户端断开时服务端应中止上游请求并尽力保留已生成的部分回答。

## 环境变量

- `apps/server/.env`：数据库（PostgreSQL/pgvector）、JWT、AI 服务地址
- `apps/ai-service/.env`：数据库、OpenAI 兼容 API（豆包/火山方舟）

> 提示：`.env` 已在 `.gitignore` 中忽略，请勿提交到仓库。