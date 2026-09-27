# 扬良贸易有限公司 — 官网 + 贸易工具平台

Monorepo（pnpm workspaces）三端结构：

| 目录 | 说明 | 端口 |
| ---- | ---- | ---- |
| web/ | 前端：Vue3 + Vite + Element Plus | 5174 |
| server/ | 后端：NestJS + TypeORM + PostgreSQL | 3002 |
| ai/ | AI 服务层：NestJS + LangGraph + OpenAI 兼容 API | 3003 |

## 环境要求

- Node.js 20+、pnpm 10+
- PostgreSQL（数据库 yang_liang_base，连接信息见根目录 .env 的 DATABASE_*）

## 一键启动

```bash
pnpm install   # 首次安装依赖
pnpm dev       # 同时启动 web / server / ai
```

- 前端：http://localhost:5174
- 后端：http://localhost:3002（/api/*，vite 已代理）
- AI 服务：http://localhost:3003

端口通过根目录 .env 的 WEB_PORT / SERVER_PORT / AI_PORT 修改。

## 数据库

- PostgreSQL 数据库 yang_liang_base，首次启动自动建表
- 管理员账号：首次进入后台注册页注册（账号存 PostgreSQL）

## AI 模型配置

根目录 .env 配置（OpenAI 兼容协议，支持豆包/火山引擎/DeepSeek/OpenAI 等）：

- AI_BASE_URL：OpenAI 兼容接口地址
- AI_API_KEY：密钥
- AI_MODEL：模型名
- AI_SYSTEM_PROMPT：客服系统提示词

后台「AI 模型配置」菜单可增删改、切换默认模型，默认显示 .env 已有配置。客服回复基于公司产品资料做检索增强（RAG），产品资料从数据库读取。

## 功能清单

### 前台网站

- 首页（轮播、热卖产品）、产品中心、产品详情、关于我们、联系我们
- 联系页含 WhatsApp 直达入口；导航栏 WhatsApp / Instagram / Facebook 快捷联系按钮
- AI 智能客服助手（右下角对话）

### 后台管理（/admin，需登录）

| 菜单 | 说明 |
| ---- | ---- |
| 仪表盘 | 运营概览、最近抓取线索（分页） |
| 产品管理 | 产品增删改查、批量删除、Alibaba 店铺产品导入（自动识别分类）、富文本详情（含图片/表格）、图片上传 |
| AI 模型配置 | 切换/管理 AI 模型 |
| 线索管理 | 按关键词抓取同行业店铺联系方式（Google Places / OpenStreetMap 免费 / 黄页三模式 + 演示数据）；结果支持 WhatsApp / Facebook / 邮件群发 |
| 邮件客户端 | 后台登录 Foxmail 邮箱，在线直接发开发信 |
| 热卖趋势 | 医疗器械热卖关键词趋势分析（ECharts 图表，演示/真实数据源双模式） |
| 海关数据 | 按客户网址查询近一年进出口数据（演示/富通天下双模式） |
| 留言管理 | 前台联系表单留言 |

## 抓取与群发（线索管理）

- 数据源：
  - Google Places API：真实数据，需在 .env 配置 GOOGLE_PLACES_API_KEY
  - OpenStreetMap Overpass：免费、无需 Key、合规
  - 黄页（ypk）：按行业类型抓取
  - 演示数据：默认模式，无需配置
- 群发：WhatsApp / Facebook（个人）/ 邮件，支持按批次群发（默认每批 10 条，可扩展）
- 出网代理：本地经 Clash 访问 Google 时，在 .env 配置 HTTPS_PROXY（如 http://127.0.0.1:7897）

## 图片说明

产品图片存放于 web/public/images/products/，数据库 image 字段引用对应文件；替换真实产品图只需覆盖同名文件。

## 目录结构

```
├── web/      前端（Vue3 + Vite + Element Plus）
├── server/   后端（NestJS + TypeORM + PostgreSQL）
├── ai/       AI 服务（NestJS + LangGraph + OpenAI 兼容 API）
├── .env      环境变量（端口/数据库/AI 模型/代理）
└── pnpm-workspace.yaml
```
