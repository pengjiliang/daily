# 日常开发项目仓库 (Daily)

欢迎来到我的个人日常开发仓库。这里存放了我平时开发的各类独立项目，各个项目之间保持独立，互不干扰。你需要进入对应的项目文件夹进行启动。

## 📂 项目结构

| 目录 | 简介 |
| :--- | :--- |
| `ai_knowledge_base/` | 基于 RAG 的 AI 知识库系统 |
| `yang liang trade/` | 扬良贸易有限公司官网 + 贸易工具平台 |

> 注：每个项目都是独立的 pnpm monorepo，拥有自己的 `package.json` 和 `pnpm-workspace.yaml`，需进入其对应目录运行命令。

---

## 🚀 项目一：AI 知识库 (ai_knowledge_base)

### ✨ 项目简介
基于 RAG (检索增强生成) 技术构建的知识库问答系统。支持单个文档与整个文件夹上传（保留相对路径，自动过滤白名单格式）、SSE 流式问答、混合检索（向量 + pg_trgm 关键词 + RRF 融合）、语义缓存、多轮对话记忆增强、相关追问建议、RAG 评估与回归看板，以及文档/实体双模式 3D 知识图谱。

### 🛠️ 技术栈
- **前端**：Vue 3 + Vite + Element Plus + Pinia
- **后端**：NestJS + TypeORM + PostgreSQL + pgvector
- **AI 服务**：NestJS + LangGraph + OpenAI 兼容 API（豆包/火山）

### 📖 快速开始
```bash
cd ai_knowledge_base
pnpm install
pnpm dev
```

环境变量位于项目根目录 `.env`（数据库、鉴权、AI 模型等配置，已在 .gitignore 中忽略）。

启动后访问地址：

| 服务 | 地址 |
| :--- | :--- |
| Web 前端 | http://localhost:5173 |
| 后端 API | http://localhost:3000 |
| AI 服务 | http://localhost:3001 |

> 详细说明见 [ai_knowledge_base/README.md](ai_knowledge_base/README.md)；Docker 私有化部署见其「Docker 部署」章节。

---

## 🏢 项目二：扬良贸易 (yang liang trade)

### ✨ 项目简介
扬良贸易有限公司官网 + 贸易工具平台（pnpm monorepo 三端结构），包含前台官网（产品展示、AI 智能客服）、后台管理（产品/线索/邮件/海关数据等）与 AI 服务层。

### 🛠️ 技术栈
- **前端**：Vue3 + Vite + Element Plus
- **后端**：NestJS + TypeORM + PostgreSQL
- **AI 服务**：NestJS + LangGraph + OpenAI 兼容 API

### 📖 快速开始
```bash
cd "yang liang trade"
pnpm install
pnpm dev
```

环境变量位于项目根目录 `.env`（端口、数据库、AI 模型、代理等配置）。

启动后访问地址：

| 服务 | 地址 |
| :--- | :--- |
| Web 前端 | http://localhost:5174 |
| 后端 API | http://localhost:3002 |
| AI 服务 | http://localhost:3003 |

> 详细说明见 [yang liang trade/README.md](yang liang trade/README.md)。
