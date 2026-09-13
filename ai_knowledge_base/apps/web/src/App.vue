<!--
  根组件：仅承载路由出口 <router-view />，页面由路由在登录/注册/主页间切换。
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
