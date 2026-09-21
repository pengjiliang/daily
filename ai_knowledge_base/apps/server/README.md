# 后端服务（server）

AI 知识库的后端 API 服务，基于 NestJS + TypeORM + PostgreSQL，负责用户认证、文档上传管理、会话消息，并桥接 AI 服务完成文档向量化与问答。

## 功能

- 用户认证：注册 / 登录 / 个人资料，JWT 鉴权
- 文档管理：单文件/文件夹上传、列表、下载、删除、重命名；上传后自动异步调用 AI 服务进行向量化入库
- 会话消息：创建 / 重命名 / 删除会话，发送消息时自动调用 AI 服务问答（SSE 流式返回），并携带最近 10 轮对话历史
- 消息反馈：AI 回答支持点赞 / 点踩（`Message.feedback` 字段），再次点击同一项可取消；接口 `PATCH /chat/messages/:id/feedback`
- 模型配置：GET/PUT 用户级 AI 设置（对话 / 向量模型、检索参数），向量模型变更时自动后台重建索引
- 全量重建索引：`POST /settings/reindex` 手动触发（不改动任何模型配置；向量模型变更时仍自动触发）
- 使用统计与知识图谱：`GET /stats` 返回统计面板数据（KPI、趋势、热门问题），`GET /stats/graph` 返回 3D 图谱的文档节点与相似度连线，`GET /stats/graph/entities` 返回实体级图谱的实体节点与关系连线（数据由 ai-service 索引后写入）
- 静态资源：`/uploads` 托管头像与文档文件

## 技术栈

- NestJS 12 + TypeScript
- TypeORM + PostgreSQL
- Passport + JWT 认证
- Multer 文件上传

## 环境变量

统一在 monorepo 根目录 `ai_knowledge_base/.env` 中配置（本服务不再单独维护 `.env`）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `SERVER_PORT` | 本服务监听端口 | `3000` |
| `DATABASE_HOST` | PostgreSQL 地址 | `localhost` |
| `DATABASE_PORT` | PostgreSQL 端口 | `5432` |
| `DATABASE_USER` | 数据库用户 | `postgres` |
| `DATABASE_PASSWORD` | 数据库密码 | `postgres` |
| `DATABASE_NAME` | 数据库名 | `ai_knowledge_base` |
| `NODE_ENV` | 运行环境；非 `production` 时自动同步表结构 | 空 |
| `JWT_SECRET` | JWT 签名密钥 | `your_secret_key` |
| `JWT_EXPIRES_IN` | Token 有效期 | `7d` |
| `AI_SERVICE_URL` | AI 服务地址（需与 `AI_SERVICE_PORT` 一致） | `http://localhost:3001` |
| `AI_SERVICE_PORT` | AI 服务监听端口（由 ai-service 读取） | `3001` |

以下 AI 配置用于「模型配置」设置页回显默认值（用户未单独配置时展示），
**与 ai-service 共用根 `.env` 中的同一份值**：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI 兼容 API 的 Key | 空 |
| `OPENAI_BASE_URL` | API 地址（如火山方舟） | 空 |
| `OPENAI_EMBEDDING_MODEL` | Embedding 模型 | `text-embedding-ada-002` |
| `OPENAI_CHAT_MODEL` | 对话模型 | `gpt-4o-mini` |
| `AI_TEMPERATURE` | 生成温度 | `0` |
| `AI_TOP_K` | 检索 Top K | `8` |
| `AI_KEYWORD_TOP_K` | 关键词检索 Top K | `8` |
| `AI_MIN_SCORE` | 最小相似度阈值 | `0.3` |
| `AI_RERANK_TOP_N` | Rerank 取前 N | `5` |

## 启动

推荐在 monorepo 根目录（`ai_knowledge_base`）执行一键启动：

```bash
pnpm dev
```

也可以单独启动本服务：

```bash
cd apps/server
pnpm dev        # 开发模式（watch）
pnpm start:prod # 生产模式（需先 pnpm build）
```

服务默认监听 `http://localhost:3000`，并允许 `http://localhost:5173`（前端）跨域访问。

## 接口

除健康检查外，接口均需在请求头携带 `Authorization: Bearer <token>`：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查（公开） |
| `POST` | `/auth/register` | 注册（公开） |
| `POST` | `/auth/login` | 登录，返回 `access_token`（公开） |
| `GET` | `/auth/profile` | 当前用户信息 |
| `POST` | `/upload/avatar` | 上传头像（图片，≤5MB） |
| `POST` | `/upload/document` | 上传文档（≤20MB，自动触发向量化） |
| `GET` | `/upload/documents` | 文档列表 |
| `GET` | `/upload/document/:id/download` | 下载文档 |
| `PATCH` | `/upload/document/:id` | 重命名文档 |
| `DELETE` | `/upload/document/:id` | 删除文档 |
| `POST` | `/chat/conversations` | 创建会话 |
| `GET` | `/chat/conversations` | 会话列表 |
| `PATCH` | `/chat/conversations/:id` | 重命名会话 |
| `DELETE` | `/chat/conversations/:id` | 删除会话 |
| `GET` | `/chat/conversations/:id/messages` | 消息列表 |
| `POST` | `/chat/conversations/:id/messages` | 发送消息并获取 AI 回答（SSE 流式） |
| `PATCH` | `/chat/messages/:id/feedback` | 设置消息反馈（`like` / `dislike`，传 `null` 取消） |
| `GET` | `/settings` | 当前用户 AI 设置回显 |
| `PUT` | `/settings` | 保存 AI 设置，向量模型变更时触发重建索引 |
| `POST` | `/settings/reindex` | 手动触发全量重建索引（不改动模型配置） |
| `GET` | `/stats` | 使用统计（KPI、近 14 天趋势、热门问题 Top10） |
| `GET` | `/stats/graph` | 知识图谱数据（文档节点 + 相似度连线） |
| `GET` | `/stats/graph/entities` | 实体级知识图谱数据（实体节点 + 关系连线） |

## 常用脚本

```bash
pnpm build       # 编译
pnpm start:dev   # 开发模式
pnpm lint        # 代码检查（oxlint）
pnpm format      # 代码格式化（Prettier）
```

## 目录结构

```text
src/
├── main.ts                 # 入口：静态资源、CORS、全局校验管道
├── app.module.ts           # 根模块
├── app.controller.ts       # 健康检查
├── auth/                   # 注册 / 登录 / JWT 鉴权
├── users/                  # 用户
├── upload/                 # 文件上传与文档管理
├── chat/                   # 会话与消息，桥接 AI 服务
├── settings/               # AI 设置回显与保存（模型配置）
├── stats/                  # 使用统计与知识图谱数据
└── config/configuration.ts # 环境变量读取
```

上传的文件保存在 `apps/server/uploads/avatars` 与 `apps/server/uploads/documents` 目录。
