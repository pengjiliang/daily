<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">产品管理</h2>
        <p class="page-sub">管理网站展示的医疗器械产品（增删改），前台与 AI 客服同步使用数据库数据</p>
      </div>
      <el-button type="primary" @click="openForm()"><el-icon><Plus /></el-icon>新增产品</el-button>
      <el-button type="success" @click="openImport"><el-icon><Download /></el-icon>从 Alibaba 导入</el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-radio-group v-model="filterCat">
          <el-radio-button value="all">全部（{{ list.length }}）</el-radio-button>
          <el-radio-button v-for="c in CATS" :key="c.key" :value="c.key">{{ c.label }}</el-radio-button>
        </el-radio-group>
      </div>
      <el-table :data="shownList" v-loading="loading" row-key="id">
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

    <el-dialog v-model="impDialog" title="从 Alibaba 店铺导入产品" width="920px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="店铺产品页 URL" required>
          <el-input v-model="impUrl" placeholder="https://joytechhealth.en.alibaba.com/productlist.html 或收藏集页，可整店/分类导入" />
        </el-form-item>
        <el-form-item label="导入分类" required>
          <el-select v-model="impCategory" style="width: 220px">
            <el-option v-for="c in CATS" :key="c.key" :label="c.label" :value="c.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="抓取条数上限">
          <el-input-number v-model="impLimit" :min="10" :max="500" :step="10" />
          <span style="margin-left: 10px; color: #909399">预览后勾选要导入的条目</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="impLoading" @click="previewImport"><el-icon><Search /></el-icon>预览抓取</el-button>
        </el-form-item>
      </el-form>

      <el-table v-if="impItems.length" :data="impItems" max-height="360" style="margin-top: 4px" @selection-change="(rows) => (impSelection = rows)">
        <el-table-column type="selection" width="46" />
        <el-table-column label="图片" width="80">
          <template #default="{ row }"><el-image :src="row.image" fit="cover" style="width: 52px; height: 52px; border-radius: 6px" :preview-src-list="row.images" /></template>
        </el-table-column>
        <el-table-column label="产品名称（可改）" min-width="240">
          <template #default="{ row }"><el-input v-model="row.name" size="small" /></template>
        </el-table-column>
        <el-table-column prop="price" label="FOB 价" width="110" />
        <el-table-column prop="moq" label="MOQ" width="110" />
        <el-table-column label="认证" width="130">
          <template #default="{ row }">{{ (row.certs || []).join(', ') }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-else-if="impDone" description="未抓取到产品，请检查 URL 是否为 Alibaba 店铺产品页" :image-size="80" />
      <template #footer>
        <span v-if="impItems.length" style="margin-right: 12px; color: #909399">已选 {{ impSelection.length }} 条</span>
        <el-button @click="impDialog = false">取消</el-button>
        <el-button type="primary" :loading="impSaving" :disabled="!impSelection.length" @click="doImport">导入所选产品</el-button>
      </template>
    </el-dialog>

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
import { ref, computed, shallowRef, onMounted, onBeforeUnmount } from 'vue'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Download, Search } from '@element-plus/icons-vue'

const CATS = [
  { key: 'ppe', label: '防护用品' },
  { key: 'monitoring', label: '监测设备' },
  { key: 'consumables', label: '耗材器械' },
  { key: 'rehab', label: '护理康复' },
  { key: 'disinfection', label: '消毒净化' }
]
const list = ref([])
const shownList = computed(() => filterCat.value === 'all' ? list.value : list.value.filter((p) => p.category === filterCat.value))
const dialog = ref(false)
const editorReady = ref(false)
const loading = ref(false)
const filterCat = ref('all')
const form = ref({})
const featuresText = ref('')
const descHtml = ref('')
const editorRef = shallowRef()
const impDialog = ref(false)
const impUrl = ref('')
const impCategory = ref('monitoring')
const impLimit = ref(100)
const impLoading = ref(false)
const impSaving = ref(false)
const impItems = ref([])
const impSelection = ref([])
const impDone = ref(false)
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

async function openImport() {
  impUrl.value = ''
  impCategory.value = 'monitoring'
  impLimit.value = 100
  impItems.value = []
  impSelection.value = []
  impDone.value = false
  impDialog.value = true
}

// 预览抓取 Alibaba 店铺产品（不入库）
async function previewImport() {
  if (!impUrl.value.trim()) return ElMessage.warning('请输入店铺产品页 URL')
  impLoading.value = true
  try {
    const res = await fetch('/api/alibaba/preview', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ url: impUrl.value.trim(), limit: impLimit.value })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || '抓取失败')
    impItems.value = (data.items || []).map((it) => ({ ...it }))
    impSelection.value = []
    impDone.value = true
    if (!impItems.value.length) ElMessage.warning('未抓取到产品')
    else ElMessage.success(`抓到 ${data.count} 条，请勾选要导入的`)
  } catch (e) { ElMessage.error(e.message) }
  finally { impLoading.value = false }
}

// 用抓取信息组装富文本描述（含图片与核心卖点）
function buildImpDesc(it) {
  const imgs = (it.images || []).map((u) => `<p><img src="${u}" style="max-width:100%"/></p>`).join('')
  const meta = [`FOB 价格：${it.price || '—'}`, `MOQ：${it.moq || '—'}`, `认证：${(it.certs || []).join(', ') || '—'}`]
  return `<p>${meta.join('　')}</p>${imgs}`
}

// 批量导入选中产品
async function doImport() {
  if (!impSelection.value.length) return ElMessage.warning('请先勾选要导入的产品')
  const cat = CATS.find((c) => c.key === impCategory.value)
  const items = impSelection.value.map((it) => ({
    name: it.name || it.nameEn,
    nameEn: it.nameEn || '',
    image: it.image || '',
    spec: it.price ? `FOB ${it.price}${it.moq ? ' · MOQ ' + it.moq : ''}` : '',
    desc: buildImpDesc(it),
    features: it.certs || []
  }))
  impSaving.value = true
  try {
    const res = await fetch('/api/alibaba/import', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ items, category: cat.key, categoryLabel: cat.label })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || '导入失败')
    ElMessage.success(`已导入 ${data.count} 个产品`)
    impDialog.value = false
    await load()
  } catch (e) { ElMessage.error(e.message) }
  finally { impSaving.value = false }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除产品“${row.name}”？`, '提示', { type: 'warning' })
  try { await api(`/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); await load() }
  catch (e) { ElMessage.error(e.message) }
}
</script>

<style scoped>
.filter-bar { margin-bottom: 16px; }
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
