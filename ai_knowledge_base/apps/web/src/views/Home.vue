<!--
  主页（核心工作台）：
  顶部为用户菜单（换头像/登出）；左侧 Tab 切换「知识库文档管理」与「对话列表」；
  右侧为聊天区，支持 SSE 流式问答（先出来源、再逐 token 出答案），并展示知识库/外部两类引用。
-->
<template>
  <div class="home-container">
    <!-- 顶部导航栏 -->
    <el-header class="header">
      <div class="title">AI 知识库</div>
      <div class="user-info">
        <el-dropdown @command="handleCommand">
          <div class="user-trigger">
            <span class="username">{{ userStore.userInfo?.username }}</span>
            <div class="avatar-wrapper">
              <el-avatar v-if="userStore.userInfo?.avatarUrl" :src="fullAvatarUrl" size="large" />
              <el-avatar v-else size="large" :icon="UserFilled" />
              <div class="avatar-overlay">
                <Upload />
              </div>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="uploadAvatar">更换头像</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="main-container">
      <!-- 左侧：文件管理 + 会话列表 tabs -->
      <el-aside width="320px" class="sidebar">
        <el-tabs v-model="activeTab" class="sidebar-tabs">
          <el-tab-pane label="文档管理" name="documents">
            <div class="tab-content document-tab-content">
              <!-- 上传文档按钮（居中，鼠标悬浮问号显示提示） -->
              <div class="upload-section">
                <div class="upload-header">
                  <el-upload
                    class="uploader"
                    :show-file-list="false"
                    :before-upload="beforeUpload"
                    :http-request="handleUpload"
                    multiple
                  >
                    <el-button type="primary" :icon="UploadFilled">上传文档</el-button>
                  </el-upload>
                  <!-- 上传文件夹：webkitdirectory 选择整个文件夹，递归上传其中白名单文档（保留相对路径区分重名） -->
                  <el-button type="primary" plain :icon="FolderOpened" :loading="uploadingFolder" @click="pickFolder">
                    上传文件夹
                  </el-button>
                  <input
                    ref="folderInput"
                    type="file"
                    webkitdirectory
                    multiple
                    class="folder-input-hidden"
                    @change="handleFolderChange"
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
                <div class="section-title">我的文档</div>
                <div v-loading="loadingDocuments" class="document-list" element-loading-text="加载中...">
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
                    <template v-if="expandedFolders.has(group.name)">
                      <div
                        v-for="doc in group.files"
                        :id="'doc-item-' + doc.id"
                        :key="doc.id"
                        :class="['document-item folder-file-item', { 'highlighted-doc': doc.id === highlightedDocumentId }]"
                      >
                        <el-tooltip :content="displayFolderFileName(group.name, doc)" placement="top-start">
                          <span class="document-name">{{ displayFolderFileName(group.name, doc) }}</span>
                        </el-tooltip>
                        <div class="doc-actions">
                          <el-tooltip content="预览" placement="top">
                            <el-button :icon="View" text size="small" style="color: #909399" @click="previewDocument(doc)" />
                          </el-tooltip>
                          <el-tooltip content="重命名" placement="top">
                            <el-button :icon="EditPen" text size="small" style="color: #909399" @click="openRenameDocumentDialog(doc)" />
                          </el-tooltip>
                          <el-tooltip content="删除" placement="top">
                            <el-button
                              :icon="Delete"
                              text
                              size="small"
                              style="color: #909399"
                              @click="confirmDeleteDocument(doc)"
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
                    :class="['document-item', { 'highlighted-doc': doc.id === highlightedDocumentId }]"
                  >
                    <el-tooltip :content="doc.originalName" placement="top-start">
                      <span class="document-name">{{ doc.originalName }}</span>
                    </el-tooltip>
                    <div class="doc-actions">
                      <el-tooltip content="预览" placement="top">
                        <el-button :icon="View" text size="small" style="color: #909399" @click="previewDocument(doc)" />
                      </el-tooltip>
                      <el-tooltip content="重命名" placement="top">
                        <el-button :icon="EditPen" text size="small" style="color: #909399" @click="openRenameDocumentDialog(doc)" />
                      </el-tooltip>
                      <el-tooltip content="删除" placement="top">
                        <el-button
                          :icon="Delete"
                          text
                          size="small"
                          style="color: #909399"
                          @click="confirmDeleteDocument(doc)"
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
                <el-button type="primary" :icon="Plus" @click="createNewConversation">新建对话</el-button>
              </div>

              <!-- 会话区标题 + 一键删除全部会话 -->
              <div class="conv-section-header">
                <span>会话列表（{{ conversations.length }}）</span>
                <el-button
                  :icon="Delete"
                  text
                  size="small"
                  class="bulk-delete-btn"
                  :disabled="conversations.length === 0"
                  @click="confirmDeleteAllConversations"
                >
                  一键删除
                </el-button>
              </div>

              <el-scrollbar>
                <div
                  v-for="conv in conversations"
                  :key="conv.id"
                  :class="['conversation-item-sidebar', { active: currentConversation?.id === conv.id }]"
                  @click="selectConversation(conv)"
                >
                  <div class="conv-info-sidebar">
                    <!-- 主题描述：手动重命名优先，否则首条用户消息前 20 字；空会话显示"新对话" -->
                    <span class="conv-title">{{ conv.title || '新对话' }}</span>
                    <span class="conv-time">{{ formatDate(conv.updatedAt) }}</span>
                  </div>
                  <div class="conv-actions">
                    <!-- 会话重命名按钮 -->
                    <el-tooltip content="重命名" placement="top">
                      <el-button
                        :icon="EditPen"
                        text
                        size="small"
                        style="color: #909399"
                        @click.stop="openRenameConversationDialog(conv)"
                      />
                    </el-tooltip>
                    <!-- 会话列表删除按钮：改灰色文字图标 -->
                    <el-tooltip content="删除该对话" placement="top">
                      <el-button
                        :icon="Delete"
                        text
                        size="small"
                        style="color: #909399"
                        @click.stop="confirmDeleteConversation(conv)"
                      />
                    </el-tooltip>
                  </div>
                </div>
                <div v-if="conversations.length === 0" class="section-empty">暂无会话</div>
              </el-scrollbar>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-aside>

      <!-- 右侧：对话区域 -->
      <el-main class="chat-section">
        <div v-if="!currentConversation" class="empty-placeholder">
          <span>请选择或新建对话开始聊天</span>
        </div>
        <div class="messages-container" v-if="currentConversation">
          <!-- 会话工具栏：标题（可重命名）+ 复制/下载当前对话 -->
          <div class="chat-toolbar">
            <span class="chat-toolbar-title">{{ currentConversation.title || '新对话' }}</span>
            <el-tooltip content="重命名当前会话" placement="bottom">
              <el-button
                text
                size="small"
                :icon="EditPen"
                style="margin-left: 4px"
                @click="openRenameConversationDialog(currentConversation)"
              />
            </el-tooltip>
            <div class="chat-toolbar-actions">
              <el-button
                text
                size="small"
                :icon="CopyDocument"
                :disabled="messages.length === 0"
                @click="copyConversation"
              >
                复制对话
              </el-button>
              <el-button
                text
                size="small"
                :icon="Download"
                :disabled="messages.length === 0"
                @click="downloadConversation"
              >
                下载对话
              </el-button>
            </div>
          </div>
          <el-scrollbar ref="messageScrollRef">
            <div class="message-list">
              <div v-for="msg in messages" :key="msg.id" :class="['message-item', msg.role]">
                <el-avatar
                  v-if="msg.role === 'user' && fullAvatarUrl"
                  class="message-avatar"
                  :size="40"
                  :src="fullAvatarUrl"
                />
                <el-avatar v-else-if="msg.role === 'user'" class="message-avatar" :size="40" :icon="UserFilled" />
                <el-avatar v-else class="message-avatar assistant-avatar" :size="40" :icon="Cpu" />
                <div class="message-bubble">
                  <template v-if="msg.loading">
                    <div class="loading-placeholder">
                      <el-icon class="is-loading"><Loading /></el-icon>
                      <span>AI 正在思考...</span>
                    </div>
                  </template>
                  <template v-else>
                    <div v-html="formatMessageContent(msg.content)"></div>
                    <el-collapse
                      v-if="msg.role === 'assistant' && hasAnySources(msg)"
                      v-model="activeSourceCollapse"
                      class="sources"
                    >
                      <el-collapse-item v-if="knowledgeBaseSources(msg).length" title="内部知识库" name="kb">
                        <div
                          v-for="(source, index) in knowledgeBaseSources(msg)"
                          :key="'kb-' + index"
                          class="source-item kb"
                        >
                          <div class="source-meta">
                            <el-tag size="small" type="primary" effect="plain">知识库</el-tag>
                            <span class="source-score"
                              >相关度 {{ formatScore(source.similarity ?? source.score) }}%</span
                            >
                            <span v-if="source.similarity != null" class="source-raw-score">
                              原始 {{ formatScore(source.score) }}%
                            </span>
                          </div>
                          <div class="source-file" v-if="sourceFileName(source)" :class="{ clickable: !!source.uploadFileId }">
                            <el-icon><DocumentIcon /></el-icon>
                            <span
                              class="source-file-name"
                              :title="source.uploadFileId ? '点击定位到文档列表中的文件' : undefined"
                              @click="openSourceInDocuments(source)"
                            >
                              {{ sourceFileName(source) }}
                            </span>
                            <el-icon
                              v-if="source.uploadFileId"
                              class="download-icon"
                              title="下载原文件"
                              @click.stop="downloadSourceFile(source)"
                            >
                              <Download />
                            </el-icon>
                          </div>
                          <div class="source-content" v-html="highlightedSourceContent(source, msg)"></div>
                        </div>
                      </el-collapse-item>

                      <el-collapse-item v-if="externalSources(msg).length" title="外部资料" name="ext">
                        <div
                          v-for="(source, index) in externalSources(msg)"
                          :key="'ext-' + index"
                          class="source-item external"
                        >
                          <div class="source-meta">
                            <el-tag size="small" type="warning" effect="plain">外部资料</el-tag>
                            <span class="source-score"
                              >相关度 {{ formatScore(source.similarity ?? source.score) }}%</span
                            >
                          </div>
                          <a
                            class="source-link"
                            v-if="externalSourceUrl(source)"
                            :href="externalSourceUrl(source)"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <el-icon><Collection /></el-icon>
                            <span>{{ externalSourceTitle(source) }}</span>
                          </a>
                          <div class="source-file" v-else>
                            <el-icon><Collection /></el-icon>
                            <span>{{ externalSourceTitle(source) }}</span>
                          </div>
                          <div class="source-content" v-html="highlightedSourceContent(source, msg)"></div>
                        </div>
                      </el-collapse-item>
                    </el-collapse>
                  </template>
                </div>
              </div>
            </div>
          </el-scrollbar>
          <div class="input-area">
            <el-input
              v-model="question"
              type="textarea"
              :rows="2"
              resize="none"
              placeholder="输入你的问题，按 Enter 发送..."
              @keydown.enter.exact.prevent="sendQuestion"
              class="question-input"
            />
            <div class="input-actions">
              <!-- 当前会话正在生成时显示"停止生成"，否则显示发送按钮 -->
              <el-button
                v-if="isCurrentStreaming"
                type="danger"
                circle
                :icon="VideoPause"
                class="stop-btn"
                title="停止生成"
                @click="stopStreaming"
              />
              <el-button
                v-else
                type="primary"
                circle
                :icon="Promotion"
                class="send-btn"
                @click="sendQuestion"
              />
            </div>
          </div>
        </div>
      </el-main>
    </el-container>

    <!-- 更换头像对话框 -->
    <el-dialog
      v-model="avatarDialogVisible"
      title="更换头像"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div class="avatar-uploader">
        <div v-if="avatarPreview" class="avatar-preview">
          <img :src="avatarPreview" alt="头像预览" width="200" height="200" />
        </div>
        <div v-else class="avatar-placeholder">
          <el-icon><UserFilled /></el-icon>
        </div>
        <el-upload
          class="avatar-uploader"
          action="#"
          :show-file-list="false"
          :before-upload="beforeAvatarUpload"
          :http-request="handleAvatarUpload"
        >
          <el-button type="primary" style="margin-top: 20px">选择图片</el-button>
        </el-upload>
        <div class="upload-tip">支持 JPG、PNG、GIF，大小不超过 2MB</div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="avatarDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitAvatar">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 删除确认对话框 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="确认删除"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div>
        <el-icon :size="24" color="#e6a23c" style="vertical-align: middle; margin-right: 8px"><Warning /></el-icon>
        <span>{{ deleteDialogContent }}</span>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="deleteDialogVisible = false">取消</el-button>
          <el-button type="danger" @click="confirmDelete">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 重命名对话框（文档/会话共用，回调区分动作） -->
    <el-dialog
      v-model="renameDialogVisible"
      :title="renameDialogTitle"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-input
        v-model="renameDialogValue"
        placeholder="请输入新名称"
        maxlength="255"
        show-word-limit
        @keydown.enter="confirmRename"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="renameDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmRename">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// 主页逻辑：文档/会话加载、上传与删除、头像更换，以及 SSE 流式问答
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Cpu,
  UserFilled,
  Upload,
  Plus,
  Delete,
  Loading,
  Promotion,
  Document as DocumentIcon,
  Download,
  Collection,
  Warning,
  UploadFilled,
  QuestionFilled,
  FolderOpened,
  View,
  EditPen,
  CopyDocument,
  VideoPause,
} from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';
import { uploadApi } from '@/api/upload';
import { chatApi } from '@/api/chat';
import { authApi } from '@/api/auth';
import type { Conversation, Message, Source } from '@/api/chat';
import type { UploadDocument } from '@/api/upload';

