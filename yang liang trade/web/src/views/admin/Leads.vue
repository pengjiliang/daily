<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">{{ t('ale_title') }}</h2>
        <p class="page-sub">{{ t('ale_sub') }}</p>
      </div>
    </div>

    <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px">
      {{ t('ale_intro_part1') }}
      {{ t('ale_intro_part2') }}
      {{ t('ale_intro_part3') }}
      {{ t('ale_intro_part4') }}
    </el-alert>

    <!-- 抓取配置 -->
    <el-card shadow="never" class="block">
      <template #header><b>{{ t('ale_step1') }}</b></template>
      <el-form :inline="true" :model="cfg" label-width="80px">
        <el-form-item :label="t('ale_keyword')">
          <el-input v-model="cfg.keyword" :placeholder="t('ale_keyword_ph')" style="width: 280px" />
        </el-form-item>
        <el-form-item :label="t('ale_region')">
          <el-select v-model="cfg.regions" multiple :placeholder="t('ale_region_ph')" style="width: 260px">
            <el-option v-for="r in REGIONS" :key="r.key" :label="t(r.tkey)" :value="r.key" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ale_types')">
          <el-select v-model="cfg.types" multiple :placeholder="t('ale_types_ph')" style="width: 260px">
            <el-option v-for="opt in TYPES" :key="opt.value" :label="t(opt.tkey)" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ale_source')">
          <el-select v-model="cfg.mode" style="width: 280px">
            <el-option v-for="m in MODES" :key="m.key" :label="t(m.tkey)" :value="m.key" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="fetching" @click="fetchLeads">
            <el-icon><Search /></el-icon>&nbsp;{{ fetching ? t('ale_fetching') : t('ale_start_fetch') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 线索表格 -->
    <el-card shadow="never" class="block">
      <template #header>
        <div class="table-head">
          <span><b>{{ t('ale_step2') }}</b>{{ t('ale_result_n', { total, selected: selection.length }) }}</span>
          <el-button v-if="leads.length" link type="danger" @click="clearLeads">{{ t('ale_clear') }}</el-button>
        </div>
      </template>
      <el-table :data="leads" @selection-change="(rows) => (selection = rows)" style="width: 100%" border>
        <el-table-column type="selection" width="46" />
        <el-table-column type="index" label="#" width="60" :index="rowIndex" />
        <el-table-column prop="name" :label="t('ale_col_name')" min-width="150" />
        <el-table-column prop="type" :label="t('ale_col_type')" width="100" />
        <el-table-column prop="phone" :label="t('ale_col_phone')" width="125" />
        <el-table-column :label="t('ale_col_email')" min-width="190">
          <template #default="{ row }">
            <a v-if="row.email" :href="mailtoLink(row.email, row.name)" class="email-link">{{ row.email }}</a>
            <el-tag v-else type="info" size="small">{{ t('ale_none') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="website" :label="t('ale_col_website')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="region" :label="t('ale_col_region')" width="76" />
        <el-table-column prop="city" :label="t('ale_col_city')" width="90" />
        <el-table-column label="WhatsApp" width="86">
          <template #default="{ row }">
            <el-tag :type="row.hasWhatsApp ? 'success' : 'info'" size="small">{{ t(row.hasWhatsApp ? 'ale_recognized' : 'ale_unknown') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('ale_col_source')" width="76">
          <template #default="{ row }">
            <el-tag :type="srcTag(row.source)" size="small">{{ srcLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('ale_col_contact')" width="190" fixed="right" :resizable="false">
          <template #default="{ row }">
            <a v-if="row.phone" :href="waAppLink(row.phone, shortMsg(row.name))" class="cta cta-wa">WhatsApp</a>
            <a :href="'fb-messenger://'" class="cta cta-fb" @click="copyShort(row.name)">Messenger</a>
          </template>
        </el-table-column>
        <el-table-column :label="t('ale_col_actions')" width="66" fixed="right" :resizable="false">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeLead(row)">{{ t('a_delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-if="total" style="margin-top: 14px; justify-content: flex-end"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total" v-model:current-page="page" v-model:page-size="pageSize"
        :page-sizes="[10, 30, 50, 100, 200, 500]" @current-change="loadLeads" @size-change="changePageSize" />
      <el-empty v-if="!total" :description="t('ale_empty')" />
    </el-card>

    <!-- 群发 -->
    <el-card shadow="never" class="block">
      <template #header><b>{{ t('ale_step3') }}</b></template>
      <el-form label-position="top" class="send-form">
        <div class="send-grid">
          <el-form-item :label="t('ale_channel')">
            <el-radio-group v-model="sendChannel">
              <el-radio-button value="whatsapp">WhatsApp</el-radio-button>
              <el-radio-button value="facebook">Facebook Messenger</el-radio-button>
              <el-radio-button value="email">{{ t('ale_channel_email') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="sendChannel === 'email'" :label="t('ale_email_subject')">
            <el-input v-model="emailSubject" />
          </el-form-item>
          <el-form-item :label="t('ale_msg_template')">
            <el-input v-model="template" type="textarea" :rows="4" />
          </el-form-item>
        </div>
        <div class="send-actions">
          <el-button type="primary" :disabled="!selection.length" @click="preview">
            <el-icon><Promotion /></el-icon>&nbsp;{{ t('ale_gen', { n: selection.length }) }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <!-- 发送记录 -->
    <el-card shadow="never" class="block">
      <template #header><b>{{ t('ale_step4') }}</b></template>
      <el-table :data="campaigns" style="width: 100%" border>
        <el-table-column :label="t('ale_col_time')" width="170">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="channel" :label="t('ale_col_channel')" width="140" />
        <el-table-column prop="count" :label="t('ale_col_count')" width="80" />
        <el-table-column :label="t('ale_col_status')" width="100">
          <template #default="{ row }"><el-tag :type="row.status === '已发送' ? 'success' : 'info'" size="small">{{ row.status === '已发送' ? t('ale_status_sent') : row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="note" :label="t('ale_col_note')" min-width="240" show-overflow-tooltip />
      </el-table>
      <el-empty v-if="!campaigns.length" :description="t('ale_records_empty')" />
    </el-card>

    <!-- 消息预览抽屉 -->
    <el-drawer v-model="drawer" :title="t('ale_drawer_title', { n: previewList.length })" size="480px">
      <div class="pv-tip">
        <template v-if="sendChannel === 'email'">
          {{ t('ale_drawer_email_tip') }}
        </template>
        <template v-else>
          {{ t('ale_drawer_wa_tip1') }}{{ t('ale_drawer_wa_tip2') }}

        </template>
      </div>
      <div v-for="(m, i) in previewList" :key="i" class="pv-item">
        <div class="pv-name">{{ m.name }}</div>
        <div class="pv-phone">{{ m.phone }}</div>
        <div class="pv-text">{{ m.text }}</div>
        <div class="pv-actions">
          <el-button v-if="m.link" link type="primary" tag="a" :href="m.link" target="_blank" rel="noopener">{{ t('ale_open_send') }}</el-button>
          <el-button link type="success" @click="copyText(m.text)">{{ t('ale_copy') }}</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="markSent">{{ t('ale_mark_sent') }}</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Promotion } from '@element-plus/icons-vue'
import { t } from '@/i18n'

const REGIONS = [
  { key: 'se', label: '东南亚', tkey: 'ale_region_se' }, { key: 'sa', label: '南亚', tkey: 'ale_region_sa' },
  { key: 'ca', label: '中亚', tkey: 'ale_region_ca' }, { key: 'na', label: '北非', tkey: 'ale_region_na' }
]
const TYPES = [
  { value: '药店', tkey: 'ale_type_pharmacy' },
  { value: '诊所', tkey: 'ale_type_clinic' },
  { value: '医院', tkey: 'ale_type_hospital' },
  { value: '医疗器械经销商', tkey: 'ale_type_distributor' },
  { value: '医疗耗材商店', tkey: 'ale_type_supply' }
]
const MODES = [
  { key: 'demo', label: '演示数据（默认）', tkey: 'ale_src_demo' },
  { key: 'osm', label: 'OpenStreetMap Overpass（免费真实·无需 Key）', tkey: 'ale_src_osm' },
  { key: 'google', label: 'Google Places API（真实·需 Key+代理）', tkey: 'ale_src_google' },
  { key: 'ypk', label: 'BusinessList.pk 黄页（巴基斯坦·真实·无需 Key）', tkey: 'ale_src_ypk' }
]

const cfg = ref({ keyword: 'medical equipment', regions: ['se'], types: ['医疗器械经销商'], mode: 'demo' })
const template = ref('您好 {name}，我们是扬良贸易有限公司，专注医疗器械与医用产品出口，产品认证齐全、支持 OEM。如您有采购需求，欢迎回复或来电咨询，期待合作！')
const sendChannel = ref('whatsapp')
const emailSubject = ref('Development Inquiry from YANGLIANG Technology Co., Ltd Co., Ltd. - Medical Supplies')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const fetching = ref(false)
const leads = ref([])
const selection = ref([])
const campaigns = ref([])
const drawer = ref(false)
const previewList = ref([])

const MODE_LABEL = { demo: 'ale_mode_demo', osm: 'ale_mode_osm', google: 'ale_mode_google', ypk: 'ale_mode_ypk' }
function srcTag(s) { return s === 'google' ? 'primary' : s === 'osm' ? 'success' : s === 'ypk' ? 'danger' : 'warning' }
function srcLabel(s) { return s === 'google' ? 'Google' : s === 'osm' ? 'OSM' : s === 'ypk' ? t('ale_src_short_ypk') : t('ale_src_short_demo') }

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yl_admin_token') || ''}` }
}

async function api(path, options = {}) {
  const res = await fetch(`/api/leads${path}`, { headers: headers(), ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || t('a_request_failed'))
  return data
}

async function loadLeads() {
  try {
    const res = await api(`?page=${page.value}&pageSize=${pageSize.value}`)
    leads.value = res.items || []
    total.value = Number(res.total) || 0
    if (!leads.value.length && total.value > 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(total.value / pageSize.value))
      return loadLeads()
    }
  } catch (e) { ElMessage.error(e.message) }
}

async function loadCampaigns() {
  try { campaigns.value = await api('/campaigns') }
  catch (e) { ElMessage.error(e.message) }
}

async function load() {
  await Promise.all([loadLeads(), loadCampaigns()])
}
onMounted(load)

function changePageSize() {
  page.value = 1
  loadLeads()
}

function fmtTime(t) {
  return t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : ''
}

// 序号（跨分页连续）
function rowIndex(i) { return (page.value - 1) * pageSize.value + i + 1 }
// 唤起系统邮箱客户端发送开发信（mailto 协议），主题+正文自动预填
function mailtoLink(email, name) {
  const subject = encodeURIComponent(emailSubject.value.replaceAll('{name}', name))
  const body = encodeURIComponent(template.value.replaceAll('{name}', name))
  return `mailto:${email}?subject=${subject}&body=${body}`
}

// 唤起 WhatsApp 桌面 App 的链接（whatsapp:// 协议），消息自动预填
function waAppLink(phone, text) {
  return `whatsapp://send?phone=${(phone || '').replace(/[^0-9]/g, '')}&text=${encodeURIComponent(text)}`
}

function shortMsg(name) {
  return template.value.replaceAll('{name}', name)
}

async function copyShort(name) {
  await copyText(shortMsg(name))
}

async function waitForScrape(id) {
  while (true) {
    const job = await api(`/scrape/${id}`)
    if (job.status === 'success') return job
    if (job.status === 'failed') throw new Error(job.error || t('ale_fetch_failed_retry'))
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

async function fetchLeads() {
  if (!cfg.value.regions.length) return ElMessage.warning(t('ale_select_region'))
  fetching.value = true
  try {
    const queued = await api('/scrape', { method: 'POST', body: JSON.stringify(cfg.value) })
    const job = await waitForScrape(queued.id)
    page.value = 1
    await loadLeads()
    ElMessage.success(t('ale_fetch_done', { inserted: job.inserted || 0, skipped: job.skipped || 0, mode: t(MODE_LABEL[job.mode] || '') || job.mode || '' }))
  } catch (e) { ElMessage.error(e.message) }
  finally { fetching.value = false }
}

async function clearLeads() {
  await ElMessageBox.confirm(t('ale_confirm_clear'), t('a_confirm_title'), { type: 'warning' })
  try { await api('', { method: 'DELETE' }); leads.value = []; total.value = 0; page.value = 1; ElMessage.success(t('ale_cleared')) }
  catch (e) { ElMessage.error(e.message) }
}

async function removeLead(row) {
  await ElMessageBox.confirm(t('ale_confirm_delete', { name: row.name }), t('a_confirm_title'), { type: 'warning' })
  try { await api(`/${row.id}`, { method: 'DELETE' }); await load(); ElMessage.success(t('a_deleted')) }
  catch (e) { ElMessage.error(e.message) }
}

function preview() {
  const rows = (sendChannel.value === 'email' ? selection.value.filter((r) => r.email) : selection.value).slice(0, 10)
  previewList.value = rows.map((r) => {
    const text = template.value.replaceAll('{name}', r.name)
    let link = ''
    if (sendChannel.value === 'whatsapp') {
      link = waAppLink(r.phone, text)
    } else if (sendChannel.value === 'email') {
      link = mailtoLink(r.email, r.name)
    } else {
      // 唤起 Messenger 桌面 App（fb-messenger:// 协议）；无对方 FB 用户 ID，需在 App 内搜索联系人
      link = 'fb-messenger://'
    }
    return { name: r.name, phone: r.phone || r.email, text, link }
  })
  drawer.value = true
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); ElMessage.success(t('ale_copied')) } catch { ElMessage.info(text) }
}

async function markSent() {
  const count = previewList.value.length
  const channelName = sendChannel.value === 'whatsapp' ? 'WhatsApp' : 'Facebook Messenger'
  try {
    await api('/campaigns', {
      method: 'POST',
      body: JSON.stringify({ channel: channelName, count, status: '已发送', note: t('ale_sent_note', { count }) })
    })
    await load()
    drawer.value = false
    ElMessage.success(t('ale_recorded', { count }))
  } catch (e) { ElMessage.error(e.message) }
}
</script>

<style scoped>
.head { margin-bottom: 20px; }
.page-title { margin: 0 0 6px; font-size: 24px; }
.page-sub { margin: 0; color: var(--yl-text-light); font-size: 14px; }
.block { margin-bottom: 20px; }
.table-head { display: flex; justify-content: space-between; align-items: center; }
.send-form :deep(.el-textarea__inner) { font-size: 13px; }
.send-grid { max-width: 760px; }
.send-actions { margin-top: 4px; }
.pv-tip { background: #fff7e6; border: 1px solid #ffe7ba; color: #ad6800; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
.pv-item { border: 1px solid var(--yl-border); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.pv-name { font-weight: 700; }
.pv-phone { color: var(--yl-text-light); font-size: 13px; margin: 2px 0 8px; }
.pv-text { background: #f6f9fc; padding: 8px 10px; border-radius: 8px; font-size: 13px; line-height: 1.7; }
.pv-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.cta { display: inline-block; margin: 0 3px 2px 0; padding: 2px 7px; border-radius: 5px; font-size: 11px; line-height: 1.5; text-decoration: none; color: #fff; white-space: nowrap; }
.cta-wa { background: #25d366; }
.cta-wa:hover { background: #1eb857; }
.cta-fb { background: #1877f2; }
.cta-fb:hover { background: #0f67d6; }
.email-link { color: var(--yl-primary); text-decoration: none; }
.email-link:hover { text-decoration: underline; }
</style>

