<template>
  <header class="header">
    <!-- 顶部工具条：电话 / 工作时间 / 语言 / 管理 -->
    <div class="topbar">
      <div class="container topbar-inner">
        <div class="topbar-left">
          <span class="tb-item"><el-icon><Phone /></el-icon>{{ t('topbar_phone') }}</span>
          <span class="tb-item tb-divider"><el-icon><Clock /></el-icon>{{ t('contact_hours') }}</span>
        </div>
        <div class="topbar-right">
          <el-dropdown trigger="click" @command="onLang">
            <span class="lang-current">
              <el-icon><Place /></el-icon>
              <span>{{ langLabel }}</span>
              <el-icon class="arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="zh" :disabled="lang === 'zh'">简体中文</el-dropdown-item>
                <el-dropdown-item command="en" :disabled="lang === 'en'">English</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button v-if="!isAdmin" link class="topbar-link" @click="$router.push('/admin/login')">
            <el-icon><Lock /></el-icon> {{ t('action_login') }}
          </el-button>
          <el-dropdown v-else @command="onAdminCommand">
            <el-button link class="topbar-link"><el-icon><Setting /></el-icon> {{ t('action_admin') }}</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="dashboard">{{ t('admin_dashboard') }}</el-dropdown-item>
                <el-dropdown-item command="logout">{{ t('action_logout') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <!-- 主 header：品牌 + 搜索框 + 导航 -->
    <div class="mainbar">
      <div class="container mainbar-inner">
        

        <div class="search-box">
          <el-input v-model="keyword" :placeholder="t('search_placeholder')" clearable @keyup.enter="doSearch">
            <template #prefix><el-icon><Search /></el-icon></template>
            <template #append>
              <el-button class="search-btn" @click="doSearch"><el-icon><Search /></el-icon><span class="search-btn-text">{{ t('search_btn') }}</span></el-button>
            </template>
          </el-input>
        </div>

        <nav class="nav">
          <router-link to="/" class="nav-link" active-class="active" exact-active-class="active">{{ t('nav_home') }}</router-link>
          <router-link to="/products" class="nav-link" active-class="active">{{ t('nav_products') }}</router-link>
          <router-link to="/about" class="nav-link" active-class="active">{{ t('nav_about') }}</router-link>
          <router-link to="/contact" class="nav-link" active-class="active">{{ t('nav_contact') }}</router-link>
        </nav>

        <div class="header-actions">
          <div class="social-icons">
            <a class="soc-btn wa" :href="waLink" target="_blank" rel="noopener" title="WhatsApp">
              <svg viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
            </a>
            <a class="soc-btn ig" :href="igLink" target="_blank" rel="noopener" title="Instagram">
              <svg viewBox="0 0 448 512"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg>
            </a>
            <a class="soc-btn fb" :href="fbLink" target="_blank" rel="noopener" title="Facebook">
              <svg viewBox="0 0 512 512"><path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z"/></svg>
            </a>
          </div>
          <el-button type="accent" round @click="$router.push('/contact')">
            <el-icon><ChatDotRound /></el-icon>{{ t('action_inquiry') }}
          </el-button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Lock, Setting, Place, ArrowDown, Search, Phone, Clock, ChatDotRound } from '@element-plus/icons-vue'
import { lang, setLang, t } from '@/i18n'

const router = useRouter()
const route = useRoute()
const isAdmin = ref(false)
const keyword = ref('')

const langLabel = computed(() => (lang.value === 'en' ? 'English' : '简体中文'))

// 社交联系链接（WhatsApp 使用公司号码，IG/FB 为占位，后续可改真实主页）
const waNumber = '8613874990232'
const waLink = `https://wa.me/${waNumber}`
const igLink = 'https://www.instagram.com/yangliangtrade'
const fbLink = 'https://www.facebook.com/yangliangtrade'

onMounted(() => {
  isAdmin.value = !!localStorage.getItem('yl_admin_token')
  if (route.path === '/products' && route.query.q) keyword.value = route.query.q
})

function onLang(cmd) {
  setLang(cmd)
}

function onAdminCommand(cmd) {
  if (cmd === 'dashboard') router.push('/admin/dashboard')
  if (cmd === 'logout') {
    localStorage.removeItem('yl_admin_token')
    isAdmin.value = false
    router.push('/')
  }
}

function doSearch() {
  const kw = keyword.value.trim()
  router.push({ path: '/products', query: kw ? { q: kw } : {} })
}
</script>

<style scoped>
.header { position: sticky; top: 0; z-index: 100; background: #fff; box-shadow: 0 2px 12px rgba(0, 0, 0, .06); }
.topbar { background: var(--yl-primary-deep); color: #c7d2ea; font-size: 13px; }
.topbar-inner { display: flex; align-items: center; justify-content: space-between; height: 38px; gap: 12px; }
.topbar-left { display: flex; align-items: center; gap: 20px; overflow: hidden; white-space: nowrap; }
.tb-item { display: inline-flex; align-items: center; gap: 6px; color: #c7d2ea; }
.tb-item .el-icon { color: var(--yl-accent); }
.tb-divider { color: #8fa3c9; }
.lang-current { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: #e2e8f0; outline: none; }
.lang-current:hover { color: #79bbff; }
.lang-current .arrow { font-size: 12px; }
.topbar-right { display: flex; align-items: center; gap: 18px; }
.topbar-link { color: #c7d2ea; font-size: 13px; padding: 0; }
.topbar-link:hover { color: #79bbff; }
.mainbar { border-bottom: 1px solid #eef2f7; }
.mainbar-inner { display: flex; align-items: center; gap: 24px; height: 76px; }

.search-box { flex: 1; max-width: 440px; margin-right: auto; }
.search-box :deep(.el-input-group__append) { padding: 0; background: transparent; box-shadow: none; }
.search-btn { height: 32px; margin: 2px; background: var(--yl-accent); color: #fff; border: none; border-radius: 6px; }
.search-btn:hover { background: var(--yl-accent-dark); color: #fff; }
.search-btn-text { margin-left: 2px; }
.nav { display: flex; gap: 26px; margin-left: auto; }
.nav-link { font-size: 15px; font-weight: 500; color: var(--yl-text); padding: 6px 2px; position: relative; }
.nav-link:hover { color: var(--yl-primary); }
.nav-link.active { color: var(--yl-primary); font-weight: 700; }
.nav-link.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -4px; height: 3px; border-radius: 3px; background: var(--yl-accent); }
.header-actions { display: flex; align-items: center; gap: 8px; }
.social-icons { display: flex; gap: 8px; align-items: center; }
.soc-btn { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; transition: transform .2s, box-shadow .2s; }
.soc-btn svg { width: 16px; height: 16px; fill: currentColor; }
.soc-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(0,0,0,.16); }
.soc-btn.wa { background: #25d366; }
.soc-btn.ig { background: #e4405f; }
.soc-btn.fb { background: #1877f2; }
@media (max-width: 1080px) { .nav { display: none; } .tb-item.tb-divider { display: none; } .social-icons { display: none; } }
@media (max-width: 640px) { .search-box { display: none; } .topbar-left .tb-item { display: none; } }
</style>
