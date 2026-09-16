<!--
  左侧面板（左）：Tab 切换「文档管理」与「会话列表」。
  文档管理：上传文档/上传文件夹、文件夹列表（内联展开）、文件列表（两区均支持一键删除与行级预览/重命名/删除）；
  会话列表：新建对话、一键删除全部、每行主题描述 + 重命名/删除。
  共享状态来自 useChatStore；删除/重命名弹窗由 Home 统一渲染。
-->
<template>
  <el-aside width="320px" class="sidebar">
    <el-tabs v-model="chatStore.activeTab" class="sidebar-tabs">
      <el-tab-pane label="文档管理" name="documents">
        <div class="tab-content document-tab-content">
          <!-- 上传文档按钮（居中，鼠标悬浮问号显示提示） -->
          <div class="upload-section">
            <div class="upload-header">
              <el-upload
                class="uploader"
                :show-file-list="false"
                :before-upload="chatStore.beforeUpload"
                :http-request="chatStore.handleUpload"
                multiple
              >
                <el-button type="primary" :icon="UploadFilled">上传文档</el-button>
              </el-upload>
              <!-- 上传文件夹：优先 File System Access API，不支持则回退 webkitdirectory 原生 input -->
              <el-button
                type="primary"
                plain
                :icon="FolderOpened"
                :loading="chatStore.uploadingFolder"
                @click="pickFolder"
              >
                上传文件夹
              </el-button>
              <input
                ref="folderInput"
                type="file"
                webkitdirectory
                multiple
                class="folder-input-hidden"
                @change="chatStore.handleFolderChange"
              />
              <el-tooltip
                content="支持 PDF、Word(.docx)、Excel(.xlsx/.xls)、CSV、Markdown、TXT、JPG/PNG/GIF 图片(OCR)，单个文件不超过 10MB"
                placement="top"
              >
                <el-icon class="question-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
          </div>

          <!-- 我的文档：分"文件夹列表"和"文件列表"两个区域；文件夹点击内联展开内部文件 -->
          <div class="file-list-section">
            <div class="section-title">文档列表</div>
            <div v-loading="chatStore.loadingDocuments" class="document-list" element-loading-text="加载中...">
              <!-- 文件夹列表区：区级一键删除 + 每个文件夹行可展开/删除 -->
              <div class="sub-section-title">
                <span>文件夹列表（{{ folderGroups.length }}）</span>
                <el-button
                  :icon="Delete"
                  text
                  size="small"
                  class="bulk-delete-btn"
                  :disabled="folderGroups.length === 0"
                  @click="confirmDeleteAllFolders"
                >
                  一键删除
                </el-button>
              </div>
              <template v-for="group in folderGroups" :key="group.name">
                <div class="document-item folder-item" @click="toggleFolder(group.name)">
                  <el-icon class="folder-icon"><FolderOpened /></el-icon>
                  <span class="document-name folder-name">{{ group.name }}</span>
                  <span class="folder-count">{{ group.files.length }} 个文件</span>
                  <el-tooltip content="删除文件夹" placement="top">
                    <el-button
                      :icon="Delete"
                      text
                      size="small"
                      style="color: #909399"
                      @click.stop="confirmDeleteFolder(group.name)"
                    />
                  </el-tooltip>
                </div>
                <!-- 内联展开：文件夹内的文件列表（显示文件名，深层子路径带前缀，支持单个删除） -->
                <template v-if="chatStore.expandedFolders.has(group.name)">
                  <div
                    v-for="doc in group.files"
                    :id="'doc-item-' + doc.id"
                    :key="doc.id"
                    :class="[
                      'document-item folder-file-item',
                      { 'highlighted-doc': doc.id === chatStore.highlightedDocumentId },
                    ]"
                  >
                    <el-tooltip :content="displayFolderFileName(group.name, doc)" placement="top-start">
                      <span class="document-name">{{ displayFolderFileName(group.name, doc) }}</span>
                    </el-tooltip>
                    <div class="doc-actions">
                      <el-tooltip content="预览" placement="top">
                        <el-button
                          :icon="View"
                          text
                          size="small"
                          style="color: #909399"
                          @click="chatStore.previewDocument(doc)"
                        />
                      </el-tooltip>
                      <el-tooltip content="重命名" placement="top">
                        <el-button
                          :icon="EditPen"
                          text
                          size="small"
                          style="color: #909399"
                          @click="chatStore.openRenameDocumentDialog(doc)"
                        />
                      </el-tooltip>
                      <el-tooltip content="删除" placement="top">
                        <el-button
                          :icon="Delete"
                          text
                          size="small"
                          style="color: #909399"
                          @click="chatStore.confirmDeleteDocument(doc)"
                        />
                      </el-tooltip>
                    </div>
                  </div>
                  <div v-if="group.files.length === 0" class="section-empty">文件夹为空</div>
                </template>
              </template>
              <div v-if="folderGroups.length === 0" class="section-empty">暂无文件夹</div>

              <!-- 文件列表区：区级一键删除 + 每行单个删除 -->
              <div class="sub-section-title">
                <span>文件列表（{{ rootFiles.length }}）</span>
                <el-button
                  :icon="Delete"
                  text
                  size="small"
                  class="bulk-delete-btn"
                  :disabled="rootFiles.length === 0"
                  @click="confirmDeleteAllFiles"
                >
                  一键删除
                </el-button>
              </div>
              <div
                v-for="doc in rootFiles"
                :id="'doc-item-' + doc.id"
                :key="doc.id"
                :class="['document-item', { 'highlighted-doc': doc.id === chatStore.highlightedDocumentId }]"
              >
                <el-tooltip :content="doc.originalName" placement="top-start">
                  <span class="document-name">{{ doc.originalName }}</span>
                </el-tooltip>
                <div class="doc-actions">
                  <el-tooltip content="预览" placement="top">
                    <el-button
                      :icon="View"
                      text
                      size="small"
                      style="color: #909399"
                      @click="chatStore.previewDocument(doc)"
                    />
                  </el-tooltip>
                  <el-tooltip content="重命名" placement="top">
                    <el-button
                      :icon="EditPen"
                      text
                      size="small"
                      style="color: #909399"
                      @click="chatStore.openRenameDocumentDialog(doc)"
                    />
                  </el-tooltip>
                  <el-tooltip content="删除" placement="top">
                    <el-button
                      :icon="Delete"
                      text
                      size="small"
                      style="color: #909399"
                      @click="chatStore.confirmDeleteDocument(doc)"
                    />
                  </el-tooltip>
                </div>
              </div>
              <div v-if="rootFiles.length === 0" class="section-empty">暂无文件</div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="会话列表" name="conversations">
        <div class="tab-content conversation-list-wrapper">
          <!-- 新建对话按钮居中显示 -->
          <div class="new-conv-btn-wrapper">
            <el-button type="primary" :icon="Plus" @click="chatStore.createNewConversation">新建对话</el-button>
          </div>

          <!-- 会话区标题 + 一键删除全部会话 -->
          <div class="conv-section-header">
            <span>会话列表（{{ chatStore.conversations.length }}）</span>
            <el-button
              :icon="Delete"
              text
              size="small"
              class="bulk-delete-btn"
              :disabled="chatStore.conversations.length === 0"
              @click="chatStore.confirmDeleteAllConversations"
            >
              一键删除
            </el-button>
          </div>

          <el-scrollbar>
            <div
              v-for="conv in chatStore.conversations"
              :key="conv.id"
              :class="['conversation-item-sidebar', { active: chatStore.currentConversation?.id === conv.id }]"
              @click="chatStore.selectConversation(conv)"
            >
              <div class="conv-info-sidebar">
                <!-- 主题描述：手动重命名优先，否则首条用户消息前 20 字；空会话显示"新对话" -->
                <span class="conv-title">{{ conv.title || '新对话' }}</span>
                <span class="conv-time">{{ chatStore.formatDate(conv.updatedAt) }}</span>
              </div>
              <div class="conv-actions">
                <!-- 会话重命名按钮 -->
                <el-tooltip content="重命名" placement="top">
                  <el-button
                    :icon="EditPen"
                    text
                    size="small"
                    style="color: #909399"
                    @click.stop="chatStore.openRenameConversationDialog(conv)"
                  />
                </el-tooltip>
                <!-- 会话列表删除按钮：改灰色文字图标 -->
                <el-tooltip content="删除该对话" placement="top">
                  <el-button
                    :icon="Delete"
                    text
                    size="small"
                    style="color: #909399"
                    @click.stop="chatStore.confirmDeleteConversation(conv)"
                  />
                </el-tooltip>
              </div>
            </div>
            <div v-if="chatStore.conversations.length === 0" class="section-empty">暂无会话</div>
          </el-scrollbar>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Delete, EditPen, FolderOpened, Plus, QuestionFilled, UploadFilled, View } from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';