const userStore = useUserStore();
const router = useRouter();

/** 头像相对路径补全为 server 静态资源绝对地址 */
const fullAvatarUrl = computed(() => {
  if (!userStore.userInfo?.avatarUrl) return '';
  return `http://localhost:3000${userStore.userInfo.avatarUrl}`;
});

// 状态
const activeTab = ref<'documents' | 'conversations'>('documents');
const loadingDocuments = ref(false);
const documents = ref<UploadDocument[]>([]);
const conversations = ref<Conversation[]>([]);
const currentConversation = ref<Conversation | null>(null);
const messages = ref<Message[]>([]);
const question = ref('');
/** 正在后台流式生成的会话 id 集合（切换会话/新建对话不中断，任务在后台继续完成） */
const streamingConversationIds = ref<Set<number>>(new Set());
/** 标记某会话是否正在流式生成（Set 需整体替换以触发响应式更新） */
const markStreaming = (id: number, streaming: boolean) => {
  const next = new Set(streamingConversationIds.value);
  if (streaming) {
    next.add(id);
  } else {
    next.delete(id);
  }
  streamingConversationIds.value = next;
};
/** 当前查看的会话是否正在生成中（用于发送按钮 loading，不影响其他会话后台执行） */
const isCurrentStreaming = computed(() =>
  currentConversation.value ? streamingConversationIds.value.has(currentConversation.value.id) : false,
);
/** 各会话正在流式请求的 AbortController（供"停止生成"使用；非响应式，仅运行时读取） */
const streamingControllers = new Map<number, AbortController>();

