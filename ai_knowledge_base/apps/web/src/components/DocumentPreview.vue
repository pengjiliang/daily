<!--
  文档预览（右侧内容区）：文档管理/来源定位点击预览后在此渲染，不再打开新窗口。
  图片/PDF 用 objectURL；docx（mammoth）、xlsx/xls/xlx/csv（SheetJS）、txt/md 转为 HTML；
  旧版 .doc 等无法解析的格式给出下载提示。数据与状态来自 useChatStore。
-->
<template>
  <div class="doc-preview">
    <div class="preview-header">
      <el-icon class="preview-file-icon"><Document /></el-icon>
      <span class="preview-name" :title="chatStore.previewState?.originalName">
        {{ chatStore.previewState?.originalName }}
      </span>
      <el-tag size="small" type="info" class="preview-ext">{{ extText }}</el-tag>
      <div class="preview-actions">
        <el-button text :icon="Download" @click="download">下载原文件</el-button>
        <el-button text :icon="Close" @click="chatStore.closePreview">关闭预览</el-button>
      </div>
    </div>

    <div class="preview-body">
      <div v-if="chatStore.previewLoading" v-loading="true" class="preview-loading" element-loading-text="正在加载预览..."></div>
      <div v-else-if="kind === 'image'" class="preview-scroll image-wrap">
        <img
          :src="chatStore.previewState?.url || ''"
          class="preview-image"
          :alt="chatStore.previewState?.originalName"
        />
      </div>
      <iframe v-else-if="kind === 'pdf'" class="preview-iframe" :src="chatStore.previewState?.url || ''" />
      <div v-else-if="kind === 'html'" class="preview-scroll preview-html" v-html="chatStore.previewState?.html"></div>
      <div v-else class="preview-unsupported">
        <el-empty description="该格式暂不支持在线预览，请下载后查看">
          <el-button type="primary" :icon="Download" @click="download">下载原文件</el-button>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import { Document, Download, Close } from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';
import { uploadApi } from '@/api/upload';

const chatStore = useChatStore();

const kind = computed(() => chatStore.previewState?.kind ?? 'unsupported');
const extText = computed(() => (chatStore.previewState?.ext || '').toUpperCase() || 'FILE');

const download = () => {
  const state = chatStore.previewState;
  if (!state) return;
  uploadApi.downloadDocument(state.id, state.originalName);
};

// 面板卸载（切到其它视图）时释放 objectURL 与预览状态，避免内存泄漏
onBeforeUnmount(() => {
  chatStore.releasePreview();
});
</script>

<style scoped>
.doc-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--kb-bg-card);
}

.preview-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--kb-border-light);
}

.preview-file-icon {
  font-size: 20px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.preview-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 600;
  color: var(--kb-text-primary);
}

.preview-ext {
  flex-shrink: 0;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.preview-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--kb-bg-page);
}

.preview-loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-scroll {
  height: 100%;
  overflow: auto;
  background: var(--kb-bg-card);
}

/* 图片：等比缩放适配可视区域，超大图可滚动查看 */
.image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--kb-bg-card);
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--kb-bg-card);
}

/* 转 HTML 内容（md/txt/docx/xlsx）的排版 */
.preview-html {
  padding: 24px 32px;
  color: var(--kb-text-primary);
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}

.preview-html h1,
.preview-html h2,
.preview-html h3,
.preview-html h4,
.preview-html h5,
.preview-html h6 {
  margin: 16px 0 8px;
  color: var(--kb-text-primary);
  line-height: 1.4;
}

.preview-html h1 { font-size: 24px; }
.preview-html h2 { font-size: 21px; }
.preview-html h3 { font-size: 18px; }
.preview-html h4 { font-size: 16px; }
.preview-html h5 { font-size: 15px; }
.preview-html h6 { font-size: 14px; }

.preview-html p {
  margin: 8px 0;
}

.preview-html code {
  background: var(--kb-code-bg);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 13px;
  color: var(--kb-code-color);
}

.preview-html pre.md-code {
  background: var(--kb-pre-bg);
  border: 1px solid var(--kb-border);
  border-radius: 6px;
  padding: 12px 14px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
}

.preview-html pre.md-code code {
  background: transparent;
  padding: 0;
  color: inherit;
}

.preview-html blockquote {
  margin: 10px 0;
  padding: 6px 14px;
  border-left: 4px solid var(--el-color-primary);
  background: var(--kb-bg-page);
  color: var(--kb-text-regular);
}

/* 来源片段定位原文时的高亮标记 */
.preview-html mark {
  background: rgba(230, 162, 60, 0.28);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.preview-html ul,
.preview-html ol {
  padding-left: 22px;
  margin: 8px 0;
}

.preview-html hr {
  border: none;
  border-top: 1px solid var(--kb-border);
  margin: 16px 0;
}

.preview-html a {
  color: var(--el-color-primary);
}

/* SheetJS 输出的表格 */
.preview-html table {
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 13px;
}

.preview-html table th,
.preview-html table td {
  border: 1px solid var(--kb-border);
  padding: 6px 10px;
  white-space: nowrap;
  text-align: left;
}

.preview-html table th {
  background: var(--kb-bg-page);
  font-weight: 600;
  color: var(--kb-text-regular);
}

.preview-unsupported {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--kb-bg-card);
}
</style>