import type { UploadDocument } from '@/api/upload';

const chatStore = useChatStore();

/** 隐藏的原生文件夹选择 input（回退方案：webkitdirectory） */
const folderInput = ref<HTMLInputElement | null>(null);

/** 文件夹选择入口：优先 File System Access API（Chrome/Edge），不支持则回退 webkitdirectory 原生 input */
const pickFolder = async () => {
  const picker = (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  if (typeof picker === 'function') {
    await chatStore.pickFolderWithPicker();
  } else {
    folderInput.value?.click();
  }
};

/** 文件列表区：folderName 为空（单文件上传） */
const rootFiles = computed(() => chatStore.documents.filter((doc) => !doc.folderName));

/** 文件夹列表区：folderName 非空，按首段文件夹名分组（组内含该文件夹的所有文件） */
const folderGroups = computed(() => {
  const map = new Map<string, UploadDocument[]>();
  chatStore.documents.forEach((doc) => {
    if (!doc.folderName) return;
    const folder = doc.folderName.split('/')[0];
    const list = map.get(folder) ?? [];
    list.push(doc);
    map.set(folder, list);
  });
  return Array.from(map.entries()).map(([name, files]) => ({ name, files }));
});

/** 展开项显示名：顶层文件夹内的文件显示文件名；有更深子路径时带上前缀（如 `文档/报告.pdf`） */
const displayFolderFileName = (groupName: string, doc: UploadDocument) => {
  const folderName = doc.folderName ?? '';
  if (folderName === groupName) {
    return doc.originalName;
  }
  return `${folderName.slice(groupName.length + 1)}/${doc.originalName}`;
};

/** 点击文件夹行：切换内联展开/收起 */
const toggleFolder = (name: string) => {
  const next = new Set(chatStore.expandedFolders);
  if (next.has(name)) {
    next.delete(name);
  } else {
    next.add(name);
  }
  chatStore.expandedFolders = next;
};

// ---- 区级删除（依赖本组件内的 rootFiles/folderGroups 分组结果） ----

/** 删除文件列表区的全部单文件（确认后并发删除） */
const confirmDeleteAllFiles = () => {
  if (rootFiles.value.length === 0) return;
  chatStore.openDeleteDialog(`确定要删除文件列表中的全部 ${rootFiles.value.length} 个文件吗？删除后无法恢复。`, () => {
    chatStore.deleteBulkDocuments(rootFiles.value, '文件列表');
  });
};

/** 删除文件夹列表区的全部文件夹及其内文件（确认后并发删除） */
const confirmDeleteAllFolders = () => {
  const folderFiles = chatStore.documents.filter((doc) => doc.folderName);
  if (folderFiles.length === 0) return;
  chatStore.openDeleteDialog(
    `确定要删除全部 ${folderGroups.value.length} 个文件夹及其中的 ${folderFiles.length} 个文件吗？删除后无法恢复。`,
    () => {
      chatStore.expandedFolders = new Set();
      chatStore.deleteBulkDocuments(folderFiles, '文件夹列表');
    },
  );
};

/** 删除整个文件夹：确认后并发删除其下所有文件（复用单文件删除接口，逐条清库记录与向量分块） */
const confirmDeleteFolder = (name: string) => {
  const files = chatStore.documents.filter((doc) => doc.folderName === name || doc.folderName?.startsWith(`${name}/`));
  chatStore.openDeleteDialog(
    `确定要删除文件夹 "${name}" 吗？将同时删除其中的 ${files.length} 个文件，删除后无法恢复。`,
    () => {
      const next = new Set(chatStore.expandedFolders);
      next.delete(name);
      chatStore.expandedFolders = next;
      chatStore.deleteBulkDocuments(files, `文件夹 "${name}"`);
    },
  );
};
</script>

<style scoped>
.sidebar {
  background-color: #f5f5f5;
  border-right: 1px solid #e4e7ed;
  height: 100%;
  padding: 0;
}

.sidebar-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  margin: 0;
}

