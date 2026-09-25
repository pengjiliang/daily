<!--
  左侧面板（左）：三级嵌套菜单。
  一级：AI 助手 / 数据中心 / 系统设置，均可展开收起（互斥）。
  AI 助手 → 二级「会话列表 / 文档管理」，点击展开三级功能按钮与列表区（互斥收起，再点收起）；
  数据中心 → 二级「使用统计 / 知识图谱 / 检索调试」，系统设置 → 二级「模型配置」，点击切换右侧主区内容。
  文档管理：上传文档/上传文件夹、文件夹列表（内联展开）、文件列表（均支持一键删除与行级预览/重命名/删除）；
  会话列表：新建对话、一键删除全部、每行主题描述 + 重命名/删除。
  共享状态来自 useChatStore / useUiStore；删除/重命名弹窗由 Home 统一渲染。
-->
<template>
  <el-aside width="320px" class="sidebar">
    <div class="sidebar-menu">
      <!-- ==================== 一级：AI 助手 ==================== -->
      <div class="menu-group">
        <div class="menu-title" :class="{ active: isTopActive('ai') }" @click="toggleMenu('ai')">
          <el-icon class="menu-icon"><ChatDotRound /></el-icon>
          <span class="menu-label">AI 助手</span>
          <el-icon class="menu-arrow" :class="{ 'is-expanded': uiStore.expandedMenu === 'ai' }"><ArrowDown /></el-icon>
        </div>
        <el-collapse-transition>
          <div v-show="uiStore.expandedMenu === 'ai'" class="menu-body">
            <!-- 二级：会话列表 -->
            <div class="sub-menu" :class="{ active: isSubActive('conversations') }">
              <div class="sub-menu-title" @click="switchAiTab('conversations')">
                <el-icon class="sub-icon"><ChatLineRound /></el-icon>
                <span class="sub-label">会话列表</span>
                <span class="sub-count">{{ chatStore.conversations.length }}</span>
                <el-icon class="sub-arrow" :class="{ 'is-expanded': chatStore.activeTab === 'conversations' }"
                  ><ArrowDown
                /></el-icon>
              </div>
              <el-collapse-transition>
                <div v-show="chatStore.activeTab === 'conversations'" class="sub-content conv-sub">
                  <!-- 新建对话按钮居中显示 -->
                  <div class="new-conv-btn-wrapper">
                    <el-button type="primary" plain size="small" :icon="Plus" @click="chatStore.createNewConversation"
                      >新建对话</el-button
                    >
                  </div>

                  <!-- 会话搜索：按主题关键字过滤（所见即所得） -->
                  <div class="conv-search-wrapper">
                    <el-input
                      v-model="convSearch"
                      size="small"
                      clearable
                      :prefix-icon="Search"
                      placeholder="搜索会话（主题）"
                    />
                  </div>

                  <!-- 会话区标题 + 操作菜单（一键删除收进 ··· 菜单，点击后仍有确认弹窗） -->
                  <div class="conv-section-header">
                    <span>会话列表（{{ filteredConversations.length }}）</span>
                    <el-dropdown
                      trigger="click"
                      :disabled="filteredConversations.length === 0"
                      @command="confirmDeleteFilteredConversations"
                    >
                      <el-button
                        :icon="MoreFilled"
                        text
                        size="small"
                        class="bulk-more-btn"
                        :disabled="filteredConversations.length === 0"
                      />
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="bulk" style="color: var(--el-color-danger)"
                            >一键删除</el-dropdown-item
                          >
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>

                  <el-scrollbar>
                    <div
                      v-for="conv in filteredConversations"
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
                    <div v-if="filteredConversations.length === 0" class="section-empty">暂无会话</div>
                  </el-scrollbar>
                </div>
              </el-collapse-transition>
            </div>

            <!-- 二级：文档管理 -->
            <div class="sub-menu" :class="{ active: isSubActive('documents') }">
              <div class="sub-menu-title" @click="switchAiTab('documents')">
                <el-icon class="sub-icon"><FolderOpened /></el-icon>
                <span class="sub-label">文档管理</span>
                <span class="sub-count">{{ chatStore.documents.length }}</span>
                <el-icon class="sub-arrow" :class="{ 'is-expanded': chatStore.activeTab === 'documents' }"
                  ><ArrowDown
                /></el-icon>
              </div>
              <el-collapse-transition>
                <div v-show="chatStore.activeTab === 'documents'" class="sub-content doc-sub">
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
                        <el-button type="primary" plain size="small" :icon="UploadFilled">上传文档</el-button>
                      </el-upload>
                      <!-- 上传文件夹：优先 File System Access API，不支持则回退 webkitdirectory 原生 input -->
                      <el-button
                        type="primary"
                        plain
                        size="small"
                        :icon="FolderOpened"
                        :loading="chatStore.uploadingFolder"
                        @click="pickFolder"
                      >
                        上传文件夹
                      </el-button>
                      <!-- 粘贴文本导入（多源导入·文本源） -->
                      <el-button type="primary" plain size="small" :icon="Memo" @click="chatStore.openPasteDialog">
                        粘贴文本
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
                    <!-- 文档搜索：按文件名/文件夹名过滤（所见即所得，影响分组与删除范围） -->
                    <div class="doc-search-wrapper">
                      <el-input
                        v-model="docSearch"
                        size="small"
                        clearable
                        :prefix-icon="Search"
                        placeholder="搜索文件 / 文件夹"
                      />
                    </div>
                    <div v-loading="chatStore.loadingDocuments" class="document-list" element-loading-text="加载中...">
                      <!-- 文件夹列表区：操作菜单（···）+ 每个文件夹行可展开/删除 -->
                      <div class="sub-section-title">
                        <span>文件夹列表（{{ folderGroups.length }}）</span>
                        <el-dropdown
                          trigger="click"
                          :disabled="folderGroups.length === 0"
                          @command="confirmDeleteAllFolders"
                        >
                          <el-button
                            :icon="MoreFilled"
                            text
                            size="small"
                            class="bulk-more-btn"
                            :disabled="folderGroups.length === 0"
                          />
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item command="bulk" style="color: var(--el-color-danger)"
                                >一键删除</el-dropdown-item
                              >
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
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
                            @click="chatStore.previewDocument(doc)"
                            :class="[
                              'document-item folder-file-item',
                              { 'highlighted-doc': doc.id === chatStore.highlightedDocumentId },
                            ]"
                          >
                            <el-tooltip :content="displayFolderFileName(group.name, doc)" placement="top-start">
                              <span class="document-name">{{ displayFolderFileName(group.name, doc) }}</span>
                            </el-tooltip>
                            <span v-if="doc.sharedByUsername" class="shared-tag">来自 {{ doc.sharedByUsername }}</span>
                            <div class="doc-actions">
                              <el-tooltip content="预览" placement="top">
                                <el-button :icon="View" text size="small" style="color: #909399" @click.stop="chatStore.previewDocument(doc)" />
                              </el-tooltip>
                              <el-tooltip v-if="!doc.sharedByUsername" content="共享" placement="top">
                                <el-button :icon="Share" text size="small" style="color: #909399" @click.stop="chatStore.openShareDialog(doc)" />
                              </el-tooltip>
                              <el-tooltip v-if="!doc.sharedByUsername || doc.sharedPermission === 'edit'" content="重命名" placement="top">
                                <el-button :icon="EditPen" text size="small" style="color: #909399" @click="chatStore.openRenameDocumentDialog(doc)" />
                              </el-tooltip>
                              <el-tooltip v-if="!doc.sharedByUsername" content="删除" placement="top">
                                <el-button :icon="Delete" text size="small" style="color: #909399" @click="chatStore.confirmDeleteDocument(doc)" />
                              </el-tooltip>
                            </div>
                          </div>
                          <div v-if="group.files.length === 0" class="section-empty">文件夹为空</div>
                        </template>
                      </template>
                      <div v-if="folderGroups.length === 0" class="section-empty">暂无文件夹</div>

                      <!-- 文件列表区：操作菜单（···）+ 每行单个删除 -->
                      <div class="sub-section-title">
                        <span>文件列表（{{ rootFiles.length }}）</span>
                        <el-dropdown
                          trigger="click"
                          :disabled="rootFiles.length === 0"
                          @command="confirmDeleteAllFiles"
                        >
                          <el-button
                            :icon="MoreFilled"
                            text
                            size="small"
                            class="bulk-more-btn"
                            :disabled="rootFiles.length === 0"
                          />
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item command="bulk" style="color: var(--el-color-danger)"
                                >一键删除</el-dropdown-item
                              >
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>
                      <div
                        v-for="doc in rootFiles"
                        :id="'doc-item-' + doc.id"
                        :key="doc.id"
                        @click="chatStore.previewDocument(doc)"
                        :class="['document-item', { 'highlighted-doc': doc.id === chatStore.highlightedDocumentId }]"
                      >
                        <el-tooltip :content="doc.originalName" placement="top-start">
                          <span class="document-name">{{ doc.originalName }}</span>
                        </el-tooltip>
                        <span v-if="doc.sharedByUsername" class="shared-tag">来自 {{ doc.sharedByUsername }}</span>
                        <div class="doc-actions">
                          <el-tooltip content="预览" placement="top">
                            <el-button :icon="View" text size="small" style="color: #909399" @click.stop="chatStore.previewDocument(doc)" />
                          </el-tooltip>
                          <el-tooltip v-if="!doc.sharedByUsername" content="共享" placement="top">
                            <el-button :icon="Share" text size="small" style="color: #909399" @click.stop="chatStore.openShareDialog(doc)" />
                          </el-tooltip>
                          <el-tooltip v-if="!doc.sharedByUsername || doc.sharedPermission === 'edit'" content="重命名" placement="top">
                            <el-button :icon="EditPen" text size="small" style="color: #909399" @click="chatStore.openRenameDocumentDialog(doc)" />
                          </el-tooltip>
                          <el-tooltip v-if="!doc.sharedByUsername" content="删除" placement="top">
                            <el-button :icon="Delete" text size="small" style="color: #909399" @click="chatStore.confirmDeleteDocument(doc)" />
                          </el-tooltip>
                        </div>
                      </div>
                      <div v-if="rootFiles.length === 0" class="section-empty">暂无文件</div>
                    </div>
                  </div>
                </div>
              </el-collapse-transition>
            </div>
          </div>
        </el-collapse-transition>
      </div>

      <!-- ==================== 一级：数据中心 ==================== -->
      <div class="menu-group">
        <div class="menu-title" :class="{ active: isTopActive('data') }" @click="toggleMenu('data')">
          <el-icon class="menu-icon"><DataAnalysis /></el-icon>
          <span class="menu-label">数据中心</span>
          <el-icon class="menu-arrow" :class="{ 'is-expanded': uiStore.expandedMenu === 'data' }"
            ><ArrowDown
          /></el-icon>
        </div>
        <el-collapse-transition>
          <div v-show="uiStore.expandedMenu === 'data'" class="menu-body">
            <div class="sub-menu plain" :class="{ active: isSubActive('stats') }" @click="openView('stats', 'data')">
              <el-icon class="sub-icon"><TrendCharts /></el-icon>
              <span class="sub-label">使用统计</span>
            </div>
            <div class="sub-menu plain" :class="{ active: isSubActive('graph') }" @click="openView('graph', 'data')">
              <el-icon class="sub-icon"><Share /></el-icon>
              <span class="sub-label">知识图谱</span>
            </div>
            <div class="sub-menu plain" :class="{ active: isSubActive('debug') }" @click="openView('debug', 'data')">
              <el-icon class="sub-icon"><Search /></el-icon>
              <span class="sub-label">检索调试</span>
            </div>
          </div>
        </el-collapse-transition>
      </div>

      <!-- ==================== 一级：系统设置 ==================== -->
      <div class="menu-group">
        <div class="menu-title" :class="{ active: isTopActive('system') }" @click="toggleMenu('system')">
          <el-icon class="menu-icon"><Setting /></el-icon>
          <span class="menu-label">系统设置</span>
          <el-icon class="menu-arrow" :class="{ 'is-expanded': uiStore.expandedMenu === 'system' }"
            ><ArrowDown
          /></el-icon>
        </div>
        <el-collapse-transition>
          <div v-show="uiStore.expandedMenu === 'system'" class="menu-body">
            <div
              class="sub-menu plain"
              :class="{ active: isSubActive('settings') }"
              @click="openView('settings', 'system')"
            >
              <el-icon class="sub-icon"><Operation /></el-icon>
              <span class="sub-label">模型配置</span>
            </div>
          </div>
        </el-collapse-transition>
      </div>
    </div>
  </el-aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ArrowDown,
  ChatDotRound,
  ChatLineRound,
  DataAnalysis,
  Delete,
  EditPen,
  FolderOpened,
  Memo,
  MoreFilled,
  Operation,
  Plus,
  QuestionFilled,
  Search,
  Setting,
  Share,
  TrendCharts,
  UploadFilled,
  View,
} from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';
import { useUiStore, type MainView, type SidebarMenuKey } from '@/stores/ui';
import type { UploadDocument } from '@/api/upload';

