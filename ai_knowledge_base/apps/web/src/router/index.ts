/**
 * 路由配置：登录、注册、主页，均懒加载。
 * 模型配置 / 使用统计 / 知识图谱 作为主页右侧内容页展示（见 stores/ui.ts + views/Home.vue），不走路由。
 * 全局前置守卫：登录态在 HttpOnly Cookie 中，前端通过 /auth/profile 校验恢复；
 * 未登录访问需鉴权页面（meta.requiresAuth）跳登录，已登录访问登录/注册页回主页。
 */
import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/user';
import { authApi } from '../api/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/Register.vue'),
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('../views/Home.vue'),
      meta: { requiresAuth: true }, // 主页需要登录
    },
    {
      path: '/',
      redirect: '/home',
    },
  ],
});

// 全局登录态守卫
router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore();

  // 尚未完成过登录态校验时先请求 profile（Cookie 自动携带）
  if (!userStore.authChecked) {
    try {
      const profile = await authApi.getProfile();
      userStore.setUserInfo(profile);
    } catch {
      userStore.logout();
    }
  }

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next('/login');
  } else if ((to.path === '/login' || to.path === '/register') && userStore.isLoggedIn) {
    next('/home');
  } else {
    next();
  }
});

export default router;
