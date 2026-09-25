<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon :size="24"><FirstAidKit /></el-icon>
        <span>扬良管理后台</span>
      </div>
      <el-menu :default-active="$route.path" router class="menu">
        <el-menu-item index="/admin/dashboard"><el-icon><DataBoard /></el-icon>仪表盘</el-menu-item>
        <el-menu-item index="/admin/ai-config"><el-icon><MagicStick /></el-icon>AI 模型配置</el-menu-item>
        <el-menu-item index="/admin/products"><el-icon><Goods /></el-icon>产品管理</el-menu-item>
        <el-menu-item index="/admin/leads"><el-icon><Position /></el-icon>线索抓取与群发</el-menu-item>
      </el-menu>
      <div class="aside-foot">
        <el-button text @click="goSite"><el-icon><Back /></el-icon>返回网站</el-button>
        <el-button text type="danger" @click="logout"><el-icon><SwitchButton /></el-icon>退出登录</el-button>
      </div>
    </el-aside>
    <el-main class="main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { FirstAidKit, DataBoard, MagicStick, Goods, Position, Back, SwitchButton } from '@element-plus/icons-vue'

const router = useRouter()
function goSite() { router.push('/') }
function logout() {
  localStorage.removeItem('yl_admin_token')
  router.push('/')
}
</script>

<style scoped>
.layout { min-height: 100vh; }
.aside { background: #0f172a; color: #cbd5e1; display: flex; flex-direction: column; }
.logo { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 700; padding: 20px 16px; font-size: 16px; }
.menu { border-right: none; background: transparent; --el-menu-text-color: #cbd5e1; --el-menu-hover-bg-color: rgba(255,255,255,.06); --el-menu-active-color: #38bdf8; --el-menu-bg-color: transparent; flex: 1; }
.menu :deep(.el-menu-item) { border-radius: 10px; margin: 4px 10px; }
.menu :deep(.el-menu-item.is-active) { background: rgba(56,189,248,.15); }
.aside-foot { padding: 16px; display: flex; flex-direction: column; align-items: stretch; }
.aside-foot .el-button { justify-content: flex-start; color: #cbd5e1; }
.main { background: var(--yl-bg); padding: 28px; }
</style>

