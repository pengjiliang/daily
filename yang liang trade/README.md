# 扬良贸易有限公司 — 官网 + 工具平台

Monorepo（pnpm workspaces）三端结构：
- `web/`    前端：Vue3 + Vite + Element Plus（端口 5173）
- `server/` 后端：NestJS（端口 3000）— 认证 / 产品 / AI 配置 / 聊天转发
- `ai/`     AI 服务层：NestJS + LangGraph + OpenAI 兼容 API（端口 3001）

## 一键启动
```bash
pnpm install       # 首次安装依赖
pnpm dev           # 同时启动 web / server / ai
```
- 前端：http://localhost:5173
- 后端：http://localhost:3000 （`/api/*`，vite 已代理）
- AI 服务：http://localhost:3001 （`/ai/chat` SSE）

## AI 模型配置
- 根目录 `.env` 配置（OpenAI 兼容协议）：
  - `AI_BASE_URL`：接口地址（豆包/火山/DeepSeek/OpenAI 等）
  - `AI_API_KEY`：密钥（默认占位 `your-api-key-here`，需填写真实值）
  - `AI_MODEL`：模型名，如 `doubao-seed-1-6b`
  - `AI_SYSTEM_PROMPT`：客服系统提示词
- 后台「AI 模型配置」菜单可增删改、切换默认模型，默认显示 `.env` 已有配置

## 管理员
首次进入管理后台（右上角「管理」）注册账号；账号信息保存在 `server/data/db.json`（演示存储，后续迁移 PostgreSQL）。

## 图片说明
网站图片为脚本生成的 SVG 占位素材（`web/public/images/`），后续替换真实产品图只需覆盖同名文件。重新生成：`pnpm --filter yang-liang-trade-web gen:images`
