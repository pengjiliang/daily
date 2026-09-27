<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">邮箱营销</h2>
        <p class="page-sub">在后台直接登录 Foxmail / QQ 邮箱，查看收件箱并给客户发送开发信（无需跳转邮箱网页）</p>
      </div>
    </div>

    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
      首次使用请先在 Foxmail / QQ 邮箱「设置 → 账户」中开启 <b>SMTP 与 IMAP 服务</b>，获取<b>授权码</b>（不是登录密码），
      在下方填入即可在本页面直接收发邮件。
    </el-alert>

    <el-card shadow="never" class="login-card">
      <template v-if="!config.hasAccount">
        <div class="login-title">邮箱登录</div>
        <el-form :model="form" label-position="top" class="login-form">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="邮箱账号" required>
                <el-input v-model="form.user" placeholder="yourname@foxmail.com" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="授权码" required>
                <el-input v-model="form.pass" type="password" show-password placeholder="邮箱设置中获取的授权码" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="SMTP 服务器">
                <el-input v-model="form.smtpHost" placeholder="smtp.qq.com" />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="SMTP 端口">
                <el-input-number v-model="form.smtpPort" :min="1" :max="65535" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="IMAP 服务器">
                <el-input v-model="form.imapHost" placeholder="imap.qq.com" />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="IMAP 端口">
                <el-input-number v-model="form.imapPort" :min="1" :max="65535" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-button type="primary" :loading="logging" @click="doLogin">登录并测试连接</el-button>
        </el-form>
      </template>
      <template v-else>
        <div class="connected">
          <div class="connected-info">
            <el-icon :size="22" color="#67c23a"><CircleCheckFilled /></el-icon>
            <div>
              <div class="connected-mail">{{ config.user }}</div>
              <div class="connected-sub">SMTP {{ config.smtpHost }}:{{ config.smtpPort }} · IMAP {{ config.imapHost }}:{{ config.imapPort }}</div>
            </div>
          </div>
          <div>
            <el-button @click="loadInbox" :loading="inboxLoading"><el-icon><Refresh /></el-icon>刷新收件箱</el-button>
            <el-button type="danger" plain @click="doLogout">断开登录</el-button>
          </div>
        </div>
      </template>
    </el-card>

    <template v-if="config.hasAccount">
      <el-row :gutter="16">
        <el-col :span="10">
          <el-card shadow="never">
            <template #header><b>收件箱（{{ inbox.total }} 封，显示最近 {{ inbox.items.length }} 封）</b></template>
            <div v-loading="inboxLoading" class="inbox">
              <el-empty v-if="!inboxLoading && !inbox.items.length" description="收件箱为空" :image-size="70" />
              <div v-for="m in inbox.items" :key="m.uid" class="mail-item" @click="openMail(m)">
                <div class="mail-item-head">
                  <span class="mail-subject">{{ m.subject || '（无主题）' }}</span>
                  <span class="mail-date">{{ fmtTime(m.date) }}</span>
                </div>
                <div class="mail-from">{{ m.from }}</div>
                <div class="mail-preview">{{ m.preview }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="14">
          <el-card shadow="never">
            <template #header><b>写开发信</b></template>
            <el-form label-position="top">
              <el-form-item label="收件人（可手输多个，也可从线索库选择）" required>
                <el-select v-model="toList" multiple filterable allow-create default-first-option placeholder="输入邮箱后回车" style="width: 100%">
                  <el-option v-for="e in leadEmails" :key="e" :label="e" :value="e" />
                </el-select>
                <div class="pick-row">
                  <el-button size="small" @click="openPick"><el-icon><User /></el-icon>从客户线索选择</el-button>
                  <span class="pick-tip">已选 {{ toList.length }} 个收件人</span>
                </div>
              </el-form-item>
              <el-form-item label="主题" required>
                <el-input v-model="mailForm.subject" placeholder="如：Medical Device Supply Inquiry – YangLiang Trade" />
              </el-form-item>
              <el-form-item label="正文" required>
                <el-input v-model="mailForm.text" type="textarea" :rows="12" placeholder="输入开发信内容，支持换行，发送时自动转为 HTML 排版" />
              </el-form-item>
              <el-button type="primary" :loading="sending" @click="doSend"><el-icon><Promotion /></el-icon>发送邮件</el-button>
            </el-form>
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="never" class="block">
        <template #header><b>发送记录</b></template>
        <el-table :data="campaigns" style="width: 100%" border>
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column prop="count" label="收件人数" width="100" />
          <el-table-column prop="note" label="主题" min-width="240" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }"><el-tag type="success" size="small">{{ row.status }}</el-tag></template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!campaigns.length" description="暂无发送记录" />
      </el-card>
    </template>

    <el-dialog v-model="mailVisible" :title="current.subject || '邮件详情'" width="640px">
      <div class="mail-meta">发件人：{{ current.from }}　时间：{{ fmtTime(current.date) }}</div>
      <div class="mail-body">{{ current.preview }}</div>
    </el-dialog>

    <el-dialog v-model="pickVisible" title="选择客户邮箱（来自线索库）" width="720px">
      <el-table :data="pickList" @selection-change="onPickChange" max-height="420" border>
        <el-table-column type="selection" width="46" />
        <el-table-column prop="name" label="店铺名称" min-width="150" />
        <el-table-column prop="email" label="邮箱" min-width="220" show-overflow-tooltip />
        <el-table-column prop="city" label="城市" width="110" />
      </el-table>
      <template #footer>
        <el-button @click="pickVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPick">添加所选（{{ picked.length }}）</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheckFilled, Refresh, User, Promotion } from '@element-plus/icons-vue'

