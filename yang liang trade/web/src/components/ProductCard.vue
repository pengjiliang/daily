<template>
  <div class="card card-hover" @click="$router.push(`/products/${product.id}`)">
    <div class="img-wrap"><img :src="product.image" :alt="product.name" loading="lazy" /></div>
    <div class="info">
      <div class="tag">{{ categoryLabel }}</div>
      <div class="name">{{ product.name }}</div>
      <div class="spec">{{ product.spec }}</div>
      <div class="foot"><span class="en">{{ product.nameEn }}</span><span class="more">查看详情 →</span></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ product: { type: Object, required: true } })
const categoryLabel = computed(() => props.product.categoryLabel || '')
</script>

<style scoped>
.card { background: #fff; border: 1px solid #eef2f7; border-radius: var(--yl-radius); overflow: hidden; cursor: pointer; }
.img-wrap { background: linear-gradient(180deg, #f4f9ff, #eaf4ff); }
.img-wrap img { width: 100%; height: 200px; object-fit: cover; display: block; }
.info { padding: 16px 18px 18px; }
.tag { display: inline-block; font-size: 12px; color: var(--yl-primary); background: rgba(37,99,235,.08); padding: 2px 10px; border-radius: 20px; margin-bottom: 10px; }
.name { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
.spec { font-size: 13px; color: var(--yl-text-light); margin-bottom: 12px; min-height: 18px; }
.foot { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.en { color: var(--yl-text-light); }
.more { color: var(--yl-primary); }
</style>

