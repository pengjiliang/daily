<template>
  <div class="page-section">
    <div class="container">
      <h2 class="section-title">关于我们</h2>
      <p class="section-sub">扬良贸易有限公司 — 值得信赖的医疗器械贸易伙伴</p>

      <div class="banner"><img src="/images/hero-medical.svg" alt="扬良贸易" /></div>

      <div class="text-block">
        <h3>公司简介</h3>
        <p>扬良贸易有限公司专注于医疗器械与医用产品的进出口贸易，主营防护用品、监测设备、耗材器械、护理康复与消毒净化等品类。公司建立严格的质量管控体系，产品通过 CE、FDA、ISO 等国际认证，远销亚洲、东南亚、南亚、中亚、北非等地区。</p>
      </div>

      <div class="grid3">
        <div class="item">
          <el-icon :size="30" color="#2563eb"><OfficeBuilding /></el-icon>
          <h4>我们的使命</h4>
          <p>以可靠的品质与高效的服务，让全球医疗机构与家庭获得安全、高性价比的医用产品。</p>
        </div>
        <div class="item">
          <el-icon :size="30" color="#2563eb"><Medal /></el-icon>
          <h4>品质保证</h4>
          <p>从原料、生产到出厂，全流程质量管控；产品认证齐全，支持第三方检测。</p>
        </div>
        <div class="item">
          <el-icon :size="30" color="#2563eb"><Connection /></el-icon>
          <h4>全球服务</h4>
          <p>专业外贸团队提供报价、打样、OEM 定制、物流清关等一站式贸易服务。</p>
        </div>
      </div>

      <div class="values">
        <h3>核心优势</h3>
        <div class="value-list">
          <div v-for="v in VALUES" :key="v.t" class="value">
            <div class="v-num">{{ v.n }}</div>
            <div class="v-title">{{ v.t }}</div>
            <div class="v-desc">{{ v.d }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { OfficeBuilding, Medal, Connection } from '@element-plus/icons-vue'
const VALUES = [
  { n: '01', t: '全品类供应', d: '核心品类齐全，规格覆盖广' },
  { n: '02', t: '认证保障', d: 'CE / FDA / ISO 认证体系' },
  { n: '03', t: '柔性定制', d: 'OEM / ODM 按需定制' },
  { n: '04', t: '高效交付', d: '稳定供应链与快速发货' }
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
.v-num { font-size: 34px; font-weight: 800; color: rgba(37,99,235,.2); }
.v-title { font-weight: 700; margin: 8px 0 6px; }
.v-desc { font-size: 13px; color: var(--yl-text-light); }
@media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } .value-list { grid-template-columns: repeat(2, 1fr); } }
</style>
