<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <BrandLogo :size="26" />
        <span>{{ t('al_brand') }}</span>
      </div>
      <el-menu :default-active="$route.path" router class="menu">
        <el-menu-item index="/admin/dashboard"><el-icon><DataBoard /></el-icon>{{ t('al_menu_dashboard') }}</el-menu-item>
        <el-menu-item index="/admin/ai-config"><el-icon><MagicStick /></el-icon>{{ t('al_menu_ai') }}</el-menu-item>
        <el-menu-item index="/admin/products"><el-icon><Goods /></el-icon>{{ t('al_menu_products') }}</el-menu-item>
        <el-menu-item index="/admin/messages"><el-icon><Message /></el-icon>{{ t('al_menu_messages') }}</el-menu-item>
        <el-menu-item index="/admin/leads"><el-icon><Position /></el-icon>{{ t('al_menu_leads') }}</el-menu-item>
        <el-menu-item index="/admin/mail"><el-icon><Promotion /></el-icon>{{ t('al_menu_mail') }}</el-menu-item>
        <el-menu-item index="/admin/trends"><el-icon><TrendCharts /></el-icon>{{ t('al_menu_trends') }}</el-menu-item>
        <el-menu-item index="/admin/customs"><el-icon><Ship /></el-icon>{{ t('al_menu_customs') }}</el-menu-item>
      </el-menu>
      <div class="aside-foot">
        <el-button text @click="toggleTheme"><el-icon><Sunny v-if="theme === 'dark'" /><Moon v-else /></el-icon>{{ t(theme === 'dark' ? 'al_theme_light' : 'al_theme_dark') }}</el-button>
        <el-button text @click="goSite"><el-icon><Back /></el-icon>{{ t('al_back_site') }}</el-button>
        <el-button text type="danger" @click="logout"><el-icon><SwitchButton /></el-icon>{{ t('al_logout') }}</el-button>
        <el-button text @click="toggleLang">{{ isEn ? t('hd_lang_zh') : t('hd_lang_en') }}</el-button>
      </div>
    </el-aside>
    <el-main class="main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { DataBoard, MagicStick, Goods, Message, Position, Promotion, TrendCharts, Back, SwitchButton, Ship, Sunny, Moon } from '@element-plus/icons-vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { theme, toggleTheme } from '@/theme'
import { t, isEn, setLang } from '@/i18n'

const router = useRouter()
function goSite() { router.push('/') }
function toggleLang() { setLang(isEn.value ? 'zh' : 'en') }
function logout() {
  localStorage.removeItem('yl_admin_token')
  router.push('/')
}
</script>

<style scoped>
.layout { height: 100vh; overflow: hidden; }
.aside { background: #304156; color: #c0c4cc; display: flex; flex-direction: column; }
.logo { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 700; padding: 20px 16px; font-size: 16px; }
.menu { border-right: none; background: transparent; --el-menu-text-color: #c0c4cc; --el-menu-hover-bg-color: rgba(255,255,255,.06); --el-menu-active-color: #409eff; --el-menu-bg-color: transparent; flex: 1; }
.menu :deep(.el-menu-item) { border-radius: 10px; margin: 4px 10px; }
.menu :deep(.el-menu-item.is-active) { background: rgba(64,158,255,.15); }
.aside-foot { padding: 16px; display: flex; flex-direction: column; align-items: stretch; }
.aside-foot .el-button { justify-content: flex-start; color: #c0c4cc; }
.main { background: var(--yl-bg); padding: 28px; height: 100%; overflow-y: auto; }
</style>

