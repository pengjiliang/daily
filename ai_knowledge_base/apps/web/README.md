# 前端（web）

AI 知识库的 Web 前端，基于 Vue3 + Vite + Element Plus + Pinia，负责登录鉴权、文档管理、SSE 流式问答、模型配置、使用统计与 3D 知识图谱等全部交互界面。

## 功能

- 用户认证：注册 / 登录，JWT 持久化到 `localStorage`，刷新自动恢复登录态；401 自动登出
- 文档管理：单文件/文件夹上传（保留相对路径）、列表、下载、删除、重命名；来源引用可点击定位到左侧文档
- 文档预览：图片 / PDF / Word / Excel / CSV / Markdown / TXT 在右侧内容区直接预览，无法解析的格式提示下载
- 智能问答：基于 SSE 的流式问答，支持停止生成、引用来源展示（内部知识库 + 外部资料）
- 模型配置（右侧主区内容页）：对话提供方（OpenAI 兼容 / Anthropic）、向量模型、温度与检索参数，用户级保存
- 使用统计（右侧主区内容页）：KPI 总览 + 近 14 天提问趋势（ECharts）+ 热门问题 Top10
- 知识图谱（右侧主区内容页）：基于 three.js 的 3D 文档关系可视化，拖拽/缩放/聚焦

## 技术栈

- Vue3 + TypeScript + Vite
- Element Plus（中文语言包）+ Element Plus 图标
- Pinia 状态管理（`stores/user`、`stores/chat`、`stores/ui`）
- Vue Router 路由（登录 / 注册 / 主页）
- axios 全局封装 + 原生 `fetch` 读取 SSE 流
- ECharts（统计图表）、three.js（3D 知识图谱）

## 环境变量

前端开发时通过 Vite 直接访问后端接口，接口地址硬编码在 `src/api/request.ts`（`http://localhost:3000`），无需 `.env`。若后端端口变更，需同步修改该地址。

## 启动

推荐在 monorepo 根目录（`ai_knowledge_base`）执行一键启动：

```bash
pnpm dev
```

也可以单独启动本服务：

```bash
cd apps/web
pnpm dev        # 开发模式（Vite，默认 http://localhost:5173）
pnpm build      # 类型检查 + 生产构建
pnpm preview    # 预览生产构建产物
```

## 路由

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 登录 | 公开 |
| `/register` | 注册 | 公开 |
| `/home` | 主页 | 需登录；由 AppHeader + SidebarPanel + 右侧主区（聊天 / 文档预览 / 使用统计 / 知识图谱 / 模型配置）组装 |
| `/` | 重定向 | 跳转 `/home` |

> 模型配置 / 使用统计 / 知识图谱 通过左侧菜单或头像下拉切换到右侧主区内容页（`stores/ui.ts` + `views/Home.vue`），不走路由。

## 目录结构

```text
src/
├── main.ts                 # 入口：装配 Element Plus、Pinia、路由
├── App.vue                 # 根组件：路由出口
├── api/                    # 接口封装：auth / chat / request / settings / stats / upload
├── components/             # AppHeader / SidebarPanel / ChatPanel / DocumentPreview
├── router/index.ts         # 路由与登录态守卫
├── stores/                 # Pinia：user（登录态）/ chat（工作台状态）/ ui（主区视图 + 侧栏菜单）
└── views/                  # Home / Login / Register / Graph / Settings / Stats
```

## 常用脚本

```bash
pnpm dev       # 开发模式
pnpm build     # 类型检查（vue-tsc）+ 生产构建
pnpm preview   # 预览构建产物
```
