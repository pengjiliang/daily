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

## 检索链路（混合检索）

知识库问答的检索分 5 步（`apps/ai-service/src/ai/ask.service.ts`）：

1. **查询改写**（短查询 ≤ `QUERY_REWRITE_THRESHOLD`=4 字符时）：如"彭"→"彭基良"，由 LLM 扩展为完整表达——碎片/简称查询直接做 embedding 是语义噪声；
2. **多路召回**：
   - 向量语义路：Embedding cosine 相似度（pgvector），取 `TOP_K`=8，过滤相似度 ≤ `MIN_SCORE`(0.3) 的噪声；
   - 关键词字面路：pg_trgm 子串匹配（`ILIKE '%term%'`），原始查询与改写查询各一路、各取 `KEYWORD_TOP_K`=8——保证"彭/彭基/基良"这类碎片能命中含"彭基良"的文档（纯向量检索只认语义、不认字，这是它补的短板）；
3. **RRF 融合**：两路结果按排名融合（`1/(k+rank+1)`，k=`RRF_K`=60），不做分数阈值（两种分数不可比），每文件保留最优片段；
4. **LLM 重排**：只保留与问题真正相关的片段（`RERANK_TOP_N`=5），关键词路的无关命中在此剔除；
5. **分数校准**：`relativeSimilarity` 按最强匹配归一化后展示（`score` 原始 / `similarity` 相关度）。

## 核心不变量（项目不维护自动化测试，改动时请人工核对）

> 验证方式：每次改动让 LLM 自查 + 手动走通真实链路（启动 `pnpm dev` 后逐项验证）。
> 以下三个不变量是历史测试覆盖过的关键契约，改动相关代码时请勿破坏：

1. **分数校准**（`apps/ai-service/src/ai/ask.service.ts` 的 `relativeSimilarity`）：按本次检索保留片段的最强匹配归一化——最强匹配固定返回 `0.9`，其余按比例平滑缩放；`score` 为原始相似度、`similarity` 为校准后相关度，两者一并返回给前端（前端展示"相关度 xx%（原始 xx%）"）。注意混合检索下 `score` 可能来自向量 cosine 相似度或关键词 trigram 相似度（关键词路短词为 0 时取下限 `MIN_SCORE`），仅作展示基准。

2. **检索 SQL 参数化**（`apps/ai-service/src/ai/ask.service.ts` 的 `retrieve` / `keywordSearch`）：所有用户输入（embedding 向量、关键词 term）必须通过 `$1` 参数传入（`embedding::vector <=> $1::vector`、`content ILIKE '%' || $1 || '%'`、`similarity(content, $1)`），禁止字符串拼接；`LIMIT` 仅允许常量（`TOP_K` / `KEYWORD_TOP_K`）内联，不允许用户输入进入 SQL。

3. **SSE 流式协议**（`apps/web` ↔ `apps/server` ↔ `apps/ai-service`）：帧格式为 `event: <事件名>\ndata: <JSON>\n\n`；事件包括 `sources`（检索片段数组）、`token`（回答增量字符串）、`done`（最终 `AskResult`）、`error`（错误信息）；客户端断开时服务端应中止上游请求并尽力保留已生成的部分回答。

## 环境变量

- `apps/server/.env`：数据库（PostgreSQL/pgvector）、JWT、AI 服务地址
- `apps/ai-service/.env`：数据库、OpenAI 兼容 API（豆包/火山方舟）

> 提示：`.env` 已在 `.gitignore` 中忽略，请勿提交到仓库。