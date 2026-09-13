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
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
