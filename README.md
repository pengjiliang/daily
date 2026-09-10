# 日常开发项目仓库 (Daily)

欢迎来到我的个人日常开发仓库。这里存放了我平时开发的各类独立项目，各个项目之间保持独立，互不干扰。你需要进入对应的项目文件夹进行启动。

## 📂 项目结构

| 目录 | 简介 |
| :--- | :--- |
| `ai_knowledge_base/` | 基于 RAG 的 AI 知识库系统 |
| `my_blog/` | （预留）个人博客系统 |

> 注：每个项目都有自己独立的 `package.json` 和 `pnpm-workspace.yaml`，需进入其对应目录运行命令。

---

## 🚀 核心项目：AI 知识库 (ai_knowledge_base)

### ✨ 项目简介
这是一个基于 RAG (检索增强生成) 技术构建的知识库问答系统。支持上传多格式文档，通过向量化存储，实现基于内容的精准问答，并清晰展示内部知识库与外部资料的引用来源。

### 🛠️ 技术栈
- **前端**：Vue 3 + Vite + Element Plus + Pinia
- **后端**：NestJS + TypeORM + PostgreSQL + pgvector
- **AI 服务**：NestJS + LangGraph + OpenAI 兼容 API（如豆包/火山）

### 📖 快速开始
进入项目目录：
```bash
cd ai_knowledge_base


pnpm install

环境变量位于 apps/server/.env 和 apps/ai-service/.env（按需修改数据库与 AI 模型配置）


启动项目（一条命令同时启动前端、后端和 AI 服务）：
pnpm dev

启动后访问地址：

Web 前端: http://localhost:5173

后端 API: http://localhost:3000

AI 服务: http://localhost:3001

