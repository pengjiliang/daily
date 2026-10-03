<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">{{ t('am_title') }}</h2>
        <p class="page-sub">{{ t('am_sub') }}</p>
      </div>
      <el-button :loading="loading" @click="load">{{ t('a_refresh') }}</el-button>
    </div>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" row-key="id" border>
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="name" :label="t('am_col_name')" min-width="160">
          <template #default="{ row }">{{ row.name || t('am_na') }}</template>
        </el-table-column>
        <el-table-column prop="phone" :label="t('am_col_phone')" min-width="160">
          <template #default="{ row }">{{ row.phone || t('am_na') }}</template>
        </el-table-column>
        <el-table-column prop="message" :label="t('am_col_message')" min-width="320" show-overflow-tooltip />
        <el-table-column :label="t('am_col_time')" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('am_col_actions')" width="130" fixed="right" :resizable="false">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{ t('a_view') }}</el-button>
            <el-button link type="danger" @click="remove(row)">{{ t('a_delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !list.length" :description="t('am_empty')" />
    </el-card>

    <el-dialog v-model="detailVisible" :title="t('am_detail_title')" width="620px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item :label="t('am_col_name')">{{ detail.name || t('am_na') }}</el-descriptions-item>
        <el-descriptions-item :label="t('am_col_phone')">{{ detail.phone || t('am_na') }}</el-descriptions-item>
        <el-descriptions-item :label="t('am_col_time')">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
        <el-descriptions-item :label="t('am_col_message')"><div class="message-text">{{ detail.message }}</div></el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t, lang } from '@/i18n'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const loading = ref(false)
const detail = ref(null)
const detailVisible = ref(false)

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yl_admin_token') || ''}` }
}

async function api(path = '', options = {}) {
  const res = await fetch(`/api/contact/messages${path}`, { headers: headers(), ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || t('a_request_failed'))
  return data
}

async function load() {
  loading.value = true
  try {
    list.value = await api()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString(lang.value === 'en' ? 'en-US' : 'zh-CN', { hour12: false }) : ''
}

function openDetail(row) {
  detail.value = row
  detailVisible.value = true
}

async function remove(row) {
  await ElMessageBox.confirm(t('am_confirm_delete'), t('a_confirm_title'), { type: 'warning' })
  try {
    await api(`/${row.id}`, { method: 'DELETE' })
    ElMessage.success(t('a_deleted'))
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-title { margin: 0 0 6px; font-size: 24px; }
.page-sub { margin: 0; color: var(--yl-text-light); }
.message-text { white-space: pre-wrap; word-break: break-word; line-height: 1.7; }
</style>