const chatStore = useChatStore();
const uiStore = useUiStore();

/** 一级菜单展开/收起：同时取消文档列表来源高亮 */
const toggleMenu = (key: SidebarMenuKey) => {
  uiStore.toggleMenu(key);
  chatStore.clearHighlight();
};

/** 打开功能视图（使用统计/知识图谱/模型配置）：同时取消文档列表来源高亮 */
const openView = (view: MainView, menu: SidebarMenuKey) => {
  uiStore.openView(view, menu);
  chatStore.clearHighlight();
};

/** 一级菜单高亮：仅当该组展开且组内没有更深的选中项（二/三级）时点亮 */
const isTopActive = (key: SidebarMenuKey) => {
  if (uiStore.expandedMenu !== key) return false;
  if (key === 'ai') return chatStore.activeTab === '';
  if (key === 'data') return uiStore.mainView !== 'stats' && uiStore.mainView !== 'graph' && uiStore.mainView !== 'debug';
  return uiStore.mainView !== 'settings';
};

/** 二级菜单高亮：AI 组仅在 tab 展开且无三级选中时点亮；数据中心/系统设置为最深层，按 mainView 点亮 */
const isSubActive = (key: 'conversations' | 'documents' | 'stats' | 'graph' | 'debug' | 'settings') => {
  if (key === 'conversations') {
    return chatStore.activeTab === 'conversations' && !chatStore.currentConversation?.id;
  }
  if (key === 'documents') {
    return chatStore.activeTab === 'documents' && !chatStore.highlightedDocumentId;
  }
  if (key === 'stats') return uiStore.mainView === 'stats';
  if (key === 'graph') return uiStore.mainView === 'graph';
  if (key === 'debug') return uiStore.mainView === 'debug';
  return uiStore.mainView === 'settings';
};

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