.sidebar-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}
/* Tab 页签样式：浅灰轨道 + 选中态主色背景 */
.sidebar-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
  padding: 12px 16px;
  background-color: #f5f5f5;
}

.sidebar-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.sidebar-tabs :deep(.el-tabs__nav) {
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 4px;
  border-radius: 8px;
  background-color: #e9ecef;
}

.sidebar-tabs :deep(.el-tabs__item) {
  flex: 1;
  justify-content: center;
  height: 32px;
  line-height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  color: #606266;
  font-size: 14px;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.sidebar-tabs :deep(.el-tabs__item:hover) {
  color: #409eff;
}

.sidebar-tabs :deep(.el-tabs__item.is-active) {
  background-color: #409eff;
  color: #fff;
}

.sidebar-tabs :deep(.el-tabs__active-bar) {
  display: none;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

/* 文档管理页：上传区固定，列表区占满并独立纵向滚动 */
.document-tab-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.document-tab-content .upload-section {
  flex-shrink: 0;
  padding: 16px 16px 0;
  margin-bottom: 16px;
}

.document-tab-content .file-list-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 0;
  padding: 0 16px 16px;
}

.document-tab-content .section-title {
  flex-shrink: 0;
  margin-bottom: 10px;
}

/* 上传文档部分 */
.upload-section {
  margin-bottom: 20px;
  text-align: center; /* 按钮和问号居中 */
}

.upload-header {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

/* 隐藏的原生文件夹选择 input（由"上传文件夹"按钮触发） */
.folder-input-hidden {
  display: none;
}

.question-icon {
  font-size: 16px;
  color: #909399;
  cursor: help;
}

/* 文档列表：行式展示，单行省略，超出纵向滚动 */
.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 10px;
}

.document-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.document-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background-color: #fff;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.document-item:hover {
  background-color: #f8fafc;
  border-color: #d9e4f5;
}

