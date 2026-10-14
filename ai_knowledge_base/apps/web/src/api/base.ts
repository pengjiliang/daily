/**
 * 后端接口与静态资源基础地址的统一入口。
 *
 * - 本地开发：不配置 `VITE_API_BASE`，接口走相对路径 `/api`、静态资源走 `/uploads`，
 *   由 Vite dev server 代理转发到 `http://localhost:3000`（见 vite.config.ts），
 *   浏览器地址是 localhost 还是局域网 IP 都不受影响；
 * - 部署到局域网 / 域名 / HTTPS 时：在 `apps/web/.env`（或构建环境）配置
 *   `VITE_API_BASE=http://10.0.0.8:3000`（或域名地址），全部请求自动指向该后端。
 */
const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || '';

/** 接口请求基础地址：本地默认 `/api`（走代理），生产用配置的真实地址 */
export const API_BASE = configured || '/api';

/** 静态资源（头像等）来源前缀：本地为空串走同源相对路径，生产用配置地址 */
export const ASSET_ORIGIN = configured.replace(/\/+$/, '');
