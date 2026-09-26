<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">线索抓取与群发</h2>
        <p class="page-sub">自动抓取 Google 地图同行业店铺联系方式 → 筛选 → 群发 WhatsApp / Facebook 消息（仅管理员可见）</p>
      </div>
    </div>

    <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px">
      当前为<b>低成本零风险模式</b>：抓取支持四种数据源——<b>演示数据</b>（默认，无需配置）、<b>OpenStreetMap Overpass</b>
      （免费真实、无需 Key）、<b>BusinessList.pk 黄页</b>（巴基斯坦真实商家·无需 Key·关键词忽略按行业分类抓取）、<b>Google Places API</b>（真实，需根目录 <code>.env</code> 配置
      <code>GOOGLE_PLACES_API_KEY</code> + Clash 代理）。「联系 / 打开发送」直接唤起电脑上已安装的
      <b>WhatsApp / Messenger 桌面 App</b>；群发采用“生成消息 + 复制”半自动方式，避免网页自动化封号风险。后续可平滑升级为官方 Meta API 全自动群发。
    </el-alert>

    <!-- 抓取配置 -->
    <el-card shadow="never" class="block">
      <template #header><b>① 配置抓取任务</b></template>
      <el-form :inline="true" :model="cfg" label-width="80px">
        <el-form-item label="关键词">
          <el-input v-model="cfg.keyword" placeholder="关键词可留空；如 medical equipment / pharmacy" style="width: 280px" />
        </el-form-item>
        <el-form-item label="目标区域">
          <el-select v-model="cfg.regions" multiple placeholder="选择区域" style="width: 260px">
            <el-option v-for="r in REGIONS" :key="r.key" :label="r.label" :value="r.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标类型">
          <el-select v-model="cfg.types" multiple placeholder="选择店铺类型" style="width: 260px">
            <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="数据源">
          <el-select v-model="cfg.mode" style="width: 280px">
            <el-option v-for="m in MODES" :key="m.key" :label="m.label" :value="m.key" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="fetching" @click="fetchLeads">
            <el-icon><Search /></el-icon>&nbsp;开始抓取
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 线索表格 -->
    <el-card shadow="never" class="block">
      <template #header>
        <div class="table-head">
          <span><b>② 抓取结果</b>（共 {{ leads.length }} 条，已选 {{ selection.length }} 条）</span>
          <el-button v-if="leads.length" link type="danger" @click="clearLeads">清空</el-button>
        </div>
      </template>
      <el-table :data="pagedLeads" @selection-change="(rows) => (selection = rows)" style="width: 100%">
        <el-table-column type="selection" width="46" />
        <el-table-column type="index" label="#" width="60" :index="rowIndex" />
        <el-table-column prop="name" label="店铺名称" min-width="150" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="phone" label="电话" width="125" />
        <el-table-column label="邮箱" min-width="190">
          <template #default="{ row }">
            <a v-if="row.email" :href="mailtoLink(row.email, row.name)" class="email-link">{{ row.email }}</a>
            <el-tag v-else type="info" size="small">无</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="website" label="网站" min-width="120" show-overflow-tooltip />
        <el-table-column prop="region" label="区域" width="76" />
        <el-table-column prop="city" label="城市" width="90" />
        <el-table-column label="WhatsApp" width="86">
          <template #default="{ row }">
            <el-tag :type="row.hasWhatsApp ? 'success' : 'info'" size="small">{{ row.hasWhatsApp ? '已识别' : '未知' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="76">
          <template #default="{ row }">
            <el-tag :type="srcTag(row.source)" size="small">{{ srcLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="联系" width="176" fixed="right">
          <template #default="{ row }">
            <a v-if="row.phone" :href="waAppLink(row.phone, shortMsg(row.name))" class="cta cta-wa">WhatsApp</a>
            <a :href="'fb-messenger://'" class="cta cta-fb" @click="copyShort(row.name)">Messenger</a>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="66" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeLead(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-if="leads.length" style="margin-top: 14px; justify-content: flex-end"
        layout="total, sizes, prev, pager, next, jumper"
        :total="leads.length" v-model:current-page="page" v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]" />
      <el-empty v-if="!leads.length" description="尚未抓取线索，请先配置上方任务" />
    </el-card>

    <!-- 群发 -->
    <el-card shadow="never" class="block">
      <template #header><b>③ 群发消息（每次建议 ≤ 10 条，可拓展）</b></template>
      <el-form label-position="top" class="send-form">
        <div class="send-grid">
          <el-form-item label="发送渠道">
            <el-radio-group v-model="sendChannel">
              <el-radio-button value="whatsapp">WhatsApp</el-radio-button>
              <el-radio-button value="facebook">Facebook Messenger</el-radio-button>
              <el-radio-button value="email">Email 邮件</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="sendChannel === 'email'" label="邮件主题（{name} 将替换为店铺名称）">
            <el-input v-model="emailSubject" />
          </el-form-item>
          <el-form-item label="消息模板（{name} 将替换为店铺名称）">
            <el-input v-model="template" type="textarea" :rows="4" />
          </el-form-item>
        </div>
        <div class="send-actions">
          <el-button type="primary" :disabled="!selection.length" @click="preview">
            <el-icon><Promotion /></el-icon>&nbsp;生成消息（{{ selection.length }} 条）
          </el-button>
        </div>
      </el-form>
    </el-card>

    <!-- 发送记录 -->
    <el-card shadow="never" class="block">
      <template #header><b>④ 发送记录</b></template>
      <el-table :data="campaigns" style="width: 100%">
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="channel" label="渠道" width="140" />
        <el-table-column prop="count" label="条数" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }"><el-tag :type="row.status === '已发送' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="240" show-overflow-tooltip />
      </el-table>
      <el-empty v-if="!campaigns.length" description="暂无发送记录" />
    </el-card>

    <!-- 消息预览抽屉 -->
    <el-drawer v-model="drawer" :title="`待发送消息（${previewList.length} 条）`" size="480px">
      <div class="pv-tip">
        <template v-if="sendChannel === 'email'">
          零风险模式：<b>「打开发送」将唤起系统默认邮箱客户端</b>，自动带出收件人、主题与开发信正文，逐条点击发送即可。
        </template>
        <template v-else>
          零风险模式：<b>「打开发送」直接唤起桌面 App</b>。WhatsApp 会自动带出消息；Facebook 会打开 Messenger App，
          请在其中搜索联系人后粘贴消息发送（Google 抓到的线索无对方 FB 用户 ID，无法自动定位个人）。升级官方 API 后可全自动。
        </template>
      </div>
      <div v-for="(m, i) in previewList" :key="i" class="pv-item">
        <div class="pv-name">{{ m.name }}</div>
        <div class="pv-phone">{{ m.phone }}</div>
        <div class="pv-text">{{ m.text }}</div>
        <div class="pv-actions">
          <el-button v-if="m.link" link type="primary" tag="a" :href="m.link" target="_blank" rel="noopener">打开发送</el-button>
          <el-button link type="success" @click="copyText(m.text)">复制文案</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="markSent">全部标记为已发送</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Promotion } from '@element-plus/icons-vue'

const REGIONS = [
  { key: 'se', label: '东南亚' }, { key: 'sa', label: '南亚' },
  { key: 'ca', label: '中亚' }, { key: 'na', label: '北非' }
]
const TYPES = ['药店', '诊所', '医院', '医疗器械经销商', '医疗耗材商店']
const MODES = [
  { key: 'demo', label: '演示数据（默认）' },
  { key: 'osm', label: 'OpenStreetMap Overpass（免费真实·无需 Key）' },
  { key: 'google', label: 'Google Places API（真实·需 Key+代理）' },
  { key: 'ypk', label: 'BusinessList.pk 黄页（巴基斯坦·真实·无需 Key）' }
]

const cfg = ref({ keyword: 'medical equipment', regions: ['se'], types: ['医疗器械经销商'], mode: 'demo' })
const template = ref('您好 {name}，我们是扬良贸易有限公司，专注医疗器械与医用产品出口，产品认证齐全、支持 OEM。如您有采购需求，欢迎回复或来电咨询，期待合作！')
const sendChannel = ref('whatsapp')
const emailSubject = ref('Development Inquiry from Yangliang Trade Co., Ltd. - Medical Supplies')
const page = ref(1)
const pageSize = ref(10)

const fetching = ref(false)
const leads = ref([])
const selection = ref([])
const campaigns = ref([])
const drawer = ref(false)
const previewList = ref([])

const MODE_LABEL = { demo: '演示数据', osm: 'OpenStreetMap 真实数据', google: 'Google Places 真实数据', ypk: 'BusinessList.pk 黄页真实数据' }
function srcTag(s) { return s === 'google' ? 'primary' : s === 'osm' ? 'success' : s === 'ypk' ? 'danger' : 'warning' }
function srcLabel(s) { return s === 'google' ? 'Google' : s === 'osm' ? 'OSM' : s === 'ypk' ? '黄页' : '演示' }

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yl_admin_token') || ''}` }
}

async function api(path, options = {}) {
  const res = await fetch(`/api/leads${path}`, { headers: headers(), ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '请求失败')
  return data
}

async function load() {
  try {
    leads.value = await api('')
    campaigns.value = await api('/campaigns')
  } catch (e) { ElMessage.error(e.message) }
}
onMounted(load)

function fmtTime(t) {
  return t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : ''
}

// 当前页数据（分页）
const pagedLeads = computed(() => leads.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
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

async function fetchLeads() {
  if (!cfg.value.regions.length) return ElMessage.warning('请选择目标区域')
  fetching.value = true
  try {
    const res = await api('/scrape', { method: 'POST', body: JSON.stringify(cfg.value) })
    leads.value = res.leads
    page.value = 1
    ElMessage.success(`抓取完成，共 ${res.count} 条线索（${MODE_LABEL[res.mode] || res.mode}）`)
  } catch (e) { ElMessage.error(e.message) }
  finally { fetching.value = false }
}

async function clearLeads() {
  await ElMessageBox.confirm('确定清空全部线索？', '提示', { type: 'warning' })
  try { await api('', { method: 'DELETE' }); leads.value = []; ElMessage.success('已清空') }
  catch (e) { ElMessage.error(e.message) }
}

async function removeLead(row) {
  await ElMessageBox.confirm(`确定删除“${row.name}”？`, '提示', { type: 'warning' })
  try { await api(`/${row.id}`, { method: 'DELETE' }); await load(); ElMessage.success('已删除') }
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

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); ElMessage.success('已复制到剪贴板') } catch { ElMessage.info(t) }
}

async function markSent() {
  const count = previewList.value.length
  const channelName = sendChannel.value === 'whatsapp' ? 'WhatsApp' : 'Facebook Messenger'
  try {
    await api('/campaigns', {
      method: 'POST',
      body: JSON.stringify({ channel: channelName, count, status: '已发送', note: `手动/复制方式发送 ${count} 条（零风险模式）` })
    })
    await load()
    drawer.value = false
    ElMessage.success(`已记录 ${count} 条发送记录`)
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
.pv-item { border: 1px solid #eef2f7; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.pv-name { font-weight: 700; }
.pv-phone { color: var(--yl-text-light); font-size: 13px; margin: 2px 0 8px; }
.pv-text { background: #f6f9fc; padding: 8px 10px; border-radius: 8px; font-size: 13px; line-height: 1.7; }
.pv-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.cta { display: inline-block; margin: 0 4px 4px 0; padding: 3px 10px; border-radius: 6px; font-size: 12px; text-decoration: none; color: #fff; }
.cta-wa { background: #25d366; }
.cta-wa:hover { background: #1eb857; }
.cta-fb { background: #1877f2; }
.cta-fb:hover { background: #0f67d6; }
.email-link { color: var(--yl-primary); text-decoration: none; }
.email-link:hover { text-decoration: underline; }
</style>

