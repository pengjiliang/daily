<template>
  <div class="page-section">
    <div class="container">
      <h2 class="section-title">{{ t('products_title') }}</h2>
      <p class="section-sub">{{ t('products_sub') }}</p>

      <div class="toolbar">
        <div class="prod-tabs">
          <button
            v-for="tab in tabItems"
            :key="tab.key"
            type="button"
            class="tab"
            :class="{ active: activeCat === tab.key }"
            @click="activeCat = tab.key"
          >
            <el-icon :size="18"><component :is="tab.icon" /></el-icon>
            <span>{{ tab.label }}</span>
          </button>
        </div>
        <el-input v-model="keyword" :placeholder="t('search_placeholder')" clearable class="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <div v-if="filtered.length" class="grid">
        <ProductCard v-for="p in filtered" :key="p.id" :product="p" />
      </div>
      <el-empty v-else :description="t('products_no_result')" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Grid, FirstAidKit, Monitor, Operation, Aim, MagicStick } from '@element-plus/icons-vue'
import ProductCard from '@/components/ProductCard.vue'
import { products, loadProducts } from '@/api/products'
import { categories } from '@/data/products'
import { t } from '@/i18n'

const route = useRoute()
const activeCat = ref('all')
const keyword = ref('')

const iconMap = {
  ppe: FirstAidKit,
  monitoring: Monitor,
  consumables: Operation,
  rehab: Aim,
  disinfection: MagicStick
}
// 排除“全部”的各大类
const catKeys = computed(() => categories.filter((c) => c.key !== 'all').map((c) => c.key))

// tabs 项：全部 + 各分类（图标 + 下划线）
const tabItems = computed(() => [
  { key: 'all', label: t('catL_all'), icon: Grid },
  ...catKeys.value.map((k) => ({ key: k, label: t('catL_' + k), icon: iconMap[k] }))
])

onMounted(() => {
  loadProducts()
  if (route.query.cat) activeCat.value = route.query.cat
  if (route.query.q) keyword.value = route.query.q
})

watch(() => route.query.cat, (v) => { if (v) activeCat.value = v })
watch(() => route.query.q, (v) => { keyword.value = v || '' })

const filtered = computed(() =>
  products.value.filter((p) => {
    const okCat = activeCat.value === 'all' || p.category === activeCat.value
    const kw = keyword.value.trim().toLowerCase()
    const okKw = !kw || [p.name, p.nameEn, p.spec].join(' ').toLowerCase().includes(kw)
    return okCat && okKw
  })
)
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
.prod-tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tab { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; background: transparent; border: none; border-bottom: 3px solid transparent; border-radius: 8px 8px 0 0; font-size: 15px; font-weight: 600; color: #606266; cursor: pointer; transition: color .2s, background .2s, border-color .2s; }
.tab:hover { color: var(--yl-primary); background: #ecf5ff; }
.tab.active { color: var(--yl-primary); border-bottom-color: var(--yl-primary); background: #ecf5ff; }
.search { width: 240px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
@media (max-width: 1100px) { .grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } .toolbar { justify-content: center; } .search { width: 100%; } }
@media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
</style>