/** 点击 AI 助手二级菜单：展开对应列表区并切回聊天主视图；再次点击当前项则收起 */
const switchAiTab = (tab: 'documents' | 'conversations') => {
  // 已在聊天视图且当前正展开该列表：再次点击收起；否则（从其它页面切回）总是展开对应列表并切回聊天视图
  const collapse = uiStore.mainView === 'chat' && chatStore.activeTab === tab;
  chatStore.activeTab = collapse ? '' : tab;
  uiStore.openView('chat', 'ai');
  // 切到会话列表或收起时取消文档高亮；切到文档管理时保留
  if (chatStore.activeTab !== 'documents') {
    chatStore.clearHighlight();
  }
};

// ---- 搜索过滤（所见即所得：列表展示、区级一键删除均作用于过滤结果） ----

/** 文档搜索关键字：匹配文件名或所属文件夹路径 */
const docSearch = ref('');
/** 会话搜索关键字：匹配会话主题 */
const convSearch = ref('');

/** 按文件名/文件夹名过滤后的文档列表（空关键字返回全部） */
const filteredDocuments = computed(() => {
  const q = docSearch.value.trim().toLowerCase();
  if (!q) return chatStore.documents;
  return chatStore.documents.filter((doc) => {
    const name = (doc.originalName || '').toLowerCase();
    const folder = (doc.folderName || '').toLowerCase();
    return name.includes(q) || folder.includes(q);
  });
});

