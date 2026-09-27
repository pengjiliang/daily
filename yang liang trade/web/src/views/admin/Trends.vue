<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">医疗器械热卖关键词趋势分析</h2>
        <p class="page-sub">当前数据源：<el-tag size="small" :type="sourceTag" style="margin-right: 6px">{{ data.sourceLabel || '演示数据' }}</el-tag>
          <span v-if="data.source === 'trends'" style="color: #909399">Google Trends 实时搜索热度（12 个月）</span>
          <span v-else-if="data.source === 'ads'" style="color: #909399">Google Ads API 官方数据</span>
          <span v-else style="color: #909399">内置演示数据（确定性模拟）</span>
        </p>
      </div>
      <el-button type="primary" @click="openConfig"><el-icon><Setting /></el-icon>数据源配置</el-button>
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
        <div class="num">{{ data.score ?? '-' }}<span class="unit">分</span></div>
        <div class="label">紧跟趋势评分（覆盖率）</div>
        <el-progress :percentage="data.score || 0" :show-text="false" style="margin-top: 10px" />
      </div>
      <div class="stat-card">
        <div class="num">{{ data.covered ?? '-' }}<span class="unit">/ {{ data.total }}</span></div>
        <div class="label">已覆盖热卖关键词</div>
      </div>
      <div class="stat-card">
        <div class="num">{{ data.hotWords ?? '-' }}</div>
        <div class="label">高热关键词（热度 ≥ 70）</div>
      </div>
    </div>

    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span>热卖关键词走势与覆盖情况</span>
          <span style="font-size: 13px; color: #909399">更新时间：{{ data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '-' }}</span>
        </div>
      </template>

      <el-alert
        v-if="advice.length"
        type="success"
        :closable="false"
        show-icon
        title="销售建议"
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
            <el-tag :type="activeItem.covered ? 'success' : 'info'" size="small" style="margin-left: 6px">{{ activeItem.covered ? '已覆盖' : '未覆盖' }}</el-tag>
          </div>
          <el-descriptions :column="4" border size="small" class="detail-desc">
            <el-descriptions-item label="分类">{{ activeItem.categoryLabel }}</el-descriptions-item>
            <el-descriptions-item label="当前热度">
              <span :style="{ color: activeItem.hot >= 70 ? '#f56c6c' : '#606266', fontWeight: 700 }">{{ activeItem.hot }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="匹配产品数">{{ activeItem.productCount }}</el-descriptions-item>
            <el-descriptions-item label="覆盖状态">
              <el-tag :type="activeItem.covered ? 'success' : 'info'" size="small">{{ activeItem.covered ? '已覆盖' : '未覆盖' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="已覆盖产品" :span="4">
              <span v-if="activeItem.products.length">{{ activeItem.products.join('、') }}</span>
              <span v-else style="color: #c0c4cc">—</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <span>关键词覆盖明细表（按热度从高到低排名）</span>
      </template>
      <el-table :data="rankedItems" size="default" style="width: 100%" v-loading="loading" border>
        <el-table-column label="排名" width="70" align="center">
          <template #default="{ row }">{{ row.rank }}</template>
        </el-table-column>
        <el-table-column label="关键词" min-width="180">
          <template #default="{ row }">
            <div class="kw"><b>{{ row.label }}</b><span class="kw-en">{{ row.keyword }}</span></div>
          </template>
        </el-table-column>
        <el-table-column prop="categoryLabel" label="分类" width="100" />
        <el-table-column prop="hot" label="热度分" width="90" sortable>
          <template #default="{ row }">
            <span :style="{ color: row.hot >= 70 ? '#f56c6c' : '#606266', fontWeight: 700 }">{{ row.hot }}</span>
          </template>
        </el-table-column>
        <el-table-column label="趋势方向" width="95">
          <template #default="{ row }">
            <el-tag :type="directionTag(row.direction)" size="small">{{ directionText(row.direction) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="productCount" label="覆盖数量" width="95" align="center" sortable>
          <template #default="{ row }">{{ row.productCount }}</template>
        </el-table-column>
        <el-table-column label="覆盖状态" width="95">
          <template #default="{ row }">
            <el-tag :type="row.covered ? 'success' : 'info'" size="small">{{ row.covered ? '已覆盖' : '未覆盖' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="已覆盖产品" min-width="180">
          <template #default="{ row }">
            <span v-if="row.products.length" class="prod-list">{{ row.products.join('、') }}</span>
            <span v-else style="color: #c0c4cc">—</span>
          </template>
        </el-table-column>
        <el-table-column label="优化建议" min-width="200">
          <template #default="{ row }">
            <span :style="{ color: adviceColor(row) }">{{ rowAdvice(row) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" title="趋势数据源配置" width="560px">
      <el-form :model="form" label-position="top">
        <el-form-item label="数据源模式">
          <el-radio-group v-model="form.mode">
            <el-radio value="trends">Google Trends 实时（方案1，免费无 key）</el-radio>
            <el-radio value="ads">Google Ads API（方案2，官方合规）</el-radio>
            <el-radio value="demo">演示数据</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="form.mode === 'trends'">
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px"
            title="通过非官方接口获取 Google Trends 真实搜索热度，无需 API Key。中国大陆访问需配置代理。" />
          <el-form-item label="HTTP 代理地址（Clash Verge 等，留空走直连）">
            <el-input v-model="form.proxyUrl" placeholder="如 http://127.0.0.1:7890" />
          </el-form-item>
          <el-form-item label="地区代码（留空为全球，如 US / SG / MY）">
            <el-input v-model="form.geo" placeholder="如 US" />
          </el-form-item>
        </template>

        <template v-if="form.mode === 'ads'">
          <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px"
            title="需自行注册 Google Ads 开发者账号并完成 OAuth 授权（开发 Token / Client ID / Client Secret / Refresh Token / Customer ID）。配置齐全后生效，未配置时自动回退演示数据。" />
          <el-form-item label="Developer Token" required>
            <el-input v-model="form.adsDeveloperToken" type="password" show-password placeholder="Google Ads 开发人员令牌" />
          </el-form-item>
          <el-form-item label="Client ID" required>
            <el-input v-model="form.adsClientId" placeholder="OAuth2 客户端 ID" />
          </el-form-item>
          <el-form-item label="Client Secret" required>
            <el-input v-model="form.adsClientSecret" type="password" show-password placeholder="OAuth2 客户端密钥" />
          </el-form-item>
          <el-form-item label="Refresh Token" required>
            <el-input v-model="form.adsRefreshToken" type="password" show-password placeholder="OAuth2 刷新令牌" />
          </el-form-item>
          <el-form-item label="Customer ID" required>
            <el-input v-model="form.adsCustomerId" placeholder="如 1234567890" />
          </el-form-item>
        </template>

        <el-alert v-if="form.mode === 'demo'" type="info" :closable="false" show-icon
          title="使用内置确定性演示数据，仅用于界面预览，不反映真实趋势。" />
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存并刷新</el-button>
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
    throw new Error('登录已过期，请重新登录')
  }
  if (!res.ok) throw new Error(json.message || '请求失败')
  return json
}

function directionTag(d) {
  if (d === 'up') return 'danger'
  if (d === 'down') return 'success'
  return 'info'
}
function directionText(d) {
  if (d === 'up') return '上升'
  if (d === 'down') return '下降'
  return '平稳'
}

const sourceTag = computed(() => {
  if (data.value.source === 'trends') return 'success'
  if (data.value.source === 'ads') return 'primary'
  return 'info'
})

const advice = computed(() => {
  const items = data.value.items || []
  const gap = items.filter((i) => i.hot >= 70 && !i.covered)
  const hotCovered = items.filter((i) => i.hot >= 70 && i.covered)
  const parts = []
  if (gap.length) parts.push(`高热度（≥70）但尚无产品覆盖的关键词：${gap.map((i) => i.label).join('、')}，建议优先上架相关产品以紧跟趋势。`)
  if (hotCovered.length) parts.push(`已覆盖的高热度关键词：${hotCovered.map((i) => i.label).join('、')}，建议加大推广投入。`)
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
  if (row.hot >= 70) return row.covered ? '高热度已覆盖，建议加大推广' : '高热度未覆盖，建议优先上架'
  if (row.direction === 'up') return row.covered ? '上升趋势已覆盖，可加强推广' : '上升趋势未覆盖，建议关注'
  if (row.direction === 'down') return '热度下滑，建议观察或优化'
  return '热度平稳，建议维持'
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
    ElMessage.success('已保存，正在刷新数据')
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
.stat-card { background: #fff; border-radius: var(--yl-radius); border: 1px solid #eef2f7; padding: 24px; }
.stat-card .num { font-size: 30px; font-weight: 800; color: var(--yl-primary); }
.stat-card .num .unit { font-size: 14px; font-weight: 400; color: #909399; margin-left: 4px; }
.stat-card .label { color: var(--yl-text-light); margin-top: 6px; font-size: 14px; }
.detail { margin-top: 16px; background: #fafbfc; border: 1px solid #eef2f7; border-radius: var(--yl-radius); padding: 16px; }
.detail-title { display: flex; align-items: center; margin-bottom: 12px; }
.kw-en { color: #909399; font-size: 13px; margin-left: 8px; }
.detail-desc { margin-top: 0; }
.kw { display: flex; flex-direction: column; }
.kw .kw-en { color: #909399; font-size: 12px; }
.prod-list { color: #606266; font-size: 13px; }
</style>
