<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">用户留言</h2>
        <p class="page-sub">查看联系页提交的客户留言与联系方式</p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" row-key="id" border>
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="name" label="姓名 / 公司" min-width="160">
          <template #default="{ row }">{{ row.name || '未填写' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="联系方式" min-width="160">
          <template #default="{ row }">{{ row.phone || '未填写' }}</template>
        </el-table-column>
        <el-table-column prop="message" label="留言内容" min-width="320" show-overflow-tooltip />
        <el-table-column label="提交时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right" :resizable="false">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !list.length" description="暂无用户留言" />
    </el-card>

    <el-dialog v-model="detailVisible" title="留言详情" width="620px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="姓名 / 公司">{{ detail.name || '未填写' }}</el-descriptions-item>
        <el-descriptions-item label="联系方式">{{ detail.phone || '未填写' }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="留言内容"><div class="message-text">{{ detail.message }}</div></el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
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
  if (!res.ok) throw new Error(data.message || '请求失败')
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
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : ''
}

function openDetail(row) {
  detail.value = row
  detailVisible.value = true
}

async function remove(row) {
  await ElMessageBox.confirm('确定删除这条留言？', '提示', { type: 'warning' })
  try {
    await api(`/${row.id}`, { method: 'DELETE' })
    ElMessage.success('已删除')
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