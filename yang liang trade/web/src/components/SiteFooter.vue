<template>
  <footer class="footer">
    <div class="container footer-inner">
      <!-- 品牌 -->
      <div class="footer-brand">
        <div class="footer-logo">
          <span class="fl-icon"><el-icon><FirstAidKit /></el-icon></span>
          <span class="fl-name">{{ t('footer_brand') }}</span>
        </div>
        <p class="muted">{{ t('footer_slogan') }}</p>
        <div class="footer-social">
          <a class="fs-item" href="https://wa.me/8613874990232" target="_blank" rel="noopener" title="WhatsApp"><el-icon><ChatDotRound /></el-icon></a>
          <a class="fs-item" href="mailto:sales@yangliang-trade.com" title="Email"><el-icon><Message /></el-icon></a>
          <a class="fs-item" href="#" title="Facebook"><el-icon><Share /></el-icon></a>
        </div>
      </div>

      <!-- 快速导航 -->
      <div class="footer-col">
        <div class="footer-title">{{ t('footer_nav') }}</div>
        <router-link to="/">{{ t('nav_home') }}</router-link>
        <router-link to="/products">{{ t('nav_products') }}</router-link>
        <router-link to="/about">{{ t('nav_about') }}</router-link>
        <router-link to="/contact">{{ t('nav_contact') }}</router-link>
      </div>

      <!-- 产品分类 -->
      <div class="footer-col">
        <div class="footer-title">{{ t('home_cat_title') }}</div>
        <router-link v-for="c in footerCats" :key="c.key" :to="{ path: '/products', query: { cat: c.key } }">{{ t('catL_' + c.key) }}</router-link>
      </div>

      <!-- 联系方式 -->
      <div class="footer-col">
        <div class="footer-title">{{ t('footer_contact') }}</div>
        <span class="fc-item"><el-icon><Phone /></el-icon>{{ t('contact_phone') }}</span>
        <span class="fc-item"><el-icon><Message /></el-icon>{{ t('contact_email') }}</span>
        <span class="fc-item"><el-icon><Location /></el-icon>{{ t('contact_addr') }}</span>
        <span class="fc-item"><el-icon><Clock /></el-icon>{{ t('contact_hours') }}</span>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="container fb-inner">
        <span>{{ t('footer_copyright') }}</span>
        <span class="fb-lang" @click="setLang(isEn ? 'zh' : 'en')">{{ isEn ? '简体中文' : 'English' }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { FirstAidKit, ChatDotRound, Message, Share, Phone, Location, Clock } from '@element-plus/icons-vue'
import { t, setLang, isEn } from '@/i18n'
import { categories } from '@/data/products'

const footerCats = computed(() => categories.filter((c) => c.key !== 'all'))
</script>

<style scoped>
.footer { margin-top: auto; background: #e0e0e0; color: #333; }
.footer-inner { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1.3fr; gap: 44px; padding: 60px 24px 48px; }
.footer-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.fl-icon { width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #409eff, #79bbff); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.fl-name { color: #1f2d3d; font-size: 19px; font-weight: 700; letter-spacing: .5px; }
.muted { color: #606266; font-size: 13px; line-height: 1.9; margin: 0 0 20px; max-width: 300px; }
.footer-social { display: flex; gap: 12px; }
.fs-item { width: 38px; height: 38px; border-radius: 8px; background: rgba(0,0,0,.06); color: #606266; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all .2s; }
.fs-item:hover { background: var(--yl-accent); color: #fff; }
.footer-title { color: #303133; font-weight: 700; margin-bottom: 20px; font-size: 16px; position: relative; padding-bottom: 10px; }
.footer-title::after { content: ''; position: absolute; left: 0; bottom: 0; width: 28px; height: 3px; border-radius: 3px; background: var(--yl-accent); }
.footer-col { display: flex; flex-direction: column; gap: 12px; font-size: 14px; }
.footer-col a { color: #606266; transition: color .2s; }
.footer-col a:hover { color: #409eff; }
.fc-item { display: flex; align-items: flex-start; gap: 8px; color: #606266; line-height: 1.5; }
.fc-item .el-icon { color: var(--yl-accent); margin-top: 2px; }
.footer-bottom { border-top: 1px solid #868686; background: #e0e0e0; padding: 20px 0; font-size: 13px; color: #000; }
.fb-inner { display: flex; justify-content: space-between; align-items: center; }
.fb-lang { cursor: pointer; color: #333; }
.fb-lang:hover { color: #409eff; }
@media (max-width: 900px) { .footer-inner { grid-template-columns: 1fr 1fr; gap: 32px; } }
@media (max-width: 560px) { .footer-inner { grid-template-columns: 1fr; } }
</style>
