<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">{{ t('aai_title') }}</h2>
        <p class="page-sub">{{ t('aai_sub') }}</p>
      </div>
      <el-button type="primary" @click="openForm()"><el-icon><Plus /></el-icon>{{ t('aai_add') }}</el-button>
    </div>

    <el-alert type="info" :closable="false" style="margin-bottom: 16px" show-icon>
      {{ t('aai_active_prefix') }}<b>{{ activeModel }}</b>{{ t('aai_active_tip') }}
    </el-alert>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border>
        <el-table-column prop="name" :label="t('aai_col_name')" min-width="150" />
        <el-table-column prop="type" :label="t('aai_col_type')" width="130" />
        <el-table-column prop="model" :label="t('aai_col_model')" min-width="160" />
        <el-table-column prop="baseURL" label="Base URL" min-width="220" show-overflow-tooltip />
        <el-table-column :label="t('aai_col_default')" width="90">
          <template #default="{ row }"><el-tag v-if="row.isDefault" type="success" size="small">{{ t('aai_in_use') }}</el-tag></template>
        </el-table-column>
        <el-table-column :label="t('aai_col_actions')" width="230" fixed="right" :resizable="false">
          <template #default="{ row }">
            <el-button link type="primary" @click="openForm(row)">{{ t('aai_edit') }}</el-button>
            <el-button v-if="!row.isDefault" link type="warning" @click="setDefault(row)">{{ t('aai_set_default') }}</el-button>
            <el-button v-if="!row.isDefault" link type="danger" @click="remove(row)">{{ t('a_delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="form.id ? t('aai_edit_title') : t('aai_new_title')" width="520px">
      <el-form :model="form" label-position="top">
        <el-form-item :label="t('aai_name')" required><el-input v-model="form.name" :placeholder="t('aai_name_ph')" /></el-form-item>
        <el-form-item :label="t('aai_type')" required>
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="opt in TYPES" :key="opt.value" :label="t(opt.key)" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="Base URL" required><el-input v-model="form.baseURL" placeholder="https://ark.cn-beijing.volces.com/api/v3" /></el-form-item>
        <el-form-item label="API Key" required><el-input v-model="form.apiKey" type="password" show-password :placeholder="t('aai_api_key_ph')" /></el-form-item>
        <el-form-item :label="t('aai_model_name')" required><el-input v-model="form.model" :placeholder="t('aai_model_ph')" /></el-form-item>
        <el-form-item :label="t('aai_system_prompt')"><el-input v-model="form.systemPrompt" type="textarea" :rows="3" :placeholder="t('aai_system_ph')" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{ t('a_cancel') }}</el-button>
        <el-button type="primary" @click="save">{{ t('a_save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { t } from '@/i18n'

const TYPES = [
  { value: '火山引擎（豆包）', key: 'aai_type_doubao' },
  { value: 'DeepSeek', key: 'aai_type_deepseek' },
  { value: 'OpenAI', key: 'aai_type_openai' },
  { value: '通义千问', key: 'aai_type_qwen' },
  { value: '其他', key: 'aai_type_other' }
]
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
  if (!res.ok) throw new Error(data.message || t('a_request_failed'))
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
  return d ? `${d.name}（${d.model}）` : t('aai_not_set')
})

function openForm(row) {
  form.value = row ? { ...row } : { name: '', type: TYPES[0], baseURL: '', apiKey: '', model: '', systemPrompt: '', isDefault: false }
  dialog.value = true
}

async function save() {
  const f = form.value
  if (!f.name || !f.baseURL || !f.apiKey || !f.model) return ElMessage.warning(t('aai_fill_all'))
  try {
    if (f.id) { await api(`/${f.id}`, { method: 'PUT', body: JSON.stringify(f) }) }
    else { await api('', { method: 'POST', body: JSON.stringify(f) }) }
    dialog.value = false
    ElMessage.success(t('a_saved'))
    await load()
  } catch (e) { ElMessage.error(e.message) }
}

async function setDefault(row) {
  try { await api(`/${row.id}/default`, { method: 'POST' }); ElMessage.success(t('aai_default_set', { name: row.name })); await load() }
  catch (e) { ElMessage.error(e.message) }
}

async function remove(row) {
  await ElMessageBox.confirm(t('aai_confirm_delete', { name: row.name }), t('a_confirm_title'), { type: 'warning' })
  try { await api(`/${row.id}`, { method: 'DELETE' }); ElMessage.success(t('a_deleted')); await load() }
  catch (e) { ElMessage.error(e.message) }
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-title { margin: 0 0 6px; font-size: 24px; }
.page-sub { margin: 0; color: var(--yl-text-light); font-size: 14px; }
</style>
