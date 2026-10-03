<template>
  <div>
    <div class="head">
      <div>
        <h2 class="page-title">{{ t('ap_title') }}</h2>
        <p class="page-sub">{{ t('ap_sub') }}</p>
      </div>
      <div class="head-actions">
        <el-button type="primary" @click="openForm()"><el-icon><Plus /></el-icon>{{ t('ap_add') }}</el-button>
        <el-button type="success" @click="openImport"><el-icon><Download /></el-icon>{{ t('ap_import') }}</el-button>
        <el-button type="primary" plain @click="fillSubs"><el-icon><Refresh /></el-icon>{{ t('ap_fill_subs') }}</el-button>
        <el-button type="danger" :disabled="!selectedIds.length" @click="batchRemove"><el-icon><Delete /></el-icon>{{ t('ap_batch_delete') }}{{ selectedIds.length ? t('ap_batch_delete_n', { n: selectedIds.length }) : '' }}</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <div class="filter-cats">
          <el-radio-group v-model="filterCat">
            <el-radio-button value="all">{{ t('ap_all') }}（{{ list.length }}）</el-radio-button>
            <el-radio-button v-for="c in CATS" :key="c.key" :value="c.key">{{ t('catL_' + c.key) }}</el-radio-button>
          </el-radio-group>
          <el-select v-if="filterCat !== 'all' && filterSubOptions.length" v-model="filterSub" :placeholder="t('ap_all_subcats')" clearable style="width: 160px">
            <el-option v-for="s in filterSubOptions" :key="s" :label="subLabel(s)" :value="s" />
          </el-select>
        </div>
        <el-input v-model="keyword" clearable :placeholder="t('ap_search_ph')" style="width: 320px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>
      <el-table :data="shownList" v-loading="loading" row-key="id" @selection-change="onSelectionChange" border>
        <el-table-column type="selection" width="46" />
        <el-table-column :label="t('ap_col_image')" width="90">
          <template #default="{ row }"><el-image :src="row.image" fit="cover" style="width:56px;height:56px;border-radius:8px" /></template>
        </el-table-column>
        <el-table-column prop="name" :label="t('ap_col_name')" min-width="140" />
        <el-table-column prop="nameEn" :label="t('ap_col_name_en')" min-width="160" show-overflow-tooltip />
        <el-table-column prop="categoryLabel" :label="t('ap_col_category')" width="110" />
        <el-table-column :label="t('ap_col_subcategory')" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.subCategory ? subLabel(row.subCategory) : '—' }}</template>
        </el-table-column>
        <el-table-column :label="t('ap_col_shop1')" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <a v-if="row.shopUrl" :href="row.shopUrl" target="_blank" rel="noopener" class="shop-link">{{ row.shopUrl }}</a>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('ap_col_shop2')" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <a v-if="row.shopUrl2" :href="row.shopUrl2" target="_blank" rel="noopener" class="shop-link">{{ row.shopUrl2 }}</a>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('ap_col_spec')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ markupSpec(row.spec) }}</template>
        </el-table-column>
        <el-table-column :label="t('ap_col_cost')" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ extractPrice(row.spec) || '—' }}</template>
        </el-table-column>
        <el-table-column :label="t('ap_col_desc')" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ plainText(markupSpec(row.desc)) }}</template>
        </el-table-column>
        <el-table-column :label="t('ap_col_actions')" width="160" fixed="right" :resizable="false">
          <template #default="{ row }">
            <el-button link type="primary" @click="openForm(row)">{{ t('a_edit') }}</el-button>
            <el-button link type="danger" @click="remove(row)">{{ t('a_delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="filteredList.length" class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="filteredList.length"
          :page-sizes="[10, 30, 50, 100, 200, 500]"
          layout="total, sizes, prev, pager, next"
        />
      </div>
    </el-card>

    <el-dialog v-model="impDialog" :title="t('ap_import_title')" width="920px" destroy-on-close>
      <el-form label-width="150px">
        <el-form-item :label="t('ap_import_url')" required>
          <el-input v-model="impUrl" :placeholder="t('ap_import_url_ph')" />
        </el-form-item>
        <el-form-item :label="t('ap_import_category')" required>
          <el-select v-model="impCategory" style="width: 220px">
            <el-option v-for="c in categories" :key="c.key" :label="c.key === 'all' ? t('ap_import_cat_all') : t('catL_' + c.key)" :value="c.key" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ap_import_limit')">
          <el-input-number v-model="impLimit" :min="10" :max="500" :step="10" />
          <span style="margin-left: 10px; color: #909399">{{ t('ap_import_tip') }}</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="impLoading" @click="previewImport"><el-icon><Search /></el-icon>{{ t('ap_preview') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-if="impItems.length" :data="impItems" max-height="360" style="margin-top: 4px" @selection-change="(rows) => (impSelection = rows)" border>
        <el-table-column type="selection" width="46" />
        <el-table-column :label="t('ap_col_image')" width="80">
          <template #default="{ row }"><el-image :src="row.image" fit="cover" style="width: 52px; height: 52px; border-radius: 6px" :preview-src-list="row.images" /></template>
        </el-table-column>
        <el-table-column :label="t('ap_import_col_logo')" width="104" align="center">
          <template #default="{ row }"><el-checkbox v-model="row.hasLogo" /></template>
        </el-table-column>
        <el-table-column :label="t('ap_import_col_name')" min-width="240">
          <template #default="{ row }"><el-input v-model="row.name" size="small" /></template>
        </el-table-column>
        <el-table-column :label="t('ap_import_col_category')" min-width="110">
          <template #default="{ row }">{{ row.categoryLabel || '—' }}</template>
        </el-table-column>
        <el-table-column :label="t('ap_import_col_sub')" min-width="160">
          <template #default="{ row }"><el-input v-model="row.subCategory" size="small" :placeholder="t('ap_import_auto')" /></template>
        </el-table-column>
        <el-table-column prop="price" :label="t('ap_import_col_price')" width="110" />
        <el-table-column prop="moq" label="MOQ" width="110" />
        <el-table-column :label="t('ap_import_col_certs')" width="130">
          <template #default="{ row }">{{ (row.certs || []).join(', ') }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-else-if="impDone" :description="t('ap_import_empty')" :image-size="80" />
      <template #footer>
        <span v-if="impItems.length" style="margin-right: 12px; color: #909399">{{ t('ap_import_selected', { n: impSelection.length }) }}</span>
        <el-button @click="impDialog = false">{{ t('a_cancel') }}</el-button>
        <el-button type="primary" :loading="impSaving" :disabled="!impSelection.length" @click="doImport">{{ t('ap_import_do') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialog" :title="form.id ? t('ap_edit_title') : t('ap_new_title')" width="760px" destroy-on-close @opened="editorReady = true">
      <el-form :model="form" label-position="top">
        <el-form-item :label="t('ap_form_name')" required><el-input v-model="form.name" :placeholder="t('ap_form_name_ph')" /></el-form-item>
        <el-form-item :label="t('ap_form_name_en')" required><el-input v-model="form.nameEn" :placeholder="t('ap_form_name_en_ph')" /></el-form-item>
        <el-form-item :label="t('ap_form_category')" required>
          <el-select v-model="form.category" style="width:100%" @change="onCatChange">
            <el-option v-for="c in CATS" :key="c.key" :label="t('catL_' + c.key)" :value="c.key" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ap_form_sub')">
          <el-select v-model="form.subCategory" filterable allow-create default-first-option clearable :placeholder="t('ap_form_sub_ph')" style="width:100%">
            <el-option v-for="s in subOptsFor(form.category)" :key="s" :label="subLabel(s)" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('ap_form_spec')" required><el-input v-model="form.spec" :placeholder="t('ap_form_spec_ph')" /></el-form-item>
        <el-form-item :label="t('ap_form_cost')"><span>{{ extractPrice(form.spec) || '—' }}</span></el-form-item>
        <el-form-item :label="t('ap_form_desc')" required>
          <div class="rich-editor" v-if="editorReady">
            <Toolbar class="rich-toolbar" :editor="editorRef" :defaultConfig="toolbarConfig" mode="default" />
            <Editor class="rich-body" v-model="descHtml" :defaultConfig="editorConfig" mode="default" @onCreated="handleCreated" />
          </div>
        </el-form-item>
        <el-form-item :label="t('ap_form_features')"><el-input v-model="featuresText" :placeholder="t('ap_form_features_ph')" /></el-form-item>
        <el-form-item :label="t('ap_form_image')"><el-input v-model="form.image" :placeholder="t('ap_form_image_ph')" /></el-form-item>
        <el-form-item :label="t('ap_form_shop1')"><el-input v-model="form.shopUrl" :placeholder="t('ap_form_shop1_ph')" /></el-form-item>
        <el-form-item :label="t('ap_form_shop2')"><el-input v-model="form.shopUrl2" :placeholder="t('ap_form_shop2_ph')" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{ t('a_cancel') }}</el-button>
        <el-button type="primary" @click="save">{{ t('a_save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Download, Search, Delete, Refresh } from '@element-plus/icons-vue'
import { categories } from '@/data/categories'
import { markupSpec, extractPrice, demarkupSpec } from '@/utils/price'
import { t, subLabel } from '@/i18n'

const CATS = categories.filter((c) => c.key !== 'all')
const DEFAULT_CAT = CATS[0] || { key: 'ppe', label: '防护用品' }
function subOptsFor(cat) {
  const seen = new Set()
  list.value.forEach((p) => {
    if (cat && p.category !== cat) return
    if (p.subCategory) seen.add(p.subCategory)
  })
  return [...seen]
}
const filterSubOptions = computed(() => subOptsFor(filterCat.value))
const list = ref([])
const loading = ref(false)
const selectedIds = ref([])
const filterCat = ref('all')
const filterSub = ref('')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
const filteredList = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return list.value.filter((p) => {
    if (filterCat.value !== 'all' && p.category !== filterCat.value) return false
    if (filterSub.value && p.subCategory !== filterSub.value) return false
    if (!q) return true
    return [p.name, p.nameEn, p.categoryLabel, p.spec].some((v) => String(v || '').toLowerCase().includes(q))
  })
})
const shownList = computed(() => filteredList.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const dialog = ref(false)
const editorReady = ref(false)
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
  placeholder: t('ap_editor_placeholder'),
  MENU_CONF: {
    uploadImage: {
      // 单张图片上限 20MB（3 张以内的产品描述图可正常内嵌）
      maxFileSize: 20 * 1024 * 1024,
      // 图片转 base64 内嵌保存，避免额外上传接口与静态目录（本地与部署均可用）
      customUpload(file, insertFn) {
        if (file.size > 20 * 1024 * 1024) {
          ElMessage.error(t('ap_img_too_large', { name: file.name }))
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
  if (!res.ok) throw new Error(data.message || t('a_request_failed'))
  return data
}

async function load() {
  loading.value = true
  try { list.value = await api('') } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
onMounted(load)
watch([filterCat, filterSub, keyword, pageSize], () => { page.value = 1 })
watch(filteredList, (items) => {
  const maxPage = Math.max(1, Math.ceil(items.length / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
})

function onCatChange(key) {
  form.value.categoryLabel = CATS.find((c) => c.key === key)?.label || ''
  form.value.subCategory = ''
}

function openForm(row) {
  if (row) {
    form.value = { ...row }
    featuresText.value = (row.features || []).join('、')
    descHtml.value = markupSpec(row.desc) || ''
  } else {
    form.value = { name: '', nameEn: '', category: DEFAULT_CAT.key, categoryLabel: DEFAULT_CAT.label, subCategory: '', shopUrl: '', shopUrl2: '', spec: '', desc: '', image: '' }
    featuresText.value = ''
    descHtml.value = ''
  }
  editorReady.value = false
  dialog.value = true
}

async function save() {
  const f = form.value
  if (!f.name || !f.nameEn || !f.spec || !f.desc) return ElMessage.warning(t('ap_fill_required'))
  const payload = {
    ...f,
    desc: demarkupSpec(descHtml.value),
    features: featuresText.value.split(/[、，,]/).map((s) => s.trim()).filter(Boolean)
  }
  try {
    if (f.id) { await api(`/${f.id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
    else { await api('', { method: 'POST', body: JSON.stringify(payload) }) }
    dialog.value = false
    ElMessage.success(t('a_saved'))
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
  if (!impUrl.value.trim()) return ElMessage.warning(t('ap_import_need_url'))
  impLoading.value = true
  try {
    const res = await fetch('/api/alibaba/preview', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ url: impUrl.value.trim(), limit: impLimit.value, category: impCategory.value })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || t('ap_fetch_failed'))
    impItems.value = (data.items || []).map((it) => ({ ...it }))
    impSelection.value = []
    impDone.value = true
    if (!impItems.value.length) ElMessage.warning(t('ap_no_products'))
    else ElMessage.success(t('ap_fetched_n', { n: data.count }))
  } catch (e) { ElMessage.error(e.message) }
  finally { impLoading.value = false }
}

// 用抓取信息组装富文本描述（含图片与核心卖点）
function buildImpDesc(it) {
  const imgs = (it.images || []).map((u) => `<p><img src="${u}" style="max-width:100%"/></p>`).join('')
  const meta = [`MOQ：${it.moq || '—'}`, `认证：${(it.certs || []).join(', ') || '—'}`]
  return `<p>${meta.join('　')}</p>${imgs}`
}

// 批量导入选中产品
async function doImport() {
  if (!impSelection.value.length) return ElMessage.warning(t('ap_import_select_first'))
  const cat = CATS.find((c) => c.key === impCategory.value)
  const items = impSelection.value.map((it) => ({
    name: it.name || it.nameEn,
    nameEn: it.nameEn || '',
    image: it.image || '',
    spec: it.price ? `FOB ${it.price}${it.moq ? ' · MOQ ' + it.moq : ''}` : '',
    desc: buildImpDesc(it),
    features: it.certs || [],
    subCategory: it.subCategory || '',
    category: it.category || '',
    categoryLabel: it.categoryLabel || '',
    hasLogo: !!it.hasLogo
  }))
  impSaving.value = true
  try {
    const res = await fetch('/api/alibaba/import', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ items, category: cat ? cat.key : 'all', categoryLabel: cat ? cat.label : '', shopUrl: impUrl.value.trim() })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || t('ap_import_failed'))
    ElMessage.success(data.skipped ? t('ap_import_done_skip', { count: data.count, skipped: data.skipped }) : t('ap_import_done', { count: data.count }))
    impDialog.value = false
    await load()
  } catch (e) { ElMessage.error(e.message) }
  finally { impSaving.value = false }
}

function onSelectionChange(rows) {
  selectedIds.value = rows.map((r) => r.id)
}

// 为已有产品（细类为空）自动识别补全细类
async function fillSubs() {
  try {
    const data = await api('/fill-subcategories', { method: 'POST' })
    ElMessage.success(data.updated ? t('ap_fill_subs_done', { updated: data.updated }) : t('ap_fill_subs_none'))
    await load()
  } catch (e) { ElMessage.error(e.message) }
}

async function batchRemove() {
  if (!selectedIds.value.length) return
  await ElMessageBox.confirm(t('ap_confirm_batch_delete', { n: selectedIds.value.length }), t('a_confirm_title'), { type: 'warning' })
  try {
    const res = await fetch('/api/products/batch-delete', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ids: selectedIds.value })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || t('ap_batch_delete_failed'))
    ElMessage.success(t('ap_batch_deleted', { n: data.count }))
    selectedIds.value = []
    await load()
  } catch (e) { ElMessage.error(e.message) }
}

async function remove(row) {
  await ElMessageBox.confirm(t('ap_confirm_delete', { name: row.name }), t('a_confirm_title'), { type: 'warning' })
  try { await api(`/${row.id}`, { method: 'DELETE' }); ElMessage.success(t('a_deleted')); await load() }
  catch (e) { ElMessage.error(e.message) }
}
</script>

<style scoped>
.filter-bar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
.filter-cats { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
.shop-link { color: var(--el-color-primary); text-decoration: none; }
.shop-link:hover { text-decoration: underline; }
:deep(.el-form-item__label) { white-space: nowrap; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
.head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
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