/** 按主题过滤后的会话列表（空关键字返回全部） */
const filteredConversations = computed(() => {
  const q = convSearch.value.trim().toLowerCase();
  if (!q) return chatStore.conversations;
  return chatStore.conversations.filter((conv) => (conv.title || '').toLowerCase().includes(q));
});

/** 文件列表区：folderName 为空（单文件上传） */
const rootFiles = computed(() => filteredDocuments.value.filter((doc) => !doc.folderName));

/** 文件夹列表区：folderName 非空，按首段文件夹名分组（组内含该文件夹的所有文件） */
const folderGroups = computed(() => {
  const map = new Map<string, UploadDocument[]>();
  filteredDocuments.value.forEach((doc) => {
    if (!doc.folderName) return;
    const folder = doc.folderName.split('/')[0];
    const list = map.get(folder) ?? [];
    list.push(doc);
    map.set(folder, list);
  });
  return Array.from(map.entries()).map(([name, files]) => ({ name, files }));
});

/** 文档搜索时自动展开命中的顶层文件夹（仅自动展开，不自动收起；清空搜索后保留用户手动展开状态） */
watch(docSearch, () => {
  if (!docSearch.value.trim()) {
    return;
  }
  const foldersToExpand = new Set<string>();
  filteredDocuments.value.forEach((doc) => {
    if (!doc.folderName) return;
    foldersToExpand.add(doc.folderName.split('/')[0]);
  });
  if (foldersToExpand.size === 0) {
    return;
  }
  const next = new Set(chatStore.expandedFolders);
  foldersToExpand.forEach((folder) => next.add(folder));
  chatStore.expandedFolders = next;
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

/** 删除会话列表区的当前筛选结果（确认后并发删除，保持一致且避免误删未筛出的会话） */
const confirmDeleteFilteredConversations = () => {
  if (filteredConversations.value.length === 0) return;
  const count = filteredConversations.value.length;
  chatStore.openDeleteDialog(`确定要删除当前筛选出的全部 ${count} 个会话吗？删除后无法恢复。`, () => {
    chatStore.deleteBulkConversations(filteredConversations.value.map((conv) => conv.id));
  });
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
  background-color: var(--kb-bg-sidebar);
  border-right: 1px solid var(--kb-border);
  height: 100%;
  padding: 0;
}

.sidebar-menu {
  height: 100%;
  overflow-y: auto;
  padding: 8px 0;
}

/* ---- 一级菜单 ---- */
.menu-group {
  margin-bottom: 2px;
}

.menu-title {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--kb-text-primary);
  transition:
    background-color 0.2s,
    color 0.2s;
}

.menu-title:hover {
  background-color: var(--kb-menu-hover);
  color: var(--el-color-primary);
}

.menu-title.active {
  position: relative;
  background-color: var(--kb-menu-active);
  color: var(--el-color-primary);
  font-weight: 600;
}

.menu-title.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 2px;
  background-color: var(--el-color-primary);
}

