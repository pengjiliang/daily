<template>
  <div>
    <h2 class="page-title">{{ t('ad_title') }}</h2>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-icon" style="background: #ecf5ff; color: #409eff"><el-icon><Goods /></el-icon></div>
        <div><div class="num">{{ stats.products }}</div><div class="label">{{ t('ad_stat_products') }}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #f0f9eb; color: #67c23a"><el-icon><Position /></el-icon></div>
        <div><div class="num">{{ stats.leads }}</div><div class="label">{{ t('ad_stat_leads') }}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #fdf6ec; color: #e6a23c"><el-icon><Promotion /></el-icon></div>
        <div><div class="num">{{ stats.campaigns }}</div><div class="label">{{ t('ad_stat_campaigns') }}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #fef0f0; color: #f56c6c"><el-icon><Message /></el-icon></div>
        <div><div class="num">{{ stats.messages }}</div><div class="label">{{ t('ad_stat_messages') }}</div></div>
      </div>
    </div>

    <div class="chart-grid">
      <el-card shadow="never" class="chart-card">
        <template #header>{{ t('ad_chart_wa') }}</template>
        <div ref="gaugeEl" class="chart" />
      </el-card>
      <el-card shadow="never" class="chart-card">
        <template #header>{{ t('ad_chart_source') }}</template>
        <div ref="sourceEl" class="chart" />
      </el-card>
      <el-card shadow="never" class="chart-card">
        <template #header>{{ t('ad_chart_trend7') }}</template>
        <div ref="trendEl" class="chart" />
      </el-card>
      <el-card shadow="never" class="chart-card">
        <template #header>{{ t('ad_chart_category') }}</template>
        <div ref="categoryEl" class="chart" />
      </el-card>
      <el-card shadow="never" class="chart-card">
        <template #header>{{ t('ad_chart_region') }}</template>
        <div ref="regionEl" class="chart" />
      </el-card>
    </div>

    <el-card shadow="never" style="margin-top: 24px">
      <template #header>{{ t('ad_recent_leads') }}</template>
      <el-table :data="recentLeads" size="default" border v-loading="loading">
        <el-table-column prop="name" :label="t('ad_col_name')" min-width="140" show-overflow-tooltip />
        <el-table-column prop="type" :label="t('ad_col_type')" width="120" show-overflow-tooltip />
        <el-table-column prop="phone" :label="t('ad_col_phone')" width="140" show-overflow-tooltip />
        <el-table-column prop="city" :label="t('ad_col_city')" width="110" show-overflow-tooltip />
        <el-table-column prop="hasWhatsApp" label="WhatsApp" width="100">
          <template #default="{ row }">
            <el-tag :type="row.hasWhatsApp ? 'success' : 'info'" size="small">{{ t(row.hasWhatsApp ? 'ad_recognized' : 'ad_unknown') }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        style="display: flex; justify-content: flex-end; margin-top: 16px"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        :page-sizes="[10, 30, 50, 100, 200, 500]"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Goods, Position, Promotion, Message } from '@element-plus/icons-vue'
