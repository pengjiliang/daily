<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">AI 模型配置</h2>
        <p class="page-sub">配置客服使用的 OpenAI 兼容模型（豆包 / 火山 / DeepSeek 等），可多套并存、随时切换</p>
      </div>
      <el-button type="primary" @click="openForm()"><el-icon><Plus /></el-icon>新增配置</el-button>
    </div>

    <el-alert type="info" :closable="false" style="margin-bottom: 16px" show-icon>
      当前生效模型：<b>{{ activeModel }}</b>（未新增时默认使用根目录 <code>.env</code> 中的配置）
    </el-alert>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="type" label="类型" width="130" />
        <el-table-column prop="model" label="模型" min-width="160" />
        <el-table-column prop="baseURL" label="Base URL" min-width="220" show-overflow-tooltip />
        <el-table-column label="默认" width="90">
          <template #default="{ row }"><el-tag v-if="row.isDefault" type="success" size="small">使用中</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openForm(row)">编辑</el-button>
            <el-button v-if="!row.isDefault" link type="warning" @click="setDefault(row)">设为默认</el-button>
            <el-button v-if="!row.isDefault" link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="form.id ? '编辑配置' : '新增配置'" width="520px">
      <el-form :model="form" label-position="top">
        <el-form-item label="配置名称" required><el-input v-model="form.name" placeholder="如：火山引擎豆包" /></el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="Base URL" required><el-input v-model="form.baseURL" placeholder="https://ark.cn-beijing.volces.com/api/v3" /></el-form-item>
        <el-form-item label="API Key" required><el-input v-model="form.apiKey" type="password" show-password placeholder="请输入 API Key" /></el-form-item>
        <el-form-item label="模型名称" required><el-input v-model="form.model" placeholder="如：doubao-seed-1-6b" /></el-form-item>
        <el-form-item label="系统提示词（可选）"><el-input v-model="form.systemPrompt" type="textarea" :rows="3" placeholder="设定客服角色与产品应答话术" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const TYPES = ['火山引擎（豆包）', 'DeepSeek', 'OpenAI', '通义千问', '其他']
const list = ref([])
const dialog = ref(false)
const loading = ref(false)
const form = ref({})

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yl_admin_token') || ''}` }
}

async function api(path, options = {}) {
  const res = await fetch(`/api/ai-config${path}`, { headers: headers(), ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '请求失败')
  return data
}

async function load() {
  loading.value = true
  try { list.value = await api('') } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
onMounted(load)

const activeModel = computed(() => {
  const d = list.value.find((c) => c.isDefault)
  return d ? `${d.name}（${d.model}）` : '未设置'
})

function openForm(row) {
  form.value = row ? { ...row } : { name: '', type: TYPES[0], baseURL: '', apiKey: '', model: '', systemPrompt: '', isDefault: false }
  dialog.value = true
}

async function save() {
  const f = form.value
  if (!f.name || !f.baseURL || !f.apiKey || !f.model) return ElMessage.warning('请填写完整配置')
  try {
    if (f.id) { await api(`/${f.id}`, { method: 'PUT', body: JSON.stringify(f) }) }
    else { await api('', { method: 'POST', body: JSON.stringify(f) }) }
    dialog.value = false
    ElMessage.success('已保存')
    await load()
  } catch (e) { ElMessage.error(e.message) }
}

async function setDefault(row) {
  try { await api(`/${row.id}/default`, { method: 'POST' }); ElMessage.success(`已将 ${row.name} 设为默认模型`); await load() }
  catch (e) { ElMessage.error(e.message) }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除配置“${row.name}”？`, '提示', { type: 'warning' })
  try { await api(`/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); await load() }
  catch (e) { ElMessage.error(e.message) }
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-title { margin: 0 0 6px; font-size: 24px; }
.page-sub { margin: 0; color: var(--yl-text-light); font-size: 14px; }
</style>
