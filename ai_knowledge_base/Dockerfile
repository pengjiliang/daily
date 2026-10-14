# syntax=docker/dockerfile:1
# ============================================================================
# AI 知识库多阶段构建镜像
#
# 阶段一 deps：完整安装依赖（含 devDependencies 供编译；原生模块 bcrypt 需要编译工具链，
#              故用完整 node 镜像而非 slim）
# 阶段二 build：编译三个子项目（web / server / ai-service）
# 阶段三 运行时镜像：直接复用 deps 的完整 node_modules（已含编译好的 bcrypt 与全部依赖），
#              只叠加编译产物。私有化部署镜像稍大但稳定、可复现，避免二次安装引入不确定性。
# ============================================================================

# ---------- 阶段一：完整依赖 ----------
FROM node:20 AS deps

RUN npm install -g pnpm@12.3.4
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

# ---------- 阶段二：编译 ----------
FROM deps AS build

RUN pnpm --filter @ai-knowledge-base/web build \
 && pnpm --filter server build \
 && pnpm --filter ai-service build

# ---------- 阶段三：server 运行时 ----------
FROM deps AS server-runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/server/dist ./apps/server/dist

EXPOSE 3000
CMD ["node", "apps/server/dist/main.js"]

# ---------- 阶段三：ai-service 运行时 ----------
FROM deps AS ai-service-runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/ai-service/dist ./apps/ai-service/dist
# 内置 OCR 语言包（默认从 CDN 下载；离线部署时通过 TESSDATA_PREFIX 使用本地包）
COPY apps/ai-service/*.traineddata ./apps/ai-service/

EXPOSE 3001
CMD ["node", "apps/ai-service/dist/main.js"]

# ---------- 阶段三：Nginx 运行时 ----------
FROM nginx:1.27-alpine AS web-runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
