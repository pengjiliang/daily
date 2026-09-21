/**
 * 全局 UI 状态：
 * - mainView：右侧主区当前展示的视图（聊天 / 文档预览 / 使用统计 / 知识图谱 / 模型配置），由左侧菜单与头像下拉切换。
 * - expandedMenu：左侧一级菜单当前展开项（AI 助手 / 数据中心 / 系统设置），互斥展开，可再点收起。
 * 功能不再以全局弹框打开，统一作为主区内容页展示。
 */
import { defineStore } from 'pinia';

export type MainView = 'chat' | 'preview' | 'stats' | 'graph' | 'settings';
export type SidebarMenuKey = 'ai' | 'data' | 'system';

export const useUiStore = defineStore('ui', {
  state: () => ({
    mainView: 'chat' as MainView,
    expandedMenu: 'ai' as SidebarMenuKey | null,
    isDark: typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
    /** 打开预览前的视图：关闭预览时回到原处（如从知识图谱打开则回到图谱页） */
    previewOrigin: 'chat' as MainView,
  }),
  actions: {
    setMainView(view: MainView) {
      this.mainView = view;
    },
    /** 应用深浅主题：切换 <html> 上的 dark 类并持久化到 localStorage */
    setDark(dark: boolean) {
      this.isDark = dark;
      const root = document.documentElement;
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
      localStorage.setItem('kb-theme', dark ? 'dark' : 'light');
    },
    /** 切换深浅主题 */
    toggleTheme() {
      this.setDark(!this.isDark);
    },
    /** 切换一级菜单展开/收起（互斥：展开该项并收起其它项） */
    toggleMenu(key: SidebarMenuKey) {
      this.expandedMenu = this.expandedMenu === key ? null : key;
    },
    /** 打开某个功能视图：切换主区内容并展开对应一级菜单 */
    openView(view: MainView, menu: SidebarMenuKey) {
      this.mainView = view;
      this.expandedMenu = menu;
    },
  },
});
