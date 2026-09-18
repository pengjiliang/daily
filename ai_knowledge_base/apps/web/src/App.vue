<!--
  根组件：承载路由出口 <router-view /> 与全局弹框宿主 <GlobalDialogs />。
  模型配置 / 使用统计 / 知识图谱 以全局弹框形式打开（由 uiStore 控制）。
  下方为全局基础样式：清除默认外边距并让应用撑满视口。
-->
<template>
  <div>
    <router-view />
    <GlobalDialogs />
  </div>
</template>

<script setup lang="ts">
import GlobalDialogs from '@/components/GlobalDialogs.vue';
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
}
</style>