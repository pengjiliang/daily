<template>
  <div class="page-section">
    <div class="container">
      <h2 class="section-title">产品中心</h2>
      <p class="section-sub">扬良贸易 · 医疗器械与医用产品全品类供应</p>

      <div class="toolbar">
        <div class="cats">
          <el-radio-group v-model="activeCat" @change="onCatChange">
            <el-radio-button v-for="c in categories" :key="c.key" :value="c.key">{{ c.label }}</el-radio-button>
          </el-radio-group>
        </div>
        <el-input v-model="keyword" placeholder="搜索产品名称 / 规格" clearable style="width: 240px">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <div v-if="filtered.length" class="grid">
        <ProductCard v-for="p in filtered" :key="p.id" :product="p" />
      </div>
      <el-empty v-else description="暂无相关产品" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import ProductCard from '@/components/ProductCard.vue'
import { products, loadProducts } from '@/api/products'
import { categories } from '@/data/products'

const route = useRoute()
const activeCat = ref('all')
const keyword = ref('')

onMounted(() => {
  loadProducts()
  if (route.query.cat) activeCat.value = route.query.cat
})

watch(() => route.query.cat, (v) => { if (v) activeCat.value = v })

const filtered = computed(() =>
  products.value.filter((p) => {
    const okCat = activeCat.value === 'all' || p.category === activeCat.value
    const kw = keyword.value.trim().toLowerCase()
    const okKw = !kw || [p.name, p.nameEn, p.spec].join(' ').toLowerCase().includes(kw)
    return okCat && okKw
  })
)

function onCatChange() {
  // 保持 URL 同步（可选）
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
@media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style>