/** 停止当前会话的生成：中断 fetch，服务端尽力保存已生成内容（不影响其他会话后台任务） */
const stopStreaming = () => {
  if (!currentConversation.value) return;
  const controller = streamingControllers.get(currentConversation.value.id);
  if (controller) {
    controller.abort();
    streamingControllers.delete(currentConversation.value.id);
  }
};
const activeSourceCollapse = ref(['kb', 'ext']);
const avatarDialogVisible = ref(false);
const avatarPreview = ref('');
const deleteDialogVisible = ref(false);
const deleteDialogContent = ref('');
const messageScrollRef = ref(null);
// 重命名弹窗（文档/会话共用）：标题 + 输入值 + 确认回调
const renameDialogVisible = ref(false);
const renameDialogTitle = ref('');
const renameDialogValue = ref('');
const renameConfirmCallback = ref<(() => void) | null>(null);

/** 重要修复：使用 wrapRef 获取滚动容器的 DOM 元素 */
const scrollToBottom = () => {
  nextTick(() => {
    if (messageScrollRef.value?.wrapRef) {
      messageScrollRef.value.wrapRef.scrollTop = messageScrollRef.value.wrapRef.scrollHeight;
    }
  });
};

// 数据加载
const loadDocuments = async () => {
  loadingDocuments.value = true;
  try {
    const res = await uploadApi.listDocuments();
    documents.value = res;
  } catch (error) {
    console.error(error);
    ElMessage.error('加载文档列表失败');
  } finally {
    loadingDocuments.value = false;
  }
};

// 文件夹视图：基于 upload_files.folderName 字段分组——
// folderName 为空 → "文件列表"区；folderName 非空（如 `2026/文档`）按首段归入 "文件夹列表"区，点击内联展开内部文件
/** 已展开的文件夹名集合（点击文件夹行切换展开/收起） */
const expandedFolders = ref<Set<string>>(new Set());

/** 文件列表区：folderName 为空（单文件上传） */
const rootFiles = computed(() => documents.value.filter((doc) => !doc.folderName));

