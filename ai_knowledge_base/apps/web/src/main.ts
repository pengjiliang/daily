/**
 * 前端应用入口：创建 Vue 实例，装配 Element Plus（中文语言包）、全部图标、
 * Pinia 状态与路由，并挂载到 #app。
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import router from './router';
import App from './App.vue';
import './style.css';

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