import * as echarts from 'echarts/core'
import { GaugeChart, PieChart, LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { t } from '@/i18n'

echarts.use([GaugeChart, PieChart, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const stats = ref({ products: 0, leads: 0, campaigns: 0, messages: 0 })
const recentLeads = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(100)

const gaugeEl = ref(null)
const sourceEl = ref(null)
const trendEl = ref(null)
const categoryEl = ref(null)
const regionEl = ref(null)
let charts = []

const COLORS = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#8e44ad', '#16a085', '#2980b9', '#d35400', '#27ae60', '#2c3e50']

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yl_admin_token') || ''}` }
}

async function api(path, options = {}) {
  const res = await fetch(path, { headers: headers(), ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || t('a_request_failed'))
  return data
}

function setChart(el, option) {
  if (!el) return
  const c = echarts.init(el)
  c.setOption(option)
  charts.push(c)
}

function renderCharts(data) {
  charts.forEach((c) => c.dispose())
  charts = []
  const dark = document.documentElement.classList.contains('dark')
  const axisColor = dark ? '#2a2c30' : '#eef2f7'
  const splitColor = dark ? '#26282b' : '#f0f2f5'
  const pieBorder = dark ? '#1d1e1f' : '#fff'

  setChart(gaugeEl.value, {
    series: [{
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      progress: { show: true, width: 16, itemStyle: { color: '#409eff' } },
      axisLine: { lineStyle: { width: 16, color: [[1, axisColor]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      title: { show: true, offsetCenter: [0, '34%'], fontSize: 14, color: '#909399', formatter: t('ad_total_n', { n: data.whatsappCount }) },
      detail: { valueAnimation: true, formatter: (v) => `${v}%`, fontSize: 36, fontWeight: 700, color: '#409eff', offsetCenter: [0, 0] },
      data: [{ value: data.whatsappRate }]
    }]
  })

  setChart(sourceEl.value, {
    color: COLORS,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['38%', '66%'],
      center: ['50%', '44%'],
      itemStyle: { borderRadius: 6, borderColor: pieBorder, borderWidth: 2 },
      label: { formatter: '{b}\n' + t('ad_count_n', { n: '{c}' }) },
      data: data.sourceDist.length ? data.sourceDist : [{ name: t('ad_no_data'), value: 0 }]
    }]
  })

  setChart(trendEl.value, {
    color: ['#409eff'],
    tooltip: { trigger: 'axis', confine: true },
    grid: { left: 36, right: 20, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: data.trend7d.dates, axisLabel: { color: '#909399', fontSize: 11 }, axisLine: { lineStyle: { color: '#dcdfe6' } } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#909399' }, splitLine: { lineStyle: { color: splitColor } } },
    series: [{
      type: 'line',
      name: t('ad_new_leads'),
      data: data.trend7d.values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      areaStyle: { color: 'rgba(64,158,255,.12)' }
    }]
  })

  setChart(categoryEl.value, {
    color: COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true },
    grid: { left: 12, right: 30, top: 12, bottom: 12, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#909399' }, splitLine: { lineStyle: { color: splitColor } } },
    yAxis: { type: 'category', inverse: true, data: data.categoryDist.map((i) => i.name), axisLabel: { color: '#606266', fontSize: 12 } },
    series: [{
      type: 'bar',
      data: data.categoryDist.map((i) => i.value),
      barWidth: 14,
      itemStyle: { borderRadius: [0, 7, 7, 0] }
    }]
  })

  setChart(regionEl.value, {
    color: COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true },
    grid: { left: 12, right: 30, top: 12, bottom: 12, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#909399' }, splitLine: { lineStyle: { color: splitColor } } },
    yAxis: { type: 'category', inverse: true, data: data.regionDist.map((i) => i.name), axisLabel: { color: '#606266', fontSize: 12 } },
    series: [{
      type: 'bar',
      data: data.regionDist.map((i) => i.value),
      barWidth: 14,
      itemStyle: { borderRadius: [0, 7, 7, 0] }
    }]
  })
}

async function load() {
  loading.value = true
  try {
    const [dash, leads] = await Promise.all([
      api('/api/dashboard'),
      api(`/api/leads?page=${page.value}&pageSize=${pageSize.value}`)
    ])
    stats.value = dash.counts
    renderCharts(dash)
    total.value = Number(leads?.total) || 0
    recentLeads.value = Array.isArray(leads?.items) ? leads.items : []
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function onPageChange(p) {
  page.value = p
  load()
}
function onSizeChange(s) {
  pageSize.value = s
  page.value = 1
  load()
}

function onResize() {
  charts.forEach((c) => c.resize())
}
onMounted(() => {
  window.addEventListener('resize', onResize)
  load()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  charts.forEach((c) => c.dispose())
  charts = []
})
</script>

<style scoped>
.page-title { margin: 0 0 20px; font-size: 24px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.stat-card { display: flex; align-items: center; gap: 16px; background: var(--yl-white); border-radius: var(--yl-radius); border: 1px solid var(--yl-border); padding: 22px 24px; }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
.stat-card .num { font-size: 28px; font-weight: 800; color: var(--yl-text); line-height: 1.2; }
.stat-card .label { color: var(--yl-text-light); margin-top: 4px; font-size: 13px; }
.chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px; }
.chart-card .chart { height: 300px; }
@media (max-width: 1200px) {
  .chart-grid { grid-template-columns: 1fr; }
  .stats { grid-template-columns: repeat(2, 1fr); }
}
</style>