/** 文件夹列表区：folderName 非空，按首段文件夹名分组（组内含该文件夹的所有文件） */
const folderGroups = computed(() => {
  const map = new Map<string, UploadDocument[]>();
  documents.value.forEach((doc) => {
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
  const next = new Set(expandedFolders.value);
  if (next.has(name)) {
    next.delete(name);
  } else {
    next.add(name);
  }
  expandedFolders.value = next;
};

// ---- 删除：文件列表区 / 文件夹列表区（区域级一键删除 + 行级删除） ----

/** 删除文件列表区的全部单文件（确认后并发删除） */
const confirmDeleteAllFiles = () => {
  if (rootFiles.value.length === 0) return;
  deleteDialogContent.value = `确定要删除文件列表中的全部 ${rootFiles.value.length} 个文件吗？删除后无法恢复。`;
  deleteDialogVisible.value = true;
  deleteConfirmCallback.value = () => {
    deleteBulkDocuments(rootFiles.value, '文件列表');
  };
};

/** 删除文件夹列表区的全部文件夹及其内文件（确认后并发删除） */
const confirmDeleteAllFolders = () => {
  const folderFiles = documents.value.filter((doc) => doc.folderName);
  if (folderFiles.length === 0) return;
  deleteDialogContent.value = `确定要删除全部 ${folderGroups.value.length} 个文件夹及其中的 ${folderFiles.length} 个文件吗？删除后无法恢复。`;
  deleteDialogVisible.value = true;
  deleteConfirmCallback.value = () => {
    expandedFolders.value = new Set();
    deleteBulkDocuments(folderFiles, '文件夹列表');
  };
};

/** 删除整个文件夹：确认后并发删除其下所有文件（复用单文件删除接口，逐条清库记录与向量分块） */
const confirmDeleteFolder = (name: string) => {
  const files = documents.value.filter(
    (doc) => doc.folderName === name || doc.folderName?.startsWith(`${name}/`),
  );
  deleteDialogContent.value = `确定要删除文件夹 "${name}" 吗？将同时删除其中的 ${files.length} 个文件，删除后无法恢复。`;
  deleteDialogVisible.value = true;
  deleteConfirmCallback.value = () => {
    deleteFolder(name);
  };
};

const deleteFolder = async (name: string) => {
  const files = documents.value.filter(
    (doc) => doc.folderName === name || doc.folderName?.startsWith(`${name}/`),
  );
  await deleteBulkDocuments(files, `文件夹 "${name}"`);
  const next = new Set(expandedFolders.value);
  next.delete(name);
  expandedFolders.value = next;
};

/** 并发删除一批文档（复用单文件删除接口），刷新列表并汇总提示 */
const deleteBulkDocuments = async (files: UploadDocument[], label: string) => {
  let success = 0;
  let failed = 0;
  await Promise.all(
    files.map(async (doc) => {
      try {
        await uploadApi.deleteDocument(doc.id);
        success += 1;
      } catch (error) {
        console.error(`删除失败: ${doc.originalName}`, error);
        failed += 1;
      }
    }),
  );
  await loadDocuments();
  if (failed > 0) {
    ElMessage.error(`${label}删除完成：成功 ${success} 个，失败 ${failed} 个`);
  } else {
    ElMessage.success(`${label}删除完成（${success} 个文件）`);
  }
};

const loadConversations = async () => {
  try {
    const res = await chatApi.listConversations();
    conversations.value = res;
  } catch (error) {
    console.error(error);
    ElMessage.error('加载对话列表失败');
  }
};

const loadMessages = async () => {
  if (!currentConversation.value) return;
  try {
    const res = await chatApi.listMessages(currentConversation.value.id);
    messages.value = res;
    nextTick(() => scrollToBottom());
  } catch (error) {
    console.error(error);
    ElMessage.error('加载消息失败');
  }
};

// 创建新对话
const createNewConversation = async () => {
  try {
    const res = await chatApi.createConversation();
    conversations.value.unshift(res);
    currentConversation.value = res;
    messages.value = [];
  } catch (error) {
    console.error(error);
    ElMessage.error('创建对话失败');
  }
};

// 选择对话
const selectConversation = (conv: Conversation) => {
  currentConversation.value = conv;
  loadMessages();
};

// 日期格式化
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN');
};

// 上传相关
/** el-upload 前置钩子：前端先做 10MB 大小限制（服务端另有 20MB 白名单校验） */
const beforeUpload = (file: File) => {
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB');
    return false;
  }
  return true;
};

/** 手动上传文档（:auto-upload 走自定义请求），成功后刷新列表（索引在服务端异步进行） */
const handleUpload = async (options: { file: File }) => {
  try {
    await uploadApi.uploadDocument(options.file);
    ElMessage.success('上传成功，正在索引文档');
    loadDocuments();
  } catch (error) {
    console.error(error);
    ElMessage.error('上传失败');
  }
};

// 文件夹上传：递归上传文件夹内白名单文档，保留相对路径（如 `2026/文档/报告.pdf`）以区分重名
/** 支持扩展名白名单（与 server upload.storage.ts 保持一致） */
const ALLOWED_DOC_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.xls',
  '.xlx',
  '.xlsx',
  '.csv',
  '.md',
  '.docx',
  '.doc',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
]);
/** 文件夹上传并发数（避免同时发起过多请求） */
const FOLDER_UPLOAD_CONCURRENCY = 3;

const folderInput = ref<HTMLInputElement | null>(null);
const uploadingFolder = ref(false);

/** 文件夹选择入口：优先用 File System Access API（Chrome/Edge），拿到文件夹名与子路径；不支持则回退 webkitdirectory */
const pickFolder = async () => {
  const picker = (window as unknown as { showDirectoryPicker?: (opts?: { mode?: string }) => Promise<unknown> })
    .showDirectoryPicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker({ mode: 'read' });
      const items: { file: File; folderName: string }[] = [];
      // 递归遍历目录树：folderName = 文件夹名 + 子路径（如 `资料/2026`），不包含文件名
      const walk = async (dirHandle: any, prefix: string) => {
        for await (const [name, entry] of dirHandle.entries()) {
          if (entry.kind === 'directory') {
            await walk(entry, `${prefix}${name}/`);
          } else if (entry.kind === 'file') {
            items.push({ file: await entry.getFile(), folderName: prefix.slice(0, -1) });
          }
        }
      };
      await walk(handle, `${(handle as { name?: string }).name ?? '文件夹'}/`);
      await uploadFolderFiles(items);
    } catch (error) {
      // AbortError = 用户取消选择，不提示
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
        ElMessage.error('读取文件夹失败');
      }
    }
  } else {
    folderInput.value?.click(); // 回退：webkitdirectory 原生 input
  }
};

/** 取文件扩展名（小写含点），与 node:path extname 行为一致（浏览器环境不引入 node 模块） */
const getExtension = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  const slashIndex = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  return dotIndex > slashIndex ? name.slice(dotIndex).toLowerCase() : '';
};

