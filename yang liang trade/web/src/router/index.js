import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/Home.vue') },
  { path: '/products', name: 'products', component: () => import('@/views/Products.vue') },
  { path: '/products/:id', name: 'product-detail', component: () => import('@/views/ProductDetail.vue') },
  { path: '/about', name: 'about', component: () => import('@/views/About.vue') },
  { path: '/contact', name: 'contact', component: () => import('@/views/Contact.vue') },
  { path: '/admin/login', name: 'admin-login', component: () => import('@/views/AdminLogin.vue') },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('@/views/admin/Dashboard.vue') },
      { path: 'ai-config', name: 'admin-ai-config', component: () => import('@/views/admin/AiConfig.vue') },
      { path: 'products', name: 'admin-products', component: () => import('@/views/admin/ProductsAdmin.vue') },
      { path: 'leads', name: 'admin-leads', component: () => import('@/views/admin/Leads.vue') }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

// 管理端路由守卫：需登录
router.beforeEach((to) => {
  if (to.meta.requiresAdmin && !localStorage.getItem('yl_admin_token')) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }
})

export default router

