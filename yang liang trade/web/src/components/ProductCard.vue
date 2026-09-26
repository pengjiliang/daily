<template>
  <div class="card card-hover" @click="$router.push(`/products/${product.id}`)">
    <div class="img-wrap"><img :src="product.image" :alt="product.name" loading="lazy" /></div>
    <div class="info">
      <div class="tag">{{ categoryLabel }}</div>
      <div class="name">{{ product.name }}</div>
      <div class="spec">{{ product.spec }}</div>
      <div class="foot"><span class="en">{{ product.nameEn }}</span><span class="more">{{ t('pcard_detail') }} →</span></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { t } from '@/i18n'

const props = defineProps({ product: { type: Object, required: true } })
const categoryLabel = computed(() => {
  if (props.product.category && t('catL_' + props.product.category) !== 'catL_' + props.product.category) {
    return t('catL_' + props.product.category)
  }
  return props.product.categoryLabel || ''
})
</script>

<style scoped>
.card { background: #fff; border: 1px solid #e4e7ed; border-radius: var(--yl-radius); overflow: hidden; cursor: pointer; transition: transform .25s ease, box-shadow .25s ease; }
.card:hover { transform: translateY(-6px); box-shadow: var(--yl-shadow-lg); }
.img-wrap { background: #f5f7fa; position: relative; }
.img-wrap img { width: 100%; height: 200px; object-fit: cover; display: block; transition: transform .35s ease; }
.card:hover .img-wrap img { transform: scale(1.05); }
.info { padding: 16px 18px 18px; }
.tag { display: inline-block; font-size: 12px; color: var(--yl-primary); background: rgba(64,158,255,.10); padding: 2px 10px; border-radius: 20px; margin-bottom: 10px; }
.name { font-size: 17px; font-weight: 700; margin-bottom: 6px; color: var(--yl-primary-dark); }
.spec { font-size: 13px; color: var(--yl-text-light); margin-bottom: 12px; min-height: 18px; }
.foot { display: flex; justify-content: space-between; align-items: center; font-size: 12px; border-top: 1px dashed #e8edf5; padding-top: 12px; }
.en { color: var(--yl-text-light); }
.more { color: var(--yl-accent); font-weight: 600; }
</style>