.menu-title.active .menu-icon,
.menu-title.active .menu-arrow {
  color: var(--el-color-primary);
}

.menu-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.menu-arrow {
  font-size: 14px;
  color: var(--kb-text-secondary);
  transition: transform 0.25s;
}

.menu-arrow.is-expanded {
  transform: rotate(180deg);
}

.menu-body {
  padding: 2px 8px 6px;
}

/* ---- 二级菜单 ---- */
.sub-menu {
  border-radius: 8px;
  margin-bottom: 2px;
}

.sub-menu-title {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--kb-text-regular);
  border-radius: 8px;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.sub-menu-title:hover {
  background-color: var(--kb-menu-hover);
  color: var(--el-color-primary);
}

.sub-menu.active .sub-menu-title {
  position: relative;
  background-color: var(--kb-sub-active);
  color: var(--el-color-primary);
  font-weight: 600;
}

.sub-menu.active .sub-menu-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background-color: var(--el-color-primary);
}

.sub-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.sub-label {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sub-count {
  font-size: 12px;
  color: var(--kb-text-placeholder);
  background-color: var(--kb-bg-input);
  border-radius: 10px;
  padding: 0 7px;
  line-height: 18px;
}

.sub-menu.active .sub-count {
  background-color: var(--kb-bg-card);
  color: var(--el-color-primary);
}

.sub-arrow {
  font-size: 13px;
  color: var(--kb-text-placeholder);
  transition: transform 0.25s;
}

.sub-arrow.is-expanded {
  transform: rotate(180deg);
}

/* 数据中心/系统设置下的纯跳转二级项：整行可点、无展开箭头 */
.sub-menu.plain {
  cursor: pointer;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--kb-text-regular);
  transition:
    background-color 0.2s,
    color 0.2s;
}

.sub-menu.plain:hover {
  background-color: var(--kb-menu-hover);
  color: var(--el-color-primary);
}

