<template>
  <SiteHeader v-if="!isAdminPage" />
  <router-view />
  <SiteFooter v-if="!isAdminPage" />
  <ChatWidget v-if="!isAdminPage" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import ChatWidget from '@/components/ChatWidget.vue'

const route = useRoute()
const isAdminPage = computed(() => route.path.startsWith('/admin'))
</script>
