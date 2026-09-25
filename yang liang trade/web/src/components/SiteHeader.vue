<template>
  <header class="header">
    <div class="container header-inner">
      <router-link to="/" class="brand">
        <el-icon class="brand-icon"><FirstAidKit /></el-icon>
        <span class="brand-name">扬良贸易<em>YANGLIANG TRADE</em></span>
      </router-link>
      <nav class="nav">
        <router-link to="/" class="nav-link" active-class="active" exact-active-class="active">首页</router-link>
        <router-link to="/products" class="nav-link" active-class="active">产品中心</router-link>
        <router-link to="/about" class="nav-link" active-class="active">关于我们</router-link>
        <router-link to="/contact" class="nav-link" active-class="active">联系我们</router-link>
      </nav>
      <div class="header-actions">
        <el-button type="primary" round @click="$router.push('/contact')">立即咨询</el-button>
        <el-button v-if="!isAdmin" text @click="$router.push('/admin/login')"><el-icon><Lock /></el-icon> 管理登录</el-button>
        <el-dropdown v-if="isAdmin" @command="onAdminCommand">
          <el-button text><el-icon><Setting /></el-icon> 管理</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="dashboard">管理后台</el-dropdown-item>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FirstAidKit, Lock, Setting } from '@element-plus/icons-vue'

const router = useRouter()
const isAdmin = ref(false)

onMounted(() => {
  isAdmin.value = !!localStorage.getItem('yl_admin_token')
})

function onAdminCommand(cmd) {
  if (cmd === 'dashboard') router.push('/admin/dashboard')
  if (cmd === 'logout') {
    localStorage.removeItem('yl_admin_token')
    isAdmin.value = false
    router.push('/')
  }
}
</script>

<style scoped>
.header { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,.92); backdrop-filter: blur(8px); border-bottom: 1px solid #eef2f7; }
.header-inner { display: flex; align-items: center; gap: 32px; height: 68px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-icon { font-size: 30px; color: var(--yl-primary); }
.brand-name { font-size: 20px; font-weight: 700; letter-spacing: 1px; display: flex; flex-direction: column; line-height: 1.1; }
.brand-name em { font-style: normal; font-size: 10px; color: var(--yl-text-light); letter-spacing: 2px; font-weight: 400; }
.nav { display: flex; gap: 28px; margin-left: auto; }
.nav-link { font-size: 15px; color: var(--yl-text); padding: 6px 2px; position: relative; }
.nav-link:hover { color: var(--yl-primary); }
.nav-link.active { color: var(--yl-primary); font-weight: 600; }
.nav-link.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 3px; border-radius: 3px; background: var(--yl-primary); }
.header-actions { display: flex; align-items: center; gap: 8px; }
@media (max-width: 768px) {
  .nav { display: none; }
}
</style>