.sub-menu.plain.active {
  position: relative;
  background-color: var(--kb-sub-active);
  color: var(--el-color-primary);
  font-weight: 600;
}

.sub-menu.plain.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background-color: var(--el-color-primary);
}

/* ---- 三级内容区 ---- */
.sub-content {
  padding: 8px 4px 12px;
}

/* 文档管理三级区：上传固定，列表自然撑开（超长时随侧栏整体滚动） */
.doc-sub .upload-section {
  margin-bottom: 14px;
  text-align: center;
}

.doc-sub .upload-header {
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
  color: var(--kb-text-secondary);
  cursor: help;
}

.file-list-section {
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--kb-text-primary);
  margin-bottom: 8px;
}

/* 文档列表搜索框 */
.doc-search-wrapper {
  margin-bottom: 10px;
}

.document-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.document-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  padding: 10px 12px;
  border: 1px solid var(--kb-border-light);
  border-radius: 8px;
  background-color: var(--kb-bg-card);
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.document-item:hover {
  background-color: var(--kb-bg-hover);
  border-color: var(--kb-border-hover);
}

.document-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--kb-text-primary);
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

/* 共享给我的文档：来源标签 */
.shared-tag {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-color-primary);
  background-color: var(--kb-sub-active);
  border-radius: 6px;
  padding: 0 6px;
  line-height: 18px;
  max-width: 90px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 文件/文件夹分区小标题（标题 + 右侧"一键删除"按钮） */
.sub-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  color: var(--kb-text-secondary);
  margin: 6px 0 4px;
  padding: 0 2px;
}

/* 区级"···"操作菜单触发按钮：收起危险操作，悬停提示危险色 */
.bulk-more-btn {
  color: var(--kb-text-secondary);
  padding: 0 4px;
}

.bulk-more-btn:not(.is-disabled):hover {
  color: var(--el-color-danger);
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
  color: var(--kb-text-secondary);
  flex-shrink: 0;
}

/* 文件夹内联展开的文件行：左缩进区分层级 */
.folder-file-item {
  margin-left: 18px;
  padding: 8px 12px;
  background-color: var(--kb-bg-folder);
}

.folder-file-item:hover {
  background-color: var(--kb-bg-folder-hover);
}

/* 空区域提示 */
.section-empty {
  font-size: 12px;
  color: var(--kb-text-placeholder);
  text-align: center;
  padding: 12px 0;
}

/* ---- 会话列表三级区 ---- */
.conv-sub .new-conv-btn-wrapper {
  padding: 4px 0 12px;
  text-align: center;
}

/* 会话列表搜索框 */
.conv-search-wrapper {
  margin-bottom: 10px;
}

.conv-sub .conv-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  color: var(--kb-text-secondary);
  margin: 0 2px 8px;
  padding: 0 2px;
}

.conversation-item-sidebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
  border: 1px solid var(--kb-border-item);
  background-color: var(--kb-bg-card);
}

.conversation-item-sidebar:hover {
  background-color: var(--kb-bg-item-hover);
}

.conversation-item-sidebar.active {
  background-color: var(--kb-item-active);
  border-color: var(--kb-item-active-border);
  box-shadow: inset 3px 0 0 var(--el-color-primary);
}

.conv-info-sidebar {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 会话主题描述：单行省略 */
.conv-info-sidebar .conv-title {
  display: block;
  font-size: 13px;
  color: var(--kb-text-primary);
  line-height: 1.4;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.conv-info-sidebar .conv-time {
  font-size: 10px;
  color: var(--kb-text-secondary);
  line-height: 1.4;
}

/* 会话行操作按钮组（重命名/删除），默认隐藏、悬停显示 */
.conv-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}
.conv-actions .el-button,
.doc-actions .el-button {
  padding: 4px 0px !important;
}

.conversation-item-sidebar:hover .conv-actions {
  opacity: 1;
}

/* 来源定位到文档列表后的高亮行 */
.document-item.highlighted-doc {
  border-color: var(--kb-item-active-border);
  background-color: var(--kb-doc-highlight);
  box-shadow: inset 3px 0 0 var(--el-color-primary);
}
</style>

<style>
.conv-search-wrapper .el-input__wrapper {
  border-radius: 6px;
  height: 30px;
}
.doc-search-wrapper .el-input__wrapper {
  border-radius: 6px;
  height: 30px;
}
</style>
