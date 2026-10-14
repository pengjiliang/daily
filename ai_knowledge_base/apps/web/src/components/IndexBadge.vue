<!--
  文档索引状态徽标（亮点 1）：
  pending/running → 旋转 loading；done → 绿勾（显示分块数）；
  failed → 红叉（悬浮显示原因，所有者可点击重试）。
-->
<template>
  <el-tooltip :content="tooltip" placement="top">
    <el-icon
      :class="['index-badge', badgeClass]"
      @click="onClick"
    >
      <Loading v-if="loading" class="is-loading" />
      <CircleCheck v-else-if="status === 'done'" />
      <CircleClose v-else />
    </el-icon>
  </el-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck, CircleClose, Loading } from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';
import type { UploadDocument } from '@/api/upload';
import type { IndexErrorKind } from '@ai-knowledge-base/shared';

const props = defineProps<{ doc: UploadDocument }>();
const chatStore = useChatStore();

const status = computed(() => props.doc.indexStatus ?? 'pending');
const loading = computed(() => status.value === 'pending' || status.value === 'running');

const errorText = (kind?: IndexErrorKind | null) => {
  switch (kind) {
    case 'unsupported_format':
      return '格式不支持（如 .doc 请另存为 .docx）';
    case 'empty_content':
      return '文档不包含可索引内容（可能为扫描件）';
    case 'embedding_failed':
      return '向量化失败';
    case 'document_deleted':
      return '文档已删除';
    default:
      return props.doc.indexError || '索引失败，可点击重试';
  }
};

const tooltip = computed(() => {
  if (loading.value) {
    return status.value === 'running' ? '正在索引…' : '等待索引…';
  }
  if (status.value === 'done') {
    return props.doc.chunkCount != null ? `已索引 ${props.doc.chunkCount} 个分块` : '索引完成';
  }
  return errorText(props.doc.errorKind);
});

const badgeClass = computed(() => {
  if (loading.value) return 'index-loading';
  if (status.value === 'done') return 'index-done';
  return 'index-failed';
});

const onClick = () => {
  if (status.value === 'failed' && !props.doc.sharedByUsername) {
    chatStore.reindexDocument(props.doc);
  }
};
</script>

<style scoped>
.index-badge {
  flex-shrink: 0;
  font-size: 15px;
  cursor: default;
}
.index-badge.index-loading {
  color: var(--el-color-info);
  animation: rotating 1.2s linear infinite;
}
.index-badge.index-done {
  color: var(--el-color-success);
}
.index-badge.index-failed {
  color: var(--el-color-danger);
  cursor: pointer;
}
@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
