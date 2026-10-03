<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">{{ t('at_title') }}</h2>
        <p class="page-sub">{{ t('at_sub') }}<el-tag size="small" :type="sourceTag" style="margin-right: 6px">{{ sourceText }}</el-tag>
          <span v-if="data.source === 'trends'" style="color: #909399">{{ t('at_sub_trends') }}</span>
          <span v-else-if="data.source === 'ads'" style="color: #909399">{{ t('at_sub_ads') }}</span>
          <span v-else style="color: #909399">{{ t('at_sub_demo') }}</span>
        </p>
      </div>
      <el-button type="primary" @click="openConfig"><el-icon><Setting /></el-icon>{{ t('at_config_btn') }}</el-button>
    </div>

    <el-alert
      v-if="data.sourceNote"
      type="warning"
      :closable="false"
      show-icon
      :title="data.sourceNote"
      style="margin-bottom: 16px"
    />

    <div class="stats">
      <div class="stat-card">
        <div class="num">{{ data.score ?? '-' }}<span class="unit">{{ t('at_unit') }}</span></div>
        <div class="label">{{ t('at_score') }}</div>
        <el-progress :percentage="data.score || 0" :show-text="false" style="margin-top: 10px" />
      </div>
      <div class="stat-card">
        <div class="num">{{ data.covered ?? '-' }}<span class="unit">/ {{ data.total }}</span></div>
        <div class="label">{{ t('at_covered') }}</div>
      </div>
      <div class="stat-card">
        <div class="num">{{ data.hotWords ?? '-' }}</div>
        <div class="label">{{ t('at_hot_keywords') }}</div>
      </div>
    </div>

    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span>{{ t('at_chart_title') }}</span>
          <span style="font-size: 13px; color: #909399">{{ t('at_updated_at', { t: data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '-' }) }}</span>
        </div>
      </template>

      <el-alert
        v-if="advice.length"
        type="success"
        :closable="false"
        show-icon
        :title="t('at_sales_advice')"
        :description="advice"
        style="margin-bottom: 12px"
      />

      <div v-loading="loading">
        <TrendChart :items="data.items || []" @select="activeKey = $event" />
        <div v-if="activeItem" class="detail">
          <div class="detail-title">
            <b>{{ activeItem.label }}</b>
            <span class="kw-en">{{ activeItem.keyword }}</span>
            <el-tag :type="directionTag(activeItem.direction)" size="small" style="margin-left: 8px">{{ directionText(activeItem.direction) }}</el-tag>
            <el-tag :type="activeItem.covered ? 'success' : 'info'" size="small" style="margin-left: 6px">{{ activeItem.covered ? t('at_covered_tag') : t('at_uncovered_tag') }}</el-tag>
          </div>
          <el-descriptions :column="4" border size="small" class="detail-desc">
            <el-descriptions-item :label="t('at_detail_category')">{{ activeItem.categoryLabel }}</el-descriptions-item>
            <el-descriptions-item :label="t('at_detail_hot')">
              <span :style="{ color: activeItem.hot >= 70 ? '#f56c6c' : '#606266', fontWeight: 700 }">{{ activeItem.hot }}</span>
            </el-descriptions-item>
            <el-descriptions-item :label="t('at_detail_product_count')">{{ activeItem.productCount }}</el-descriptions-item>
            <el-descriptions-item :label="t('at_detail_coverage')">
              <el-tag :type="activeItem.covered ? 'success' : 'info'" size="small">{{ activeItem.covered ? t('at_covered_tag') : t('at_uncovered_tag') }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="t('at_detail_covered_products')" :span="4">
              <span v-if="activeItem.products.length">{{ activeItem.products.join('、') }}</span>
              <span v-else style="color: #c0c4cc">—</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <span>{{ t('at_table_title') }}</span>
      </template>
      <el-table :data="rankedItems" size="default" style="width: 100%" v-loading="loading" border>
        <el-table-column :label="t('at_col_rank')" width="70" align="center">
          <template #default="{ row }">{{ row.rank }}</template>
        </el-table-column>
        <el-table-column :label="t('at_col_keyword')" min-width="180">
          <template #default="{ row }">
            <div class="kw"><b>{{ row.label }}</b><span class="kw-en">{{ row.keyword }}</span></div>
          </template>
        </el-table-column>
        <el-table-column prop="categoryLabel" :label="t('at_col_category')" width="100" />
        <el-table-column prop="hot" :label="t('at_col_hot')" width="90" sortable>
          <template #default="{ row }">
            <span :style="{ color: row.hot >= 70 ? '#f56c6c' : '#606266', fontWeight: 700 }">{{ row.hot }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('at_col_direction')" width="95">
          <template #default="{ row }">
            <el-tag :type="directionTag(row.direction)" size="small">{{ directionText(row.direction) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="productCount" :label="t('at_col_product_count')" width="95" align="center" sortable>
          <template #default="{ row }">{{ row.productCount }}</template>
        </el-table-column>
        <el-table-column :label="t('at_col_coverage')" width="95">
          <template #default="{ row }">
            <el-tag :type="row.covered ? 'success' : 'info'" size="small">{{ row.covered ? t('at_covered_tag') : t('at_uncovered_tag') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('at_col_covered_products')" min-width="180">
          <template #default="{ row }">
            <span v-if="row.products.length" class="prod-list">{{ row.products.join('、') }}</span>
            <span v-else style="color: #c0c4cc">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('at_col_advice')" min-width="200">
          <template #default="{ row }">
            <span :style="{ color: adviceColor(row) }">{{ rowAdvice(row) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="t('at_config_title')" width="560px">
      <el-form :model="form" label-position="top">
        <el-form-item :label="t('at_mode')">
          <el-radio-group v-model="form.mode">
            <el-radio value="trends">{{ t('at_mode_trends') }}</el-radio>
            <el-radio value="ads">{{ t('at_mode_ads') }}</el-radio>
            <el-radio value="demo">{{ t('at_mode_demo') }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="form.mode === 'trends'">
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px"
            :title="t('at_trends_tip')" />
          <el-form-item :label="t('at_proxy')">
            <el-input v-model="form.proxyUrl" :placeholder="t('at_proxy_ph')" />
          </el-form-item>
          <el-form-item :label="t('at_geo')">
            <el-input v-model="form.geo" :placeholder="t('at_geo_ph')" />
          </el-form-item>
        </template>

        <template v-if="form.mode === 'ads'">
          <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px"
            :title="t('at_ads_tip')" />
          <el-form-item label="Developer Token" required>
            <el-input v-model="form.adsDeveloperToken" type="password" show-password :placeholder="t('at_ads_dev_token')" />
          </el-form-item>
          <el-form-item label="Client ID" required>
            <el-input v-model="form.adsClientId" :placeholder="t('at_ads_client_id')" />
          </el-form-item>
          <el-form-item label="Client Secret" required>
            <el-input v-model="form.adsClientSecret" type="password" show-password :placeholder="t('at_ads_client_secret')" />
          </el-form-item>
          <el-form-item label="Refresh Token" required>
            <el-input v-model="form.adsRefreshToken" type="password" show-password :placeholder="t('at_ads_refresh_token')" />
          </el-form-item>
          <el-form-item label="Customer ID" required>
            <el-input v-model="form.adsCustomerId" :placeholder="t('at_ads_customer_id')" />
          </el-form-item>
        </template>

        <el-alert v-if="form.mode === 'demo'" type="info" :closable="false" show-icon
          :title="t('at_demo_tip')" />
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{ t('a_cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">{{ t('at_save_refresh') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { Setting } from '@element-plus/icons-vue'
import TrendChart from './TrendChart.vue'
import { t } from '@/i18n'

const router = useRouter()
const data = ref({})
const config = ref({})
const dialog = ref(false)
const saving = ref(false)
const loading = ref(false)
const activeKey = ref('')
const form = ref({ mode: 'trends', proxyUrl: '', geo: '', adsDeveloperToken: '', adsClientId: '', adsClientSecret: '', adsRefreshToken: '', adsCustomerId: '' })

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

function directionTag(d) {
  if (d === 'up') return 'danger'
  if (d === 'down') return 'success'
  return 'info'
}
function directionText(d) {
  if (d === 'up') return t('at_dir_up')
  if (d === 'down') return t('at_dir_down')
  return t('at_dir_flat')
}

const sourceTag = computed(() => {
  if (data.value.source === 'trends') return 'success'
  if (data.value.source === 'ads') return 'primary'
  return 'info'
})

const sourceText = computed(() => {
  if (data.value.source === 'trends') return t('at_sub_trends')
  if (data.value.source === 'ads') return t('at_sub_ads')
  return t('at_sub_demo')
})

const advice = computed(() => {
  const items = data.value.items || []
  const gap = items.filter((i) => i.hot >= 70 && !i.covered)
  const hotCovered = items.filter((i) => i.hot >= 70 && i.covered)
  const parts = []
  if (gap.length) parts.push(t('at_advice_gap', { list: gap.map((i) => i.label).join('、') }))
  if (hotCovered.length) parts.push(t('at_advice_hot_covered', { list: hotCovered.map((i) => i.label).join('、') }))
  return parts.join(' ')
})

// 当前选中详情：默认热度最高的一项，点击图线切换
const activeItem = computed(() => {
  const items = data.value.items || []
  if (!items.length) return null
  return items.find((i) => i.label === activeKey.value) || [...items].sort((a, b) => b.hot - a.hot)[0]
})

// 明细表：全部关键词按热度从高到低排名
const rankedItems = computed(() =>
  [...(data.value.items || [])].sort((a, b) => b.hot - a.hot).map((i, idx) => ({ ...i, rank: idx + 1 }))
)

// 每行优化建议
function rowAdvice(row) {
  if (row.hot >= 70) return row.covered ? t('at_row_advice_hot_covered') : t('at_row_advice_hot_uncovered')
  if (row.direction === 'up') return row.covered ? t('at_row_advice_up_covered') : t('at_row_advice_up_uncovered')
  if (row.direction === 'down') return t('at_row_advice_down')
  return t('at_row_advice_flat')
}
function adviceColor(row) {
  if (row.hot >= 70 && !row.covered) return '#f56c6c'
  if (row.hot >= 70) return '#e6a23c'
  if (row.direction === 'up') return '#409eff'
  return '#909399'
}

async function load() {
  loading.value = true
  try {
    data.value = await api('/api/trends/overview')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function loadConfig() {
  try {
    config.value = await api('/api/trends/config')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function openConfig() {
  form.value = { ...config.value }
  dialog.value = true
}

async function saveConfig() {
  saving.value = true
  try {
    await api('/api/trends/config', { method: 'PUT', body: JSON.stringify(form.value) })
    dialog.value = false
    ElMessage.success(t('at_saved_refreshing'))
    await Promise.all([load(), loadConfig()])
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
  loadConfig()
})
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-title { margin: 0 0 6px; font-size: 24px; }
.page-sub { margin: 0; font-size: 14px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.stat-card { background: var(--yl-white); border-radius: var(--yl-radius); border: 1px solid var(--yl-border); padding: 24px; }
.stat-card .num { font-size: 30px; font-weight: 800; color: var(--yl-primary); }
.stat-card .num .unit { font-size: 14px; font-weight: 400; color: #909399; margin-left: 4px; }
.stat-card .label { color: var(--yl-text-light); margin-top: 6px; font-size: 14px; }
.detail { margin-top: 16px; background: var(--yl-hover-bg); border: 1px solid var(--yl-border); border-radius: var(--yl-radius); padding: 16px; }
.detail-title { display: flex; align-items: center; margin-bottom: 12px; }
.kw-en { color: #909399; font-size: 13px; margin-left: 8px; }
.detail-desc { margin-top: 0; }
.kw { display: flex; flex-direction: column; }
.kw .kw-en { color: #909399; font-size: 12px; }
.prod-list { color: #606266; font-size: 13px; }
</style>
