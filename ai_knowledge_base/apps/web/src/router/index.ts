/**
 * 路由配置：登录、注册、主页三个页面，均懒加载。
 * 全局前置守卫：未登录访问需鉴权页面（meta.requiresAuth）跳登录；
 * 已登录访问登录/注册页则直接回主页。
 */
import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/user';

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
router.beforeEach((to, from, next) => {
  const userStore = useUserStore();

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next('/login');
  } else if ((to.path === '/login' || to.path === '/register') && userStore.isLoggedIn) {
    next('/home');
  } else {
    next();
  }
});

export default router;
