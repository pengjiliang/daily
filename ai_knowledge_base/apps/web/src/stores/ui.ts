/**
 * 全局 UI 状态：模型配置 / 使用统计 / 知识图谱 三个面板以全局弹框形式打开（而非路由页面）。
 * AppHeader 头像下拉触发 openDialog；GlobalDialogs 宿主统一渲染对应弹框。
 */
import { defineStore } from 'pinia';

export type GlobalDialog = 'settings' | 'stats' | 'graph';

export const useUiStore = defineStore('ui', {
  state: () => ({
    activeDialog: null as GlobalDialog | null,
  }),
  actions: {
    openDialog(name: GlobalDialog) {
      this.activeDialog = name;
    },
    closeDialog() {
      this.activeDialog = null;
    },
  },
});