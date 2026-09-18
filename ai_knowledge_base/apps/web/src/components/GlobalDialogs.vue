<!--
  全局弹框宿主：模型配置 / 使用统计 / 知识图谱 以全局弹框形式打开。
  通过 uiStore.activeDialog 控制当前打开的弹框（头像下拉触发打开，关闭时清空状态）。
  弹框内容每次打开时重新挂载（destroy-on-close），保证状态与图表/3D 场景都是最新。
-->
<template>
  <!-- 模型配置 -->
  <el-dialog
    v-model="settingsVisible"
    title="模型配置"
    width="760px"
    top="6vh"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <SettingsPanel />
  </el-dialog>

  <!-- 使用统计 -->
  <el-dialog
    v-model="statsVisible"
    title="使用统计"
    width="1080px"
    top="5vh"
    destroy-on-close
    :close-on-click-modal="false"
    class="stats-dialog"
  >
    <StatsPanel />
  </el-dialog>

  <!-- 知识图谱 -->
  <el-dialog
    v-model="graphVisible"
    title="知识图谱"
    width="1580px"
    top="3vh"
    destroy-on-close
    :close-on-click-modal="false"
    class="graph-dialog"
  >
    <GraphPanel />
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import SettingsPanel from '@/views/Settings.vue';
import StatsPanel from '@/views/Stats.vue';
import GraphPanel from '@/views/Graph.vue';

const uiStore = useUiStore();

const settingsVisible = computed({
  get: () => uiStore.activeDialog === 'settings',
  set: (value: boolean) => {
    if (!value) uiStore.closeDialog();
  },
});

const statsVisible = computed({
  get: () => uiStore.activeDialog === 'stats',
  set: (value: boolean) => {
    if (!value) uiStore.closeDialog();
  },
});

const graphVisible = computed({
  get: () => uiStore.activeDialog === 'graph',
  set: (value: boolean) => {
    if (!value) uiStore.closeDialog();
  },
});
</script>

<style>
/* 使用统计弹框：限制内容区最大高度，正常屏幕无需滚动即可看全，小屏时在弹框内滚动 */
.stats-dialog .el-dialog__body {
  max-height: calc(86vh - 60px);
  overflow: auto;
}

/* 知识图谱全屏弹框：去掉内边距，让 3D 画布撑满剩余高度 */
.graph-dialog .el-dialog__header {
  padding-bottom: 8px;
}

.graph-dialog .el-dialog__body {
  padding: 0;
  height: calc(84vh - 7px);
  overflow: hidden;
}
</style>
