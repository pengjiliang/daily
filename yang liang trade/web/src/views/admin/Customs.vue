<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">{{ t('ac_title') }}</h2>
        <p class="page-sub">{{ t('ac_sub') }}
          <el-tag size="small" :type="sourceTag" style="margin-left: 6px">{{ data.source === 'futian' ? t('ac_mode_futian') : t('ac_demo') }}</el-tag>
        </p>
      </div>
      <el-button type="primary" @click="openConfig"><el-icon><Setting /></el-icon>{{ t('ac_config_btn') }}</el-button>
    </div>

    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
      {{ t('ac_src_intro1') }}{{ t('ac_src_intro2') }}

    </el-alert>

    <el-alert v-if="data.note" type="warning" :closable="false" show-icon :title="data.note" style="margin-bottom: 16px" />

    <!-- 查询 -->
    <el-card shadow="never" class="block">
      <template #header><b>{{ t('ac_step1') }}</b></template>
      <el-form :inline="true" :model="query" label-width="80px" @submit.prevent>
        <el-form-item :label="t('ac_website')">
          <el-input v-model="query.website" :placeholder="t('ac_website_ph')" style="width: 360px" @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="doQuery">
            <el-icon><Search /></el-icon>&nbsp;{{ loading ? t('ac_querying') : t('ac_query') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <template v-if="data.website">
      <!-- 公司信息 -->
      <el-card shadow="never" class="block">
        <template #header><b>{{ t('ac_step2') }}</b></template>
        <el-descriptions :column="3" border>
          <el-descriptions-item :label="t('ac_company_name')" :span="2">{{ data.company.name }}</el-descriptions-item>
          <el-descriptions-item :label="t('ac_country')">{{ data.company.country }}</el-descriptions-item>
          <el-descriptions-item :label="t('ac_address')" :span="3">{{ data.company.address }}</el-descriptions-item>
          <el-descriptions-item :label="t('ac_founded')">{{ data.company.founded }}</el-descriptions-item>
          <el-descriptions-item :label="t('ac_employees')">{{ data.company.employees }}</el-descriptions-item>
          <el-descriptions-item :label="t('ac_products')">
            <el-tag v-for="p in data.company.products" :key="p" size="small" style="margin-right: 6px">{{ p }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 汇总统计 -->
      <div class="stats">
        <div class="stat-card">
          <div class="num">{{ fmtMoney(data.summary.totalExport) }}</div>
          <div class="label">{{ t('ac_export_total') }}</div>
        </div>
        <div class="stat-card">
          <div class="num">{{ fmtMoney(data.summary.totalImport) }}</div>
          <div class="label">{{ t('ac_import_total') }}</div>
        </div>
        <div class="stat-card">
          <div class="num">{{ data.summary.totalRecords }}<span class="unit">{{ t('ac_unit_records') }}</span></div>
          <div class="label">{{ t('ac_total_records') }}</div>
        </div>
        <div class="stat-card">
          <div class="num">{{ data.summary.partnerCount }}<span class="unit">{{ t('ac_unit_countries') }}</span></div>
          <div class="label">{{ t('ac_partner_count') }}</div>
        </div>
      </div>

      <!-- 月度趋势 -->
      <el-card shadow="never" class="block">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span>{{ t('ac_monthly_trend') }}</span>
            <span style="font-size: 13px; color: #909399">{{ t('ac_updated_at', { t: data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '-' }) }}</span>
          </div>
        </template>
        <div ref="chartEl" class="customs-chart" v-loading="loading" />
      </el-card>

      <!-- 主要贸易伙伴 -->
      <el-card shadow="never" class="block" v-if="data.summary.topPartners.length">
        <template #header><b>{{ t('ac_top_partners', { n: data.summary.topPartners.length }) }}</b></template>
        <el-table :data="data.summary.topPartners" size="default" style="width: 100%" border>
          <el-table-column type="index" :label="t('ac_col_rank')" width="70" align="center" />
          <el-table-column prop="country" :label="t('ac_country')" min-width="140" show-overflow-tooltip />
          <el-table-column :label="t('ac_col_amount')" min-width="160" align="right">
            <template #default="{ row }">{{ fmtMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="count" :label="t('ac_col_count')" width="110" align="center" />
        </el-table>
      </el-card>

      <!-- 明细记录 -->
      <el-card shadow="never" class="block">
        <template #header>
          <div class="table-head">
            <span><b>{{ t('ac_step3') }}</b>{{ t('ac_records_n', { n: data.records.length }) }}</span>
          </div>
        </template>
        <el-table :data="pagedRecords" size="default" style="width: 100%" border>
          <el-table-column prop="date" :label="t('ac_col_date')" width="105" />
          <el-table-column :label="t('ac_col_direction')" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.direction === 'export' ? 'success' : 'warning'" size="small">
                {{ t(row.direction === 'export' ? 'ac_export' : 'ac_import') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="hsCode" :label="t('ac_col_hs')" width="100" />
          <el-table-column prop="hsName" :label="t('ac_col_hs_name')" min-width="190" show-overflow-tooltip />
          <el-table-column prop="country" :label="t('ac_col_trade_country')" width="110" show-overflow-tooltip />
          <el-table-column prop="port" :label="t('ac_col_port')" width="110" show-overflow-tooltip />
          <el-table-column prop="ship" :label="t('ac_col_ship')" width="100" show-overflow-tooltip />
          <el-table-column prop="qty" :label="t('ac_col_qty')" width="100" align="right" />
          <el-table-column prop="unit" :label="t('ac_col_unit')" width="64" align="center" />
          <el-table-column :label="t('ac_col_usd')" min-width="130" align="right">
            <template #default="{ row }">{{ fmtMoney(row.amount) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination v-if="data.records.length" style="margin-top: 14px; justify-content: flex-end"
          layout="total, sizes, prev, pager, next, jumper"
          :total="data.records.length" v-model:current-page="page" v-model:page-size="pageSize"
          :page-sizes="[10, 30, 50, 100, 200, 500]" />
        <el-empty v-else-if="!loading" :description="t('ac_empty_records')" />
      </el-card>
    </template>
    <el-empty v-else :description="t('ac_empty_prompt')" style="margin-top: 40px" />

    <!-- 数据源配置 -->
    <el-dialog v-model="dialog" :title="t('ac_config_title')" width="520px">
      <el-form :model="form" label-position="top">
        <el-form-item :label="t('ac_mode')">
          <el-radio-group v-model="form.mode">
            <el-radio value="demo">{{ t('ac_mode_demo') }}</el-radio>
            <el-radio value="futian">{{ t('ac_mode_futian') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="form.mode === 'demo'">
          <el-alert type="info" :closable="false" show-icon :title="t('ac_demo_alert')" />
        </template>
        <template v-if="form.mode === 'futian'">
          <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px"
            :title="t('ac_futian_tip')" />
          <el-form-item :label="t('ac_futian_user')" required>
            <el-input v-model="form.futianUsername" :placeholder="t('ac_futian_user_ph')" />
          </el-form-item>
          <el-form-item :label="t('ac_futian_pass')" required>
            <el-input v-model="form.futianPassword" type="password" show-password :placeholder="t('ac_futian_pass_ph')" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{ t('a_cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">{{ t('ac_save_refresh') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'
import { useRouter } from 'vue-router'
import { Setting, Search } from '@element-plus/icons-vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const router = useRouter()
const data = ref({})
const config = ref({})
const dialog = ref(false)
const saving = ref(false)
const loading = ref(false)
const query = ref({ website: '' })
const form = ref({ mode: 'demo', futianUsername: '', futianPassword: '' })
const page = ref(1)
const pageSize = ref(30)
const chartEl = ref(null)
let chart = null

const sourceTag = computed(() => (data.value.source === 'futian' ? 'success' : 'info'))
const pagedRecords = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return (data.value.records || []).slice(start, start + pageSize.value)
})

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yl_admin_token') || ''}` }
}

async function api(path, options = {}) {
  const res = await fetch(path, { headers: headers(), ...options })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) {
    localStorage.removeItem('yl_admin_token')
    router.push('/admin/login')
    throw new Error(t('a_login_expired'))
  }
  if (!res.ok) throw new Error(json.message || t('a_request_failed'))
  return json
}

function fmtMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '-'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

async function loadConfig() {
  config.value = await api('/api/customs/config')
  form.value = { mode: config.value.mode || 'demo', futianUsername: config.value.futianUsername || '', futianPassword: config.value.futianPassword || '' }
}

function openConfig() {
  form.value = { mode: config.value.mode || 'demo', futianUsername: config.value.futianUsername || '', futianPassword: config.value.futianPassword || '' }
  dialog.value = true
}

async function saveConfig() {
  saving.value = true
  try {
    await api('/api/customs/config', { method: 'PUT', body: JSON.stringify(form.value) })
    ElMessage.success(t('ac_config_saved'))
    dialog.value = false
    await loadConfig()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function doQuery() {
  const website = query.value.website.trim()
  if (!website) return ElMessage.warning(t('ac_need_website'))
  loading.value = true
  page.value = 1
  try {
    data.value = await api('/api/customs/query', { method: 'POST', body: JSON.stringify({ website }) })
    await nextTick()
    renderChart()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function renderChart() {
  if (!chartEl.value) return
  if (!chart) {
    chart = echarts.init(chartEl.value)
    window.addEventListener('resize', onResize)
  }
  const monthly = data.value.monthly || []
  chart.setOption({
    color: ['#409eff', '#67c23a'],
    tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'shadow' }, valueFormatter: (v) => fmtMoney(v) },
    legend: { data: [t('ac_legend_export'), t('ac_legend_import')], bottom: 0 },
    grid: { left: 70, right: 24, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: monthly.map((m) => m.month), axisLabel: { color: '#909399' } },
    yAxis: { type: 'value', axisLabel: { color: '#909399', formatter: (v) => (v >= 1000 ? `${v / 1000}k` : v) }, splitLine: { lineStyle: { color: '#f0f2f5' } } },
    series: [
      { name: t('ac_legend_export'), type: 'bar', data: monthly.map((m) => m.exportAmount), barMaxWidth: 18, itemStyle: { borderRadius: [3, 3, 0, 0] } },
      { name: t('ac_legend_import'), type: 'bar', data: monthly.map((m) => m.importAmount), barMaxWidth: 18, itemStyle: { borderRadius: [3, 3, 0, 0] } }
    ]
  })
}

function onResize() {
  chart && chart.resize()
}

watch(pageSize, () => { page.value = 1 })
watch(() => data.value.monthly, () => { nextTick(renderChart) }, { deep: true })

onMounted(() => {
  loadConfig().catch((e) => ElMessage.error(e.message))
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart && chart.dispose()
})
</script>

<style scoped>
.head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.block { margin-bottom: 18px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.stat-card { background: var(--yl-white); border: 1px solid var(--yl-border); border-radius: 8px; padding: 18px; }
.stat-card .num { font-size: 22px; font-weight: 700; color: #303133; }
.stat-card .unit { font-size: 13px; color: #909399; margin-left: 4px; }
.stat-card .label { margin-top: 6px; font-size: 13px; color: #909399; }
.customs-chart { height: 320px; }
.table-head { display: flex; align-items: center; justify-content: space-between; }
</style>
