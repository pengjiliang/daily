<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">海关数据查询</h2>
        <p class="page-sub">根据客户网址查询客户公司信息及近一年海关进出口数据（仅管理员可见）
          <el-tag size="small" :type="sourceTag" style="margin-left: 6px">{{ data.sourceLabel || '演示数据' }}</el-tag>
        </p>
      </div>
      <el-button type="primary" @click="openConfig"><el-icon><Setting /></el-icon>数据源配置</el-button>
    </div>

    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
      支持两种数据源：<b>演示数据</b>（默认，无需配置，根据网址确定性生成模拟海关记录）与 <b>富通天下</b>
      （真实海关数据源，需在「数据源配置」填写账号；账号未配置时自动回退演示数据）。
    </el-alert>

    <el-alert v-if="data.note" type="warning" :closable="false" show-icon :title="data.note" style="margin-bottom: 16px" />

    <!-- 查询 -->
    <el-card shadow="never" class="block">
      <template #header><b>① 查询客户海关数据</b></template>
      <el-form :inline="true" :model="query" label-width="80px" @submit.prevent>
        <el-form-item label="客户网址">
          <el-input v-model="query.website" placeholder="粘贴客户网站域名，如 joytechhealth.com" style="width: 360px" @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="doQuery">
            <el-icon><Search /></el-icon>&nbsp;{{ loading ? '查询中...' : '查询' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <template v-if="data.website">
      <!-- 公司信息 -->
      <el-card shadow="never" class="block">
        <template #header><b>② 客户公司信息</b></template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="公司名称" :span="2">{{ data.company.name }}</el-descriptions-item>
          <el-descriptions-item label="国家/地区">{{ data.company.country }}</el-descriptions-item>
          <el-descriptions-item label="注册地址" :span="3">{{ data.company.address }}</el-descriptions-item>
          <el-descriptions-item label="成立年份">{{ data.company.founded }}</el-descriptions-item>
          <el-descriptions-item label="公司规模">{{ data.company.employees }}</el-descriptions-item>
          <el-descriptions-item label="主营产品">
            <el-tag v-for="p in data.company.products" :key="p" size="small" style="margin-right: 6px">{{ p }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 汇总统计 -->
      <div class="stats">
        <div class="stat-card">
          <div class="num">{{ fmtMoney(data.summary.totalExport) }}</div>
          <div class="label">近一年出口总额（USD）</div>
        </div>
        <div class="stat-card">
          <div class="num">{{ fmtMoney(data.summary.totalImport) }}</div>
          <div class="label">近一年进口总额（USD）</div>
        </div>
        <div class="stat-card">
          <div class="num">{{ data.summary.totalRecords }}<span class="unit">笔</span></div>
          <div class="label">近一年交易记录</div>
        </div>
        <div class="stat-card">
          <div class="num">{{ data.summary.partnerCount }}<span class="unit">国</span></div>
          <div class="label">贸易伙伴国家</div>
        </div>
      </div>

      <!-- 月度趋势 -->
      <el-card shadow="never" class="block">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span>近一年月度进出口金额趋势（USD）</span>
            <span style="font-size: 13px; color: #909399">更新时间：{{ data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '-' }}</span>
          </div>
        </template>
        <div ref="chartEl" class="customs-chart" v-loading="loading" />
      </el-card>

      <!-- 主要贸易伙伴 -->
      <el-card shadow="never" class="block" v-if="data.summary.topPartners.length">
        <template #header><b>主要贸易伙伴 Top {{ data.summary.topPartners.length }}</b></template>
        <el-table :data="data.summary.topPartners" size="default" style="width: 100%" border>
          <el-table-column type="index" label="排名" width="70" align="center" />
          <el-table-column prop="country" label="国家/地区" min-width="140" show-overflow-tooltip />
          <el-table-column label="交易金额（USD）" min-width="160" align="right">
            <template #default="{ row }">{{ fmtMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="count" label="交易笔数" width="110" align="center" />
        </el-table>
      </el-card>

      <!-- 明细记录 -->
      <el-card shadow="never" class="block">
        <template #header>
          <div class="table-head">
            <span><b>③ 进出口明细记录</b>（共 {{ data.records.length }} 条）</span>
          </div>
        </template>
        <el-table :data="pagedRecords" size="default" style="width: 100%" border>
          <el-table-column prop="date" label="日期" width="105" />
          <el-table-column label="方向" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.direction === 'export' ? 'success' : 'warning'" size="small">
                {{ row.direction === 'export' ? '出口' : '进口' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="hsCode" label="HS 编码" width="100" />
          <el-table-column prop="hsName" label="商品描述" min-width="190" show-overflow-tooltip />
          <el-table-column prop="country" label="贸易国家" width="110" show-overflow-tooltip />
          <el-table-column prop="port" label="港口" width="110" show-overflow-tooltip />
          <el-table-column prop="ship" label="船司" width="100" show-overflow-tooltip />
          <el-table-column prop="qty" label="数量" width="100" align="right" />
          <el-table-column prop="unit" label="单位" width="64" align="center" />
          <el-table-column label="金额（USD）" min-width="130" align="right">
            <template #default="{ row }">{{ fmtMoney(row.amount) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination v-if="data.records.length" style="margin-top: 14px; justify-content: flex-end"
          layout="total, sizes, prev, pager, next, jumper"
          :total="data.records.length" v-model:current-page="page" v-model:page-size="pageSize"
          :page-sizes="[10, 30, 50, 100, 200, 500]" />
        <el-empty v-else-if="!loading" description="暂无记录，请输入客户网址查询" />
      </el-card>
    </template>
    <el-empty v-else description="请输入客户网址后点击「查询」" style="margin-top: 40px" />

    <!-- 数据源配置 -->
    <el-dialog v-model="dialog" title="海关数据源配置" width="520px">
      <el-form :model="form" label-position="top">
        <el-form-item label="数据源模式">
          <el-radio-group v-model="form.mode">
            <el-radio value="demo">演示数据（默认，无需配置）</el-radio>
            <el-radio value="futian">富通天下（真实源，需账号）</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="form.mode === 'demo'">
          <el-alert type="info" :closable="false" show-icon title="根据客户网址确定性生成公司信息与近一年海关模拟记录，仅用于界面预览。" />
        </template>
        <template v-if="form.mode === 'futian'">
          <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px"
            title="需拥有富通天下海关数据账号。账号未配置或查询失败时自动回退演示数据。" />
          <el-form-item label="富通天下账号" required>
            <el-input v-model="form.futianUsername" placeholder="登录账号 / 手机号" />
          </el-form-item>
          <el-form-item label="富通天下密码" required>
            <el-input v-model="form.futianPassword" type="password" show-password placeholder="登录密码" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存并刷新</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
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
    throw new Error('登录已过期，请重新登录')
  }
  if (!res.ok) throw new Error(json.message || '请求失败')
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
    ElMessage.success('配置已保存')
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
  if (!website) return ElMessage.warning('请输入客户网址')
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
    legend: { data: ['出口金额', '进口金额'], bottom: 0 },
    grid: { left: 70, right: 24, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: monthly.map((m) => m.month), axisLabel: { color: '#909399' } },
    yAxis: { type: 'value', axisLabel: { color: '#909399', formatter: (v) => (v >= 1000 ? `${v / 1000}k` : v) }, splitLine: { lineStyle: { color: '#f0f2f5' } } },
    series: [
      { name: '出口金额', type: 'bar', data: monthly.map((m) => m.exportAmount), barMaxWidth: 18, itemStyle: { borderRadius: [3, 3, 0, 0] } },
      { name: '进口金额', type: 'bar', data: monthly.map((m) => m.importAmount), barMaxWidth: 18, itemStyle: { borderRadius: [3, 3, 0, 0] } }
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
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; }
.stat-card .num { font-size: 22px; font-weight: 700; color: #303133; }
.stat-card .unit { font-size: 13px; color: #909399; margin-left: 4px; }
.stat-card .label { margin-top: 6px; font-size: 13px; color: #909399; }
.customs-chart { height: 320px; }
.table-head { display: flex; align-items: center; justify-content: space-between; }
</style>
