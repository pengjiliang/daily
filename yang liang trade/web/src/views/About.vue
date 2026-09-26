<template>
  <div class="page-section">
    <div class="container">
      <h2 class="section-title">{{ t('about_title') }}</h2>
      <p class="section-sub">{{ t('about_sub') }}</p>

      <div class="banner"><img src="/images/hero-medical.svg" alt="Yangliang Trade" /></div>

      <div class="text-block">
        <h3>{{ t('about_intro_title') }}</h3>
        <p>{{ t('about_intro_p') }}</p>
      </div>

      <div class="grid3">
        <div class="item">
          <el-icon :size="30" color="#409eff"><OfficeBuilding /></el-icon>
          <h4>{{ t('about_m1') }}</h4>
          <p>{{ t('about_m1d') }}</p>
        </div>
        <div class="item">
          <el-icon :size="30" color="#409eff"><Medal /></el-icon>
          <h4>{{ t('about_m2') }}</h4>
          <p>{{ t('about_m2d') }}</p>
        </div>
        <div class="item">
          <el-icon :size="30" color="#409eff"><Connection /></el-icon>
          <h4>{{ t('about_m3') }}</h4>
          <p>{{ t('about_m3d') }}</p>
        </div>
      </div>

      <div class="values">
        <h3>{{ t('about_values') }}</h3>
        <div class="value-list">
          <div v-for="v in VALUES" :key="v.n" class="value">
            <div class="v-num">{{ v.n }}</div>
            <div class="v-title">{{ t(v.t) }}</div>
            <div class="v-desc">{{ t(v.d) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { OfficeBuilding, Medal, Connection } from '@element-plus/icons-vue'
import { t } from '@/i18n'
const VALUES = [
  { n: '01', t: 'about_v1', d: 'about_v1d' },
  { n: '02', t: 'about_v2', d: 'about_v2d' },
  { n: '03', t: 'about_v3', d: 'about_v3d' },
  { n: '04', t: 'about_v4', d: 'about_v4d' }
]
</script>

<style scoped>
.banner img { width: 100%; border-radius: 18px; margin-bottom: 40px; }
.text-block { max-width: 860px; }
.text-block h3, .values h3 { font-size: 24px; margin: 0 0 16px; }
.text-block p { color: var(--yl-text-light); line-height: 2; font-size: 15px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin: 48px 0; }
.item { background: #fff; border: 1px solid #eef2f7; border-radius: var(--yl-radius); padding: 28px; }
.item h4 { margin: 14px 0 8px; }
.item p { color: var(--yl-text-light); font-size: 14px; line-height: 1.8; margin: 0; }
.value-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.value { background: #fff; border-radius: var(--yl-radius); padding: 26px 22px; border: 1px solid #eef2f7; }
.v-num { font-size: 34px; font-weight: 800; color: rgba(64,158,255,.18); }
.v-title { font-weight: 700; margin: 8px 0 6px; }
.v-desc { font-size: 13px; color: var(--yl-text-light); }
@media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } .value-list { grid-template-columns: repeat(2, 1fr); } }
</style>
