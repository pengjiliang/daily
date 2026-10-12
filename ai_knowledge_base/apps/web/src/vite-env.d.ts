/// <reference types="vite/client" />

// 让 TypeScript 能识别 .vue 单文件组件的默认导出
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// mammoth（docx → HTML）包未提供 types 字段，这里补充预览用到的 API 声明
declare module 'mammoth' {
  interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<MammothResult>;
  function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<MammothResult>;
}

// element-plus 的 dist 语言包（zh-cn.mjs）没有附带类型声明，这里补充最小类型，
// 避免 vue-tsc 报 TS7016（语言包结构为 { name, el: {...} } 的国际化文本对象）
declare module 'element-plus/dist/locale/zh-cn.mjs' {
  import type { Language } from 'element-plus/es/locale';
  const zhCn: Language;
  export default zhCn;
}
