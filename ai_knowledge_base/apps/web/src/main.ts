/**
 * 前端应用入口：创建 Vue 实例，装配 Element Plus（中文语言包）、全部图标、
 * Pinia 状态与路由，并挂载到 #app。
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import router from './router';
import App from './App.vue';
import './style.css';

// 主题初始化：挂载前恢复持久化主题（未设置时跟随系统偏好），避免首屏闪烁
const savedTheme = localStorage.getItem('kb-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme === 'dark' || (savedTheme === null && prefersDark)) {
  document.documentElement.classList.add('dark');
}

const app = createApp(App);

// 全局注册 Element Plus
app.use(ElementPlus, {
  locale: zhCn,
});

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(router);

app.mount('#app');