.document-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #303133;
  font-size: 13px;
}

/* 文档行操作按钮组（预览/重命名/删除），默认隐藏、悬停显示，避免拥挤 */
.doc-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.document-item:hover .doc-actions {
  opacity: 1;
}

/* 文件/文件夹分区小标题（标题 + 右侧"一键删除"按钮） */
.sub-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  color: #909399;
  margin: 6px 0 4px;
  padding: 0 2px;
}

/* 区级"一键删除"按钮：红色小字，不可用时置灰 */
.bulk-delete-btn {
  color: #f56c6c;
  font-size: 12px;
  padding: 0 4px;
}

.bulk-delete-btn:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

/* 文件夹行：整行可点击展开/收起 */
.folder-item {
  cursor: pointer;
}

.folder-icon {
  color: #e6a23c;
  font-size: 16px;
  flex-shrink: 0;
}

.folder-name {
  font-weight: 500;
}

.folder-count {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}

/* 文件夹内联展开的文件行：左缩进区分层级 */
.folder-file-item {
  margin-left: 18px;
  padding: 8px 12px;
  background-color: #fafafa;
}

.folder-file-item:hover {
  background-color: #f0f6ff;
}

/* 空区域提示 */
.section-empty {
  font-size: 12px;
  color: #c0c4cc;
  text-align: center;
  padding: 12px 0;
}

/* 会话列表 */
.conversation-list-wrapper {
  padding: 0;
}

.new-conv-btn-wrapper {
  padding: 16px;
  text-align: center; /* 新建对话按钮居中 */
}

.conversation-item-sidebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
  border: 1px solid #f0f0f0;
  background-color: #fff;
}

.conversation-item-sidebar:hover {
  background-color: #f0f2f5;
}

.conversation-item-sidebar.active {
  background-color: #e8f3ff;
  border-color: #409eff;
}

.conv-info-sidebar {
  flex: 1;
  min-width: 0;
}

/* 会话主题描述：单行省略 */
.conv-info-sidebar .conv-title {
  display: block;
  font-size: 13px;
  color: #303133;
  line-height: 1.4;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.conv-info-sidebar .conv-time {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

/* 会话区标题行：标题 + 右侧"一键删除"按钮 */
.conv-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  color: #909399;
  margin: 0 2px 8px;
  padding: 0 2px;
}

/* 会话行操作按钮组（重命名/删除），默认隐藏、悬停显示 */
.conv-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.conversation-item-sidebar:hover .conv-actions {
  opacity: 1;
}

/* 来源定位到文档列表后的高亮行 */
.document-item.highlighted-doc {
  border-color: #409eff;
  background-color: #ecf5ff;
}
</style>