/** 由完整相对路径（`2026/文档/报告.pdf`）算出所属文件夹路径（`2026/文档`）；无路径返回空串 */
const extractFolderName = (relativePath: string) => {
  const slashIndex = Math.max(relativePath.lastIndexOf('/'), relativePath.lastIndexOf('\\'));
  return slashIndex > 0 ? relativePath.slice(0, slashIndex) : '';
};

/**
 * 上传文件夹内所有文件：过滤白名单扩展名 + 10MB 上限，
 * 以独立 folderName 字段（含文件夹名与子路径）逐个复用单文件上传接口
 * （并发 FOLDER_UPLOAD_CONCURRENCY），结束后汇总提示并刷新文档列表（索引在服务端异步进行）。
 */
const uploadFolderFiles = async (items: { file: File; folderName: string }[]) => {
  const valid = items.filter(
    ({ file }) => ALLOWED_DOC_EXTENSIONS.has(getExtension(file.name)) && file.size / 1024 / 1024 < 10,
  );
  const skipped = items.length - valid.length;
  if (valid.length === 0) {
    ElMessage.warning(`文件夹内没有可上传的文档（跳过 ${skipped} 个不支持格式或超 10MB 的文件）`);
    return;
  }

  uploadingFolder.value = true;
  let success = 0;
  let failed = 0;
  const queue = [...valid];
  const worker = async () => {
    while (queue.length > 0) {
      const { file, folderName } = queue.shift()!;
      try {
        await uploadApi.uploadDocument(file, folderName || undefined);
        success += 1;
      } catch (error) {
        console.error(`上传失败: ${folderName}/${file.name}`, error);
        failed += 1;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(FOLDER_UPLOAD_CONCURRENCY, valid.length) }, () => worker()),
  );
  uploadingFolder.value = false;
  loadDocuments();
  ElMessage.success(`文件夹上传完成：成功 ${success} 个，跳过 ${skipped} 个，失败 ${failed} 个`);
};

/** 回退方案（webkitdirectory）：webkitRelativePath 缺失时 folderName 为空（按单文件上传） */
const handleFolderChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = ''; // 清空 value，允许下次重复选择同一文件夹
  await uploadFolderFiles(
    files.map((file) => ({
      file,
      folderName: extractFolderName(file.webkitRelativePath || ''),
    })),
  );
};

// 删除文档
const confirmDeleteDocument = (row: UploadDocument) => {
  deleteDialogContent.value = `确定要删除文档 "${row.originalName}" 吗？删除后无法恢复。`;
  deleteDialogVisible.value = true;
  deleteConfirmCallback.value = () => {
    deleteDocument(row.id);
  };
};

const deleteDocument = async (id: number) => {
  try {
    await uploadApi.deleteDocument(id);
    ElMessage.success('删除成功');
    loadDocuments();
  } catch (error) {
    console.error(error);
    ElMessage.error('删除失败');
  }
};

// ---- 重命名（文档/会话共用一个输入弹窗，回调区分动作） ----

/** 打开文档重命名弹窗（预填旧名） */
const openRenameDocumentDialog = (doc: UploadDocument) => {
  renameDialogTitle.value = '重命名文档';
  renameDialogValue.value = doc.originalName;
  renameConfirmCallback.value = async () => {
    const name = renameDialogValue.value.trim();
    if (!name) {
      ElMessage.warning('文件名不能为空');
      return;
    }
    try {
      await uploadApi.renameDocument(doc.id, name);
      ElMessage.success('重命名成功');
      loadDocuments();
    } catch (error) {
      console.error(error);
      ElMessage.error('重命名失败');
    }
  };
  renameDialogVisible.value = true;
};

/** 打开会话重命名弹窗（预填当前标题） */
const openRenameConversationDialog = (conv: Conversation) => {
  renameDialogTitle.value = '重命名会话';
  renameDialogValue.value = conv.title || '新对话';
  renameConfirmCallback.value = async () => {
    const title = renameDialogValue.value.trim();
    if (!title) {
      ElMessage.warning('会话标题不能为空');
      return;
    }
    try {
      const updated = await chatApi.renameConversation(conv.id, title);
      // 同步更新列表与当前会话的标题
      const index = conversations.value.findIndex((c) => c.id === conv.id);
      if (index >= 0) {
        conversations.value[index] = { ...conversations.value[index], ...updated };
      }
      if (currentConversation.value?.id === conv.id) {
        currentConversation.value = { ...currentConversation.value, ...updated };
      }
      ElMessage.success('已重命名');
    } catch (error) {
      console.error(error);
      ElMessage.error('重命名失败');
    }
  };
  renameDialogVisible.value = true;
};

/** 重命名弹窗确认：关闭弹窗并执行回调 */
const confirmRename = () => {
  const callback = renameConfirmCallback.value;
  renameDialogVisible.value = false;
  renameConfirmCallback.value = null;
  callback?.();
};

// 删除对话
const confirmDeleteConversation = (conv: Conversation) => {
  deleteDialogContent.value = '确定要删除这个对话吗？删除后无法恢复。';
  deleteDialogVisible.value = true;
  deleteConfirmCallback.value = () => {
    deleteConversation(conv.id);
  };
};