const config = ref({ hasAccount: false, user: '', smtpHost: '', smtpPort: 465, imapHost: '', imapPort: 993 })
const form = ref({ user: '', pass: '', smtpHost: 'smtp.qq.com', smtpPort: 465, imapHost: 'imap.qq.com', imapPort: 993 })
const logging = ref(false)
const inbox = ref({ total: 0, items: [] })
const inboxLoading = ref(false)
const toList = ref([])
const leadEmails = ref([])
const mailForm = ref({ subject: '', text: '' })
const sending = ref(false)
const campaigns = ref([])
const mailVisible = ref(false)
const current = ref({ subject: '', from: '', date: null, preview: '' })
const pickVisible = ref(false)
const pickList = ref([])
const picked = ref([])

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yl_admin_token') || ''}` }
}

async function api(path, options = {}) {
  const res = await fetch(`/api/mail${path}`, { headers: headers(), ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '请求失败')
  return data
}

function fmtTime(t) {
  if (!t) return ''
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function loadConfig() {
  try {
    config.value = await api('/config')
    if (config.value.hasAccount) {
      loadInbox()
      loadCampaigns()
    }
  } catch (e) { ElMessage.error(e.message) }
}

async function doLogin() {
  if (!form.value.user || !form.value.pass) return ElMessage.warning('请填写邮箱账号和授权码')
  logging.value = true
  try {
    await api('/login', { method: 'POST', body: JSON.stringify(form.value) })
    ElMessage.success('登录成功，已连接邮箱')
    await loadConfig()
  } catch (e) { ElMessage.error(e.message) }
  finally { logging.value = false }
}

async function doLogout() {
  await ElMessageBox.confirm('确定断开当前邮箱登录？断开后需重新输入授权码。', '提示', { type: 'warning' })
  try {
    await api('/config', { method: 'DELETE' })
    config.value = { hasAccount: false }
    inbox.value = { total: 0, items: [] }
    campaigns.value = []
    ElMessage.success('已断开登录')
  } catch (e) { ElMessage.error(e.message) }
}

async function loadInbox() {
  inboxLoading.value = true
  try { inbox.value = await api('/inbox?limit=20') } catch (e) { ElMessage.error(e.message) }
  finally { inboxLoading.value = false }
}

function openMail(m) {
  current.value = m
  mailVisible.value = true
}

async function loadCampaigns() {
  try {
    const res = await fetch('/api/leads/campaigns', { headers: headers() })
    const data = await res.json().catch(() => [])
    campaigns.value = (Array.isArray(data) ? data : []).filter((c) => c.channel === 'email')
  } catch (e) { ElMessage.error(e.message) }
}

async function openPick() {
  picked.value = []
  try {
    const res = await fetch('/api/leads?page=1&pageSize=500', { headers: headers() })
    const data = await res.json().catch(() => ({}))
    const items = data.items || []
    pickList.value = items.filter((l) => l.email)
    leadEmails.value = [...new Set(pickList.value.map((l) => l.email))]
    pickVisible.value = true
  } catch (e) { ElMessage.error(e.message) }
}

function onPickChange(rows) {
  picked.value = rows
}

function confirmPick() {
  const add = picked.value.map((r) => r.email).filter(Boolean)
  toList.value = [...new Set([...toList.value, ...add])]
  pickVisible.value = false
  ElMessage.success(`已添加 ${add.length} 个收件人`)
}

async function doSend() {
  if (!toList.value.length) return ElMessage.warning('请至少填写一个收件人')
  if (!mailForm.value.subject) return ElMessage.warning('请填写邮件主题')
  if (!mailForm.value.text) return ElMessage.warning('请填写邮件正文')
  sending.value = true
  try {
    await api('/send', { method: 'POST', body: JSON.stringify({ to: toList.value, subject: mailForm.value.subject, text: mailForm.value.text }) })
    ElMessage.success(`已发送给 ${toList.value.length} 个收件人`)
    mailForm.value = { subject: '', text: '' }
    toList.value = []
    loadCampaigns()
  } catch (e) { ElMessage.error(e.message) }
  finally { sending.value = false }
}

onMounted(loadConfig)
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-title { margin: 0 0 6px; font-size: 24px; }
.page-sub { margin: 0; color: var(--yl-text-light); font-size: 14px; }
.login-card { margin-bottom: 16px; }
.login-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
.login-form { max-width: 760px; }
.connected { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.connected-info { display: flex; align-items: center; gap: 10px; }
.connected-mail { font-size: 16px; font-weight: 700; }
.connected-sub { color: var(--yl-text-light); font-size: 13px; }
.block { margin-top: 16px; }
.inbox { max-height: 560px; overflow: auto; }
.mail-item { border: 1px solid #e4e7ed; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; transition: all .2s; }
.mail-item:hover { border-color: #409eff; background: #f5f9ff; }
.mail-item-head { display: flex; justify-content: space-between; gap: 8px; }
.mail-subject { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mail-date { color: var(--yl-text-light); font-size: 12px; white-space: nowrap; }
.mail-from { color: #409eff; font-size: 13px; margin: 2px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mail-preview { color: var(--yl-text-light); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick-row { margin-top: 6px; display: flex; align-items: center; gap: 10px; }
.pick-tip { color: var(--yl-text-light); font-size: 13px; }
.mail-meta { color: var(--yl-text-light); font-size: 13px; margin-bottom: 12px; }
.mail-body { white-space: pre-wrap; line-height: 1.7; }
</style>
