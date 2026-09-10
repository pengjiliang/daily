# AI 服务（ai-service）

AI 知识库的问答与文档向量化服务，基于 NestJS + LangChain（LangGraph）+ PostgreSQL/pgvector 实现 RAG 检索增强生成。

## 功能

- 文档解析：支持 PDF、DOCX、XLSX/XLS、CSV、MD、TXT 及常见图片（OCR）等格式，自动处理 UTF-8/GBK 等中文编码
- 文档向量化：文本分块后调用 Embedding 模型生成向量，存入 PostgreSQL（pgvector）的 `document_chunks` 表
- 智能问答：基于 LangGraph 的 RAG 流程（检索 → 生成），优先使用知识库内容回答，并补充模型自身知识
- 引用溯源：回答附带回源片段（内部知识库 + 外部资料），便于前端展示引用来源

## 技术栈

- NestJS 12 + TypeScript
- LangChain / LangGraph（RAG 编排）
- TypeORM + PostgreSQL + pgvector
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
| `POST` | `/ai/ask` | 知识库问答（body：`question`、可选 `conversationId`、`history`） |

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
