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

  // 仅访问需要登录的页面时才校验登录态（Cookie 自动携带），登录/注册页不发起校验，
  // 避免未登录时反复请求 profile，与 401 拦截器形成"整页刷新→再请求→再刷新"的死循环。
  if (to.meta.requiresAuth) {
    // 尚未完成过登录态校验时先请求 profile
    if (!userStore.authChecked) {
      try {
        const profile = await authApi.getProfile();
        userStore.setUserInfo(profile);
      } catch {
        // 校验失败（401 等）说明未登录：标记已校验，本会话内不再重复请求
        userStore.markChecked();
      }
    }

    if (!userStore.isLoggedIn) {
      next('/login');
    } else {
      next();
    }
  } else {
    // 登录/注册页：已登录则回主页
    if (userStore.isLoggedIn) {
      next('/home');
    } else {
      next();
    }
  }
});

export default router;
