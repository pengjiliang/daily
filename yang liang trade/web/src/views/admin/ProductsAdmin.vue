<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">产品管理</h2>
        <p class="page-sub">管理网站展示的医疗器械产品（增删改），前台与 AI 客服同步使用数据库数据</p>
      </div>
      <el-button type="primary" @click="openForm()"><el-icon><Plus /></el-icon>新增产品</el-button>
    </div>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" row-key="id">
        <el-table-column label="图片" width="90">
          <template #default="{ row }"><el-image :src="row.image" fit="cover" style="width:56px;height:56px;border-radius:8px" /></template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="nameEn" label="英文名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="categoryLabel" label="分类" width="110" />
        <el-table-column prop="spec" label="规格" min-width="180" show-overflow-tooltip />
        <el-table-column label="描述" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ plainText(row.desc) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openForm(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="form.id ? '编辑产品' : '新增产品'" width="760px" destroy-on-close @opened="editorReady = true">
      <el-form :model="form" label-position="top">
        <el-form-item label="产品名称" required><el-input v-model="form.name" placeholder="如：医用外科口罩" /></el-form-item>
        <el-form-item label="英文名称" required><el-input v-model="form.nameEn" placeholder="如：Surgical Face Mask" /></el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="form.category" style="width:100%" @change="onCatChange">
            <el-option v-for="c in CATS" :key="c.key" :label="c.label" :value="c.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="规格" required><el-input v-model="form.spec" placeholder="如：三层防护 · 细菌过滤率 ≥ 95%" /></el-form-item>
        <el-form-item label="产品描述（支持图片、文字、表格）" required>
          <div class="rich-editor" v-if="editorReady">
            <Toolbar class="rich-toolbar" :editor="editorRef" :defaultConfig="toolbarConfig" mode="default" />
            <Editor class="rich-body" v-model="descHtml" :defaultConfig="editorConfig" mode="default" @onCreated="handleCreated" />
          </div>
        </el-form-item>
        <el-form-item label="产品特点（用中文顿号或逗号分隔）"><el-input v-model="featuresText" placeholder="如：三层过滤结构、舒适耳挂设计" /></el-form-item>
        <el-form-item label="图片路径"><el-input v-model="form.image" placeholder="/images/product-xxx.svg，留空使用占位图" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const CATS = [
  { key: 'ppe', label: '防护用品' },
  { key: 'monitoring', label: '监测设备' },
  { key: 'consumables', label: '耗材器械' },
  { key: 'rehab', label: '护理康复' },
  { key: 'disinfection', label: '消毒净化' }
]
const list = ref([])
const dialog = ref(false)
const editorReady = ref(false)
const loading = ref(false)
const form = ref({})
const featuresText = ref('')
const descHtml = ref('')
const editorRef = shallowRef()
const toolbarConfig = {}
const editorConfig = {
  placeholder: '请输入产品描述：可插入文字、图片、表格…',
  MENU_CONF: {
    uploadImage: {
      // 单张图片上限 20MB（3 张以内的产品描述图可正常内嵌）
      maxFileSize: 20 * 1024 * 1024,
      // 图片转 base64 内嵌保存，避免额外上传接口与静态目录（本地与部署均可用）
      customUpload(file, insertFn) {
        if (file.size > 20 * 1024 * 1024) {
          ElMessage.error(`图片不能超过 20MB：${file.name}`)
          return
        }
        const reader = new FileReader()
        reader.onload = () => insertFn(reader.result, file.name, '')
        reader.readAsDataURL(file)
      }
    }
  }
}
function handleCreated(editor) { editorRef.value = editor }
onBeforeUnmount(() => { editorRef.value?.destroy() })

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yl_admin_token') || ''}` }
}

async function api(path, options = {}) {
  const res = await fetch(`/api/products${path}`, { headers: headers(), ...options })
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

function onCatChange(key) {
  form.value.categoryLabel = CATS.find((c) => c.key === key)?.label || ''
}

function openForm(row) {
  if (row) {
    form.value = { ...row }
    featuresText.value = (row.features || []).join('、')
    descHtml.value = row.desc || ''
  } else {
    form.value = { name: '', nameEn: '', category: 'ppe', categoryLabel: '防护用品', spec: '', desc: '', image: '' }
    featuresText.value = ''
    descHtml.value = ''
  }
  editorReady.value = false
  dialog.value = true
}

async function save() {
  const f = form.value
  if (!f.name || !f.nameEn || !f.spec || !f.desc) return ElMessage.warning('请填写名称、英文名、规格与描述')
  const payload = {
    ...f,
    desc: descHtml.value,
    features: featuresText.value.split(/[、，,]/).map((s) => s.trim()).filter(Boolean)
  }
  try {
    if (f.id) { await api(`/${f.id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
    else { await api('', { method: 'POST', body: JSON.stringify(payload) }) }
    dialog.value = false
    ElMessage.success('已保存')
    await load()
  } catch (e) { ElMessage.error(e.message) }
}

function plainText(h) {
  return (h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/s+/g, ' ').trim()
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除产品“${row.name}”？`, '提示', { type: 'warning' })
  try { await api(`/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); await load() }
  catch (e) { ElMessage.error(e.message) }
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-title { margin: 0 0 6px; font-size: 24px; }
.page-sub { margin: 0; color: var(--yl-text-light); }
.rich-editor { width: 100%; }
.rich-toolbar { border: 1px solid #dcdfe6; border-bottom: none; border-radius: 6px 6px 0 0; }
.rich-body { border: 1px solid #dcdfe6; border-radius: 0 0 6px 6px; }
.rich-body :deep(.w-e-text-container) { min-height: 300px; z-index: auto; }
</style>
<style>
/* wangeditor 弹层（下拉/面板/提示）层级需高于 el-dialog */
.w-e-menu, .w-e-droplist, .w-e-menu-tooltip, .w-e-panel, .w-e-select-list { z-index: 3000 !important; }
</style>