const deleteConversation = async (id: number) => {
  try {
    await chatApi.deleteConversation(id);
    ElMessage.success('删除成功');
    conversations.value = conversations.value.filter((c) => c.id !== id);
    if (currentConversation.value?.id === id) {
      currentConversation.value = null;
      messages.value = [];
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('删除失败');
  }
};

/** 一键删除全部会话（确认后并发删除），删除后清空当前会话视图 */
const confirmDeleteAllConversations = () => {
  if (conversations.value.length === 0) return;
  deleteDialogContent.value = `确定要删除全部 ${conversations.value.length} 个会话吗？删除后无法恢复。`;
  deleteDialogVisible.value = true;
  deleteConfirmCallback.value = () => {
    deleteAllConversations();
  };
};

const deleteAllConversations = async () => {
  let success = 0;
  let failed = 0;
  await Promise.all(
    conversations.value.map(async (conv) => {
      try {
        await chatApi.deleteConversation(conv.id);
        success += 1;
      } catch (error) {
        console.error(`删除会话失败: ${conv.id}`, error);
        failed += 1;
      }
    }),
  );
  conversations.value = [];
  currentConversation.value = null;
  messages.value = [];
  if (failed > 0) {
    ElMessage.error(`会话删除完成：成功 ${success} 个，失败 ${failed} 个`);
  } else {
    ElMessage.success(`已删除全部会话（${success} 个）`);
  }
};

// 删除确认弹窗的确认回调（文档/对话共用一个弹窗，用它区分要执行的删除动作）
const deleteConfirmCallback = ref<(() => void) | null>(null);
const confirmDelete = () => {
  if (deleteConfirmCallback.value) {
    deleteConfirmCallback.value();
  }
  deleteDialogVisible.value = false;
};

// 下载知识库原文件
const downloadSourceFile = async (source: any) => {
  if (!source?.uploadFileId) return;
  try {
    await uploadApi.downloadDocument(source.uploadFileId, sourceFileName(source) || `document-${source.uploadFileId}`);
  } catch (error) {
    console.error(error);
  }
};

// 在线预览：浏览器原生可渲染的格式（PDF/图片/TXT/MD）拉取 blob 后新标签页打开
/** 可在线预览的扩展名（Office 文档不支持原生预览） */
const PREVIEWABLE_EXTENSIONS = new Set(['.pdf', '.txt', '.md', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif']);

/** 预览文档：拉取 blob 后 window.open 新标签页（浏览器原生渲染 PDF/图片/文本） */
const previewDocument = async (doc: UploadDocument) => {
  const ext = getExtension(doc.originalName);
  if (!PREVIEWABLE_EXTENSIONS.has(ext)) {
    ElMessage.warning('该格式暂不支持在线预览，请下载查看');
    return;
  }
  try {
    const blob = await uploadApi.fetchDocumentBlob(doc.id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // 延时释放 blob URL，避免新窗口尚未加载完就失效
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    console.error(error);
    ElMessage.error('预览加载失败');
  }
};

// 头像上传
const avatarFile = ref<File | null>(null);
/** 头像选择前置钩子：限制 2MB，并通过 FileReader 生成本地预览（不立即上传） */
const beforeAvatarUpload = (file: File) => {
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    ElMessage.error('头像大小不能超过 2MB');
    return false;
  }
  avatarFile.value = file;
  // 预览
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
  return true;
};

const handleAvatarUpload = (options: { file: File }) => {
  beforeAvatarUpload(options.file);
};

/** 确认更换头像：上传成功后重新拉取资料并刷新 store */
const submitAvatar = async () => {
  if (!avatarFile.value) {
    ElMessage.warning('请先选择一张图片');
    return;
  }
  try {
    const formData = new FormData();
    formData.append('avatar', avatarFile.value);
    await uploadApi.uploadAvatar(formData);
    ElMessage.success('更换头像成功');
    avatarDialogVisible.value = false;
    // 更新 store 中的用户信息
    const profile = await authApi.getProfile();
    userStore.setUserInfo(profile);
  } catch (error) {
    console.error(error);
    ElMessage.error('更换头像失败');
  }
};

/**
 * 发送问题（SSE 流式）：
 * 立即上屏用户消息并插入"AI 思考中"占位；onSources 先渲染来源，onToken 逐段拼接答案。
 * 任务绑定到发送时的会话：期间切换会话/新建对话不会中断后台生成（服务端继续执行并落库），
 * 流式回调只更新"发送时"的消息数组，避免污染当前查看的其他会话；
 * 完成后若仍查看该会话则重新拉取完整消息，若已切走则切回时自动加载到完整回答。
 */
const sendQuestion = async () => {
  if (!currentConversation.value) {
    ElMessage.warning('请先创建或选择对话');
    return;
  }
  const userQuestion = question.value.trim();
  if (!userQuestion) return;

  // 记录发送时的会话与消息数组引用（切换会话后 messages.value 会被替换，回调始终写这个数组）
  const conversationId = currentConversation.value.id;
  const localMessages = messages.value;

  // 用户消息立即显示
  localMessages.push({
    id: Date.now(),
    role: 'user',
    content: userQuestion,
    conversationId,
    createdAt: new Date().toISOString(),
  });
  question.value = '';
  nextTick(() => scrollToBottom());

  markStreaming(conversationId, true);
  // 创建中止控制器："停止生成"按钮可中断本次 fetch（服务端尽力保存已生成内容）
  const controller = new AbortController();
  streamingControllers.set(conversationId, controller);
  // 添加 AI 加载占位
  const aiIndex = localMessages.length;
  localMessages.push({
    id: Date.now() + 1,
    role: 'assistant',
    content: '',
    conversationId,
    createdAt: new Date().toISOString(),
    sources: [],
    loading: true,
  });
  nextTick(() => scrollToBottom());

  /** 当前仍查看的是发送时那个会话（决定 UI 更新/滚动） */
  const isCurrentView = () => currentConversation.value?.id === conversationId;

  try {
    await chatApi.sendMessage(
      conversationId,
      userQuestion,
      {
        // 知识库检索完成：先展示来源
        onSources: (sources: Source[]) => {
          localMessages[aiIndex] = { ...localMessages[aiIndex], sources };
          if (isCurrentView()) nextTick(() => scrollToBottom());
        },
        // 逐 token 追加回答，首个 token 到达即取消"思考中"占位
        onToken: (token: string) => {
          const msg = localMessages[aiIndex];
          localMessages[aiIndex] = {
            ...msg,
            content: msg.content + token,
            loading: false,
          };
          if (isCurrentView()) nextTick(() => scrollToBottom());
        },
      },
      controller.signal,
    );

    // 任务完成：若仍查看该会话，重新拉取服务端最终消息（含完整回答与来源）；
    // 若已切走，切回时 loadMessages 自然拿到完整回答
    if (isCurrentView()) {
      await loadMessages();
      nextTick(() => scrollToBottom());
    }
  } catch (error) {
    console.error(error);
    // 用户主动点"停止生成"：保留已生成内容，不视为失败
    const isUserStopped = error instanceof DOMException && error.name === 'AbortError';
    // 仅当仍在查看该会话时处理占位/回退；已切走则静默（服务端已尽力保存，切回可见）
    if (isCurrentView()) {
      const partial = localMessages[aiIndex]?.content;
      if (isUserStopped) {
        if (partial) {
          localMessages[aiIndex] = { ...localMessages[aiIndex], loading: false };
        } else {
          localMessages.splice(aiIndex, 1);
        }
        ElMessage.info('已停止生成，已保留生成的内容');
      } else if (partial) {
        // 已收到部分回答：保留内容，标记中断
        localMessages[aiIndex] = { ...localMessages[aiIndex], loading: false };
        ElMessage.error('回答中断，已保留已生成的内容');
      } else {
        ElMessage.error(error instanceof Error ? error.message : '发送失败');
        question.value = userQuestion;
        // 移除加载占位
        localMessages.splice(aiIndex, 1);
      }
    }
  } finally {
    markStreaming(conversationId, false);
    streamingControllers.delete(conversationId);
    // 刷新会话列表：让新会话/旧会话的主题标题、更新时间与排序反映本次问答
    loadConversations();
  }
};

// 会话导出：把当前对话拼成 Markdown（复制到剪贴板 / 下载 .md 文件），纯前端实现
/** 当前会话导出为 Markdown 文本 */
const conversationToMarkdown = () => {
  const conv = currentConversation.value;
  if (!conv) return '';
  const lines: string[] = [`# ${conv.title || '新对话'}`, '', `> 导出时间：${new Date().toLocaleString('zh-CN')}`, ''];
  for (const msg of messages.value) {
    if (msg.loading) continue;
    if (msg.role === 'user') {
      lines.push('**用户：**', '', msg.content, '');
    } else {
      lines.push('**AI：**', '', msg.content, '');
    }
  }
  return lines.join('\n');
};

/** 一键复制当前对话（Markdown 格式） */
const copyConversation = async () => {
  const text = conversationToMarkdown();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('对话已复制到剪贴板');
  } catch (error) {
    console.error(error);
    ElMessage.error('复制失败，请手动选择复制');
  }
};

/** 下载当前对话为 Markdown 文件 */
const downloadConversation = () => {
  const text = conversationToMarkdown();
  if (!text) return;
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(currentConversation.value?.title || '对话').replace(/[\\/:*?"<>|]/g, '_')}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** 顶部用户下拉命令：打开换头像弹窗 或 登出回登录页 */
const handleCommand = (command: string) => {
  if (command === 'uploadAvatar') {
    avatarDialogVisible.value = true;
    avatarPreview.value = fullAvatarUrl.value || '';
  } else if (command === 'logout') {
    userStore.logout();
    window.location.href = '/login';
  }
};

// 来源处理工具函数
// 与 ai-service 的 MIN_SCORE 保持一致：低于该相关度的知识库片段不在页面展示
const KB_MIN_SCORE = 0.3;

/** 是否为模型外部资料：无 uploadFileId 即不是知识库片段（兼容旧数据） */
const isExternalSource = (source: any) => {
  return !source?.uploadFileId;
};

/** 取一条消息中可展示的知识库来源：非外部且相关度达标，按相关度从大到小排序（similarity 优先，缺省用 score） */
const knowledgeBaseSources = (msg: any) => {
  const list = Array.isArray(msg?.sources) ? msg.sources : [];
  return list
    .filter((source: any) => !isExternalSource(source) && (source?.score ?? 1) >= KB_MIN_SCORE)
    .sort((a: any, b: any) => (b.similarity ?? b.score) - (a.similarity ?? a.score));
};

/** 取一条消息中的外部资料列表 */
const externalSources = (msg: any) => {
  const list = Array.isArray(msg?.sources) ? msg.sources : [];
  return list.filter((source: any) => isExternalSource(source));
};

/** 是否存在任意一类可展示来源（控制折叠面板显隐） */
const hasAnySources = (msg: any) => knowledgeBaseSources(msg).length > 0 || externalSources(msg).length > 0;

/** 知识库来源的原始文件名 */
const sourceFileName = (source: any) => {
  return source?.metadata?.originalName || source?.originalName || '';
};

/** 来源定位高亮：文档列表中临时高亮的文件 id */
const highlightedDocumentId = ref<number | null>(null);

/**
 * 点击来源文件：定位到左侧"我的文档"中的对应文件——
 * 切到文档管理 tab、展开文件所在文件夹、高亮并滚动到该文件（找不到时提示）。
 */
const openSourceInDocuments = async (source: any) => {
  const uploadFileId = source?.uploadFileId;
  if (!uploadFileId) return;

  let doc = documents.value.find((d) => d.id === uploadFileId);
  if (!doc) {
    // 文档列表可能尚未加载（如刚进页面未切过 tab），先拉取一次
    await loadDocuments();
    doc = documents.value.find((d) => d.id === uploadFileId);
  }
  if (!doc) {
    ElMessage.warning('该文件已不在文档列表中（可能已被删除）');
    return;
  }

  activeTab.value = 'documents';
  // 展开文件所在的顶层文件夹（folderName 如 `2026/文档` → 展开 `2026`）
  if (doc.folderName) {
    const folder = doc.folderName.split('/')[0];
    if (!expandedFolders.value.has(folder)) {
      const next = new Set(expandedFolders.value);
      next.add(folder);
      expandedFolders.value = next;
    }
  }
  // 高亮并平滑滚动到该文件行
  highlightedDocumentId.value = doc.id;
  nextTick(() => {
    document.getElementById(`doc-item-${doc.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
};

/** 外部资料展示标题（缺省“外部资料”） */
const externalSourceTitle = (source: any) => {
  return source?.metadata?.title || source?.title || '外部资料';
};

// 新增：提取外部资料的跳转链接
// 提取外部资料的跳转链接：优先真实URL，没有则用标题搜索
const externalSourceUrl = (source: any) => {
  const url = source?.metadata?.url || source?.url || source?.metadata?.link || '';
  if (url) return url;

  // 没有URL时，用标题作为关键词拼接百度搜索链接，保证标题可点击
  const title = source?.metadata?.title || source?.title || '';
  if (title) {
    return `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`;
  }
  return '';
};

/** 取来源正文（兼容 LangChain 的 pageContent 字段） */
const sourceContent = (source: any) => {
  return source?.content || source?.pageContent || '';
};

// 来源片段关键词高亮（纯前端）：先 HTML 转义防注入，再对用户提问中的关键词加 <mark> 高亮
/** HTML 转义，防止文档原文注入（高亮前必须先转义） */
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** 正则特殊字符转义（关键词可能含正则元字符） */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 从当前消息往前找最近一条用户提问，提取高亮关键词：连续中文片段/英文单词（长度>=2，去重取前 5 个） */
const extractKeywords = (msg: any) => {
  const index = messages.value.indexOf(msg);
  if (index <= 0) return [];
  for (let i = index - 1; i >= 0; i--) {
    const prev = messages.value[i];
    if (prev.role === 'user') {
      const words = prev.content.match(/[\u4e00-\u9fff]+|[a-zA-Z0-9_]+/g) ?? [];
      return Array.from(new Set(words.filter((w) => w.length >= 2))).slice(0, 5);
    }
  }
  return [];
};

/** 来源片段内容 + 关键词高亮（返回 HTML，配合 v-html 使用） */
const highlightedSourceContent = (source: any, msg: any) => {
  const text = sourceContent(source);
  if (!text) return '';
  const keywords = extractKeywords(msg);
  let html = escapeHtml(text);
  for (const keyword of keywords) {
    const escaped = escapeRegExp(escapeHtml(keyword));
    if (escaped) {
      html = html.replace(new RegExp(escaped, 'gi'), (match) => `<mark>${match}</mark>`);
    }
  }
  return html;
};

/** 相关度 0~1 转百分比文本，如 0.832 -> “83.2” */
const formatScore = (score: number) => {
  return (score * 100).toFixed(1);
};

/** 消息正文渲染：换行转 <br>（配合 v-html，正文为模型输出的纯文本） */
const formatMessageContent = (content: string) => {
  return content.replace(/\n/g, '<br>');
};

onMounted(() => {
  loadDocuments();
  loadConversations();
});
</script>

<style scoped>
.home-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.header .title {
  font-size: 20px;
  font-weight: bold;
  color: #000;
}

.header .user-info {
  display: flex;
  align-items: center;
}

/* 头像 + 用户名整体作为下拉触发区 */
.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  font-size: 14px;
  color: #333;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
}

.main-container {
  flex: 1;
  overflow: hidden;
}

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

/* 隐藏的原生文件夹选择 input（由“上传文件夹”按钮触发） */
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

/* 聊天区工具栏：会话标题 + 右侧操作按钮 */
.chat-toolbar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #ebeef5;
}

.chat-toolbar-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 320px;
}

.chat-toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
}

/* 来源片段关键词高亮 */
.source-content mark {
  background-color: #fef08a;
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.chat-section {
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
  background-color: #fff;
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* 让气泡适应文字宽度 */
.message-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  max-width: 80%;
  width: fit-content;
}

.message-item.user {
  flex-direction: row-reverse;
  margin-left: auto;
}

.message-item.assistant {
  margin-right: auto;
}

.message-avatar {
  flex-shrink: 0;
}

.assistant-avatar {
  background: linear-gradient(135deg, #409eff, #7c5cff);
}

.message-bubble {
  min-width: 0;
  padding: 12px 16px;
  border-radius: 8px;
  word-break: break-word;
}

.message-item.user .message-bubble {
  background-color: #409eff;
  color: #fff;
}

.message-item.assistant .message-bubble {
  background-color: #f5f5f5;
  color: #303133;
}

.sources {
  margin-top: 12px;
  border-top: 1px solid #e4e7ed;
  padding-top: 12px;
}

.source-item {
  margin-bottom: 12px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid #409eff;
}

.source-item.external {
  border-left-color: #e6a23c;
  background: #fdf6ec;
}

.source-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.source-score {
  font-size: 12px;
  color: #909399;
}

.source-raw-score {
  font-size: 12px;
  color: #c0c4cc;
}

.source-file {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  word-break: break-all;
}
.source-file span {
  color: #409eff;
}

.source-file.clickable {
  cursor: pointer;
  width: fit-content;
  max-width: 100%;
}

.source-file.clickable:hover {
  text-decoration: underline;
  color: #337ecc;
}

/* 来源文件名：点击定位到文档列表 */
.source-file-name {
  cursor: pointer;
}

.source-file .download-icon {
  cursor: pointer;
  color: #909399;
  flex-shrink: 0;
}

.source-file .download-icon:hover {
  color: #409eff;
}

/* 来源定位到文档列表后的高亮行 */
.document-item.highlighted-doc {
  border-color: #409eff;
  background-color: #ecf5ff;
}

/* 外部资料链接样式 */
.source-link {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: #409eff;
  text-decoration: underline; /* 添加下划线，提示用户可点击 */
  cursor: pointer;
  word-break: break-all;
}

.source-link:hover {
  text-decoration: underline;
  color: #337ecc;
}

.source-content {
  font-size: 13px;
  color: #333;
  line-height: 1.5;
}

.input-area {
  border-top: 1px solid #e4e7ed;
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.question-input {
  flex: 1;
}

.input-area :deep(.el-textarea__inner) {
  min-height: 60px !important;
}

.send-btn {
  flex: 0 0 auto;
  width: 60px;
  height: 60px;
}
.send-btn :deep(.el-icon) {
  font-size: 24px;
}

/* 停止生成按钮：与发送按钮同尺寸，生成中替代发送按钮显示 */
.input-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.stop-btn {
  width: 60px;
  height: 60px;
}
.stop-btn :deep(.el-icon) {
  font-size: 24px;
}

.loading-placeholder {
  display: flex;
  align-items: center;
  color: #909399;
  font-size: 14px;
  padding: 8px 0;
}

.empty-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}

.avatar-uploader {
  text-align: center;
}

.avatar-preview {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 50%;
  margin: 0 auto;
}

.avatar-placeholder {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 30px;
  margin: 0 auto;
}

.upload-tip {
  margin-top: 16px;
  font-size: 12px;
  color: #909399;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
<style>
.el-collapse-item__title {
  padding-left: 8px;
}
</style>
