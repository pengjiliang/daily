<!--
  根组件：承载路由出口 <router-view />。
  模型配置 / 使用统计 / 知识图谱 已改为右侧主区内容页（由 uiStore.mainView 控制，见 Home.vue）。
  下方为全局基础样式：清除默认外边距并让应用撑满视口。
-->
<template>
  <div>
    <router-view />
  </div>
</template>

<script setup lang="ts"></script>

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
