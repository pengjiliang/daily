<template>
  <svg class="brand-logo" viewBox="0 0 48 48" :width="size" :height="size" aria-hidden="true">
    <defs>
      <linearGradient id="yl-brand-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#409eff" />
        <stop offset="1" stop-color="#2b6dd0" />
      </linearGradient>
    </defs>
    <!-- 底座 -->
    <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#yl-brand-grad)" />
    <!-- 医疗十字 -->
    <path d="M21 13.5h6v7.5h7.5v6H27v7.5h-6V27h-7.5v-6H21z" fill="#fff" />
    <!-- 全球贸易弧线 -->
    <path d="M11.5 24c0-4.6 2-8.7 5.2-11.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.9" />
    <path d="M36.5 24c0-4.6-2-8.7-5.2-11.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.9" />
    <!-- 底部点缀 -->
    <circle cx="24" cy="37" r="1.9" fill="#fff" opacity="0.95" />
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 40 }
})
</script>
