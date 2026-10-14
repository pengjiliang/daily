/**
 * Vite 构建/开发服务器配置：Vue 插件、5173 端口（监听所有网卡），
 * 以及源码内 @ -> src 的路径别名（与 tsconfig paths 对应）。
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    // 本地开发代理：前端用相对路径 /api 与 /uploads，代理到后端 3000。
    // 这样通过 localhost 或局域网 IP 打开页面，请求都发往同一后端，不受硬编码地址影响。
    proxy: {
      // 接口：/api/auth → http://localhost:3000/auth
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // 静态资源（头像等）：/uploads → http://localhost:3000/uploads
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
