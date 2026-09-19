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
