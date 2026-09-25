<template>
  <div v-if="product" class="page-section">
    <div class="container">
      <el-breadcrumb separator="/" style="margin-bottom: 28px">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item :to="{ path: '/products' }">产品中心</el-breadcrumb-item>
        <el-breadcrumb-item>{{ product.name }}</el-breadcrumb-item>
      </el-breadcrumb>

      <!-- 顶部：主图 + 基本信息 -->
      <div class="detail">
        <div class="gallery">
          <img :src="product.image" :alt="product.name" />
        </div>
        <div class="info">
          <div class="tag">{{ categoryLabel }}</div>
          <h1>{{ product.name }}</h1>
          <div class="en">{{ product.nameEn }}</div>
          <div class="spec" v-if="product.spec">
            <div class="sp-title">规格</div>
            <div class="sp-value">{{ product.spec }}</div>
          </div>

          <div class="features" v-if="product.features && product.features.length">
            <div class="f-title">产品特点</div>
            <div v-for="f in product.features" :key="f" class="feature">
              <el-icon><CircleCheck /></el-icon>{{ f }}
            </div>
          </div>

          <div class="actions">
            <el-button type="primary" size="large" round @click="goContact">获取报价</el-button>
            <el-button size="large" round @click="goContact">WhatsApp 咨询</el-button>
          </div>
        </div>
      </div>

      <!-- 商品详情：富文本内容通栏展示 -->
      <div class="detail-section" v-if="product.desc">
        <h2 class="ds-title">产品详情</h2>
        <div class="rich" v-html="product.desc"></div>
      </div>

      <!-- 相关产品 -->
      <div class="related">
        <h3 class="rl-title">相关产品</h3>
        <div class="grid">
          <ProductCard v-for="p in related" :key="p.id" :product="p" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleCheck } from '@element-plus/icons-vue'
import ProductCard from '@/components/ProductCard.vue'
import { products, getProduct, loadProducts } from '@/api/products'
import { categories } from '@/data/products'

const route = useRoute()
const router = useRouter()
onMounted(() => loadProducts())
const product = computed(() => getProduct(route.params.id))
const categoryLabel = computed(() => categories.find((c) => c.key === product.value?.category)?.label || '')
const related = computed(() => products.value.filter((p) => p.category === product.value?.category && p.id !== product.value?.id).slice(0, 3))

function goContact() {
  router.push({ path: '/contact', query: { subject: product.value?.name } })
}
</script>

<style scoped>
/* 顶部：左主图、右信息 */
.detail { display: grid; grid-template-columns: 420px 1fr; gap: 48px; align-items: start; }
.gallery { background: linear-gradient(180deg, #f4f9ff, #eaf4ff); border-radius: 18px; overflow: hidden; }
.gallery img { width: 100%; display: block; }

.info { padding-top: 4px; }
.tag { display: inline-block; font-size: 13px; color: var(--yl-primary); background: rgba(37,99,235,.08); padding: 3px 12px; border-radius: 20px; margin-bottom: 14px; }
h1 { margin: 0 0 6px; font-size: 30px; }
.en { color: var(--yl-text-light); margin-bottom: 16px; font-size: 14px; }
.spec { margin-bottom: 22px; }
.sp-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: var(--yl-text); }
.sp-value { display: inline-block; background: #eef6ff; color: var(--yl-primary); padding: 6px 14px; border-radius: 8px; font-size: 14px; }

.f-title { grid-column: 1 / -1; font-size: 15px; font-weight: 600; margin: 4px 0 10px; color: var(--yl-text); }
.features { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 28px; }
.feature { display: flex; align-items: center; gap: 8px; color: var(--yl-text); font-size: 14px; }
.feature .el-icon { color: var(--yl-primary); }
.actions { display: flex; gap: 12px; }

/* 商品详情：通栏富文本 */
.detail-section { margin-top: 56px; background: #fff; border: 1px solid #edf2f9; border-radius: 14px; padding: 28px 32px; }
.ds-title { font-size: 20px; margin: 0 0 18px; padding-bottom: 14px; border-bottom: 1px solid #edf2f9; color: var(--yl-text); }
.rich { color: var(--yl-text); line-height: 1.9; font-size: 15px; word-break: break-word; }
.rich :deep(p) { margin: 0 0 14px; }
.rich :deep(img) { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
.rich :deep(table) { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 14px; }
.rich :deep(th), .rich :deep(td) { border: 1px solid #d9e2ef; padding: 10px 14px; text-align: left; }
.rich :deep(th) { background: #f2f7ff; color: var(--yl-primary); font-weight: 600; }
.rich :deep(ul), .rich :deep(ol) { padding-left: 22px; margin: 0 0 14px; }
.rich :deep(li) { margin: 4px 0; }
.rich :deep(h1), .rich :deep(h2), .rich :deep(h3) { margin: 18px 0 10px; }

/* 相关产品 */
.related { margin-top: 72px; }
.rl-title { font-size: 22px; margin: 0 0 20px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

@media (max-width: 900px) {
  .detail { grid-template-columns: 1fr; }
  .grid { grid-template-columns: 1fr; }
  .features { grid-template-columns: 1fr; }
  .detail-section { padding: 20px; }
}
</style>

