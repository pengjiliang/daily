# AI 服务（ai-service）

AI 知识库的问答与文档向量化服务，基于 NestJS + LangChain（LangGraph）+ PostgreSQL/pgvector 实现 RAG 检索增强生成。

## 功能

- 文档解析：支持 PDF、DOCX、XLSX/XLS、CSV、MD、TXT 及常见图片（OCR）等格式，自动处理 UTF-8/GBK 等中文编码
- 文档向量化：文本分块后调用 Embedding 模型生成向量，存入 PostgreSQL（pgvector）的 `document_chunks` 表
- 智能问答：基于 LangGraph 的 RAG 流程（检索 → 生成），优先使用知识库内容回答，并补充模型自身知识
- 混合检索：向量语义召回（pgvector cosine）+ 关键词字面子串召回（pg_trgm `ILIKE`），RRF 排名融合后由 LLM 重排（`RERANK_TOP_N`）；短碎片查询（≤4 字符，如"彭"）先由 LLM 改写扩展（如"彭基良"）再检索
- 相关度重排：多路召回候选片段由 LLM 二次判断相关性，只保留真正相关的片段，关键词路的无关命中在此剔除
- 分数校准：原始 Embedding 相似度区间窄（豆包约 0.30~0.40）且绝对分数易误导，按本次检索的最强匹配归一化（`relativeSimilarity`）得到直观的“真实相似度”，最强匹配显示 90%，其余平滑缩放，两个分数一并返回给前端展示
- 引用溯源：回答附带回源片段（内部知识库 + 外部资料），便于前端展示引用来源
- 用户隔离：检索 SQL 按 `uploaderId` 过滤，每个用户只能检索到自己上传的文档（`userId` 由 server 端从 JWT 透传）
- 文档生命周期：删除文档时由 server 调用清理向量分块（`DELETE /ai/document/:uploadFileId`），检索 SQL 亦会过滤已删除文件的孤儿分块

## 技术栈

- NestJS 12 + TypeScript
- LangChain / LangGraph（RAG 编排）
- TypeORM + PostgreSQL + pgvector + pg_trgm
- OpenAI 兼容 API（默认豆包/火山方舟，也可配置为 OpenAI）

## 环境变量

在 `apps/ai-service/.env` 中配置（也可使用系统环境变量）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 服务监听端口 | `3001` |
| `DATABASE_HOST` | PostgreSQL 地址 | `localhost` |
| `DATABASE_PORT` | PostgreSQL 端口 | `5432` |
| `DATABASE_USER` | 数据库用户 | `postgres` |
| `DATABASE_PASSWORD` | 数据库密码 | 空 |
| `DATABASE_NAME` | 数据库名 | `ai_knowledge_base` |
| `OPENAI_API_KEY` | OpenAI 兼容 API 的 Key | 空 |
| `OPENAI_BASE_URL` | API 地址（如火山方舟） | 空 |
| `OPENAI_EMBEDDING_MODEL` | Embedding 模型 | `text-embedding-ada-002` |
| `OPENAI_CHAT_MODEL` | 对话模型 | `gpt-4o-mini` |

> 服务启动时会自动启用 pgvector 扩展并同步数据表结构，数据库需为 PostgreSQL（建议安装 pgvector 插件）。

## 启动

推荐在 monorepo 根目录（`ai_knowledge_base`）执行一键启动：

```bash
pnpm dev
```

也可以单独启动本服务：

```bash
cd apps/ai-service
pnpm dev        # 开发模式（watch）
pnpm start:prod # 生产模式（需先 pnpm build）
```

服务默认监听 `http://localhost:3001`。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `POST` | `/ai/index-document` | 文档向量化入库（body：`uploadFileId`、`filePath`、`originalName`、`mimeType`） |
| `POST` | `/ai/ask` | 知识库问答（body：`question`、`userId`、可选 `conversationId`、`history`） |
| `POST` | `/ai/ask/stream` | SSE 流式问答（body：`question`、`userId`、可选 `conversationId`、`history`；事件：`sources`、`token`、`done`、`error`） |

## 常用脚本

```bash
pnpm build       # 编译
pnpm start:dev   # 开发模式
pnpm test        # 单元测试
pnpm test:e2e    # e2e 测试
pnpm lint        # 代码检查（oxlint）
pnpm format      # 代码格式化（Prettier）
```

## 目录结构

```text
src/
├── main.ts                       # 入口：全局校验管道、启动监听
├── app.module.ts                 # 根模块：配置、数据库连接
├── app.controller.ts             # 健康检查
├── ai/
│   ├── ai.controller.ts          # /ai 路由
│   ├── ai.module.ts
│   ├── ask.service.ts            # 问答：检索 + 生成
│   ├── document-index.service.ts # 文档解析、分块、向量化
│   ├── openai-model.provider.ts  # LLM / Embedding 模型封装
│   ├── dto/ai.dto.ts             # 请求参数校验
│   └── langgraph/rag.graph.ts    # RAG 状态图
├── config/configuration.ts       # 环境变量读取
├── entities/document-chunk.entity.ts
└── services/database-initialization.service.ts
```
