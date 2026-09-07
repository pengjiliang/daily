<template>
  <div class="home-container">
    <!-- 顶部导航栏 -->
    <el-header class="header">
      <div class="title">AI 知识库</div>
      <div class="user-info">
        <el-dropdown @command="handleCommand">
          <div class="avatar-wrapper">
            <el-avatar v-if="userStore.userInfo?.avatarUrl" :src="fullAvatarUrl" size="large" />
            <el-avatar v-else :size="large" :icon="UserFilled" />
            <div class="avatar-overlay">
              <Upload />
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
        <el-tabs v-model="activeTab" type="border-card" class="sidebar-tabs">
          <el-tab-pane label="文档管理" name="documents">
            <div class="tab-content">
              
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
                  <el-tooltip content="支持 PDF、Word(.docx)、Excel(.xlsx/.xls)、CSV、Markdown、TXT、JPG/PNG/GIF 图片(OCR)，单个文件不超过 10MB" placement="top">
                    <el-icon class="question-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
              </div>

              <!-- 我的文档（美化表格样式，删除按钮改灰色文字图标） -->
              <div class="file-list-section">
                <div class="section-title">我的文档</div>
                <el-table :data="documents" v-loading="loadingDocuments" class="custom-table" :header-cell-style="{ background: '#f5f7fa', color: '#606266' }" style="width: 100%">
                  <el-table-column prop="originalName" label="文件名" show-overflow-tooltip />
                  <el-table-column label="操作" width="50" align="center">
                    <template #default="{ row }">
                      <el-tooltip content="删除" placement="top">
                        <el-button :icon="Delete" text size="small" style="color: #909399" @click="confirmDeleteDocument(row)" />
                      </el-tooltip>
                    </template>
                  </el-table-column>
                </el-table>
              </div>

            </div>
          </el-tab-pane>

          <el-tab-pane label="会话列表" name="conversations">
            <div class="tab-content conversation-list-wrapper">
              
              <!-- 新建对话按钮居中显示 -->
              <div class="new-conv-btn-wrapper">
                <el-button type="primary" :icon="Plus" @click="createNewConversation">新建对话</el-button>
              </div>
              
              <el-scrollbar>
                <div
                  v-for="conv in conversations"
                  :key="conv.id"
                  :class="['conversation-item-sidebar', { active: currentConversation?.id === conv.id }]"
                  @click="selectConversation(conv)"
                >
                  <div class="conv-info-sidebar">
                    <span class="conv-time">{{ formatDate(conv.updatedAt) }}</span>
                  </div>
                  <!-- 会话列表删除按钮：改灰色文字图标 -->
                  <el-tooltip content="删除该对话" placement="top">
                    <el-button :icon="Delete" text size="small" style="color: #909399" @click.stop="confirmDeleteConversation(conv)" />
                  </el-tooltip>
                </div>
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
          <el-scrollbar ref="messageScrollRef">
            <div class="message-list">
              <div v-for="msg in messages" :key="msg.id" :class="['message-item', msg.role]">
                <div class="message-content">
                  <template v-if="msg.loading">
                    <div class="loading-placeholder">
                      <el-icon class="is-loading"><Loading /></el-icon>
                      <span>AI 正在思考...</span>
                    </div>
                  </template>
                  <template v-else>
                    <div v-html="formatMessageContent(msg.content)"></div>
                    <el-collapse v-if="msg.role === 'assistant' && hasAnySources(msg)" v-model="activeSourceCollapse" class="sources">
                      <el-collapse-item v-if="knowledgeBaseSources(msg).length" title="内部知识库" name="kb">
                        <div v-for="(source, index) in knowledgeBaseSources(msg)" :key="'kb-' + index" class="source-item kb">
                          <div class="source-meta">
                            <el-tag size="small" type="primary" effect="plain">知识库</el-tag>
                            <span class="source-score">相似度 {{ formatScore(source.score) }}%</span>
                          </div>
                          <div class="source-file" v-if="sourceFileName(source)" :class="{ clickable: !!source.uploadFileId }" :title="source.uploadFileId ? '点击下载原文件' : undefined" @click="downloadSourceFile(source)">
                            <el-icon><DocumentIcon /></el-icon>
                            <span>{{ sourceFileName(source) }}</span>
                            <el-icon v-if="source.uploadFileId" class="download-icon"><Download /></el-icon>
                          </div>
                          <div class="source-content">{{ sourceContent(source) }}</div>
                        </div>
                      </el-collapse-item>

                      <el-collapse-item v-if="externalSources(msg).length" title="外部资料" name="ext">
                        <div v-for="(source, index) in externalSources(msg)" :key="'ext-' + index" class="source-item external">
                          <div class="source-meta">
                            <el-tag size="small" type="warning" effect="plain">外部资料</el-tag>
                            <span class="source-score">相关度 {{ formatScore(source.score) }}%</span>
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
                          <div class="source-content">{{ sourceContent(source) }}</div>
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
            <el-button type="primary" circle :icon="Promotion" :loading="sending" class="send-btn" @click="sendQuestion" />
          </div>
        </div>
      </el-main>
    </el-container>

    <!-- 更换头像对话框 -->
    <el-dialog v-model="avatarDialogVisible" title="更换头像" width="400px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
      <div class="avatar-uploader">
        <div v-if="avatarPreview" class="avatar-preview">
          <img :src="avatarPreview" alt="头像预览" width="200" height="200" />
        </div>
        <div v-else class="avatar-placeholder">
          <el-icon><UserFilled /></el-icon>
        </div>
        <el-upload class="avatar-uploader" action="#" :show-file-list="false" :before-upload="beforeAvatarUpload" :http-request="handleAvatarUpload">
          <el-button type="primary" style="margin-top: 20px;">选择图片</el-button>
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
    <el-dialog v-model="deleteDialogVisible" title="确认删除" width="400px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
      <div>
        <el-icon :size="24" color="#e6a23c" style="vertical-align: middle; margin-right: 8px;"><Warning /></el-icon>
        <span>{{ deleteDialogContent }}</span>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="deleteDialogVisible = false">取消</el-button>
          <el-button type="danger" @click="confirmDelete">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
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
  QuestionFilled
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { uploadApi } from '@/api/upload'
import { chatApi } from '@/api/chat'
import { authApi } from '@/api/auth'
import type { Conversation, Message } from '@/api/chat'
import type { UploadDocument } from '@/api/upload'

const userStore = useUserStore()
const router = useRouter()

const fullAvatarUrl = computed(() => {
  if (!userStore.userInfo?.avatarUrl) return ''
  return `http://localhost:3000${userStore.userInfo.avatarUrl}`
})

// 状态
const activeTab = ref<'documents' | 'conversations'>('conversations')
const loadingDocuments = ref(false)
const documents = ref<UploadDocument[]>([])
const conversations = ref<Conversation[]>([])
const currentConversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const question = ref('')
const sending = ref(false)
const activeSourceCollapse = ref(['kb', 'ext'])
const avatarDialogVisible = ref(false)
const avatarPreview = ref('')
const deleteDialogVisible = ref(false)
const deleteDialogContent = ref('')
const messageScrollRef = ref(null)

/** 重要修复：使用 wrapRef 获取滚动容器的 DOM 元素 */
const scrollToBottom = () => {
  nextTick(() => {
    if (messageScrollRef.value?.wrapRef) {
      messageScrollRef.value.wrapRef.scrollTop = messageScrollRef.value.wrapRef.scrollHeight
    }
  })
}

// 数据加载
const loadDocuments = async () => {
  loadingDocuments.value = true
  try {
    const res = await uploadApi.listDocuments()
    documents.value = res
  } catch (error) {
    console.error(error)
    ElMessage.error('加载文档列表失败')
  } finally {
    loadingDocuments.value = false
  }
}

const loadConversations = async () => {
  try {
    const res = await chatApi.listConversations()
    conversations.value = res
  } catch (error) {
    console.error(error)
    ElMessage.error('加载对话列表失败')
  }
}

const loadMessages = async () => {
  if (!currentConversation.value) return
  try {
    const res = await chatApi.listMessages(currentConversation.value.id)
    messages.value = res
    nextTick(() => scrollToBottom())
  } catch (error) {
    console.error(error)
    ElMessage.error('加载消息失败')
  }
}

// 创建新对话
const createNewConversation = async () => {
  try {
    const res = await chatApi.createConversation()
    conversations.value.unshift(res)
    currentConversation.value = res
    messages.value = []
  } catch (error) {
    console.error(error)
    ElMessage.error('创建对话失败')
  }
}

// 选择对话
const selectConversation = (conv: Conversation) => {
  currentConversation.value = conv
  loadMessages()
}

// 日期格式化
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

// 上传相关
const beforeUpload = (file: File) => {
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB')
    return false
  }
  return true
}

const handleUpload = async (options: { file: File }) => {
  try {
    await uploadApi.uploadDocument(options.file)
    ElMessage.success('上传成功，正在索引文档')
    loadDocuments()
  } catch (error) {
    console.error(error)
    ElMessage.error('上传失败')
  }
}

// 删除文档
const confirmDeleteDocument = (row: UploadDocument) => {
  deleteDialogContent.value = `确定要删除文档 "${row.originalName}" 吗？删除后无法恢复。`
  deleteDialogVisible.value = true
  deleteConfirmCallback.value = () => {
    deleteDocument(row.id)
  }
}

const deleteDocument = async (id: number) => {
  try {
    await uploadApi.deleteDocument(id)
    ElMessage.success('删除成功')
    loadDocuments()
  } catch (error) {
    console.error(error)
    ElMessage.error('删除失败')
  }
}

// 删除对话
const confirmDeleteConversation = (conv: Conversation) => {
  deleteDialogContent.value = '确定要删除这个对话吗？删除后无法恢复。'
  deleteDialogVisible.value = true
  deleteConfirmCallback.value = () => {
    deleteConversation(conv.id)
  }
}

const deleteConversation = async (id: number) => {
  try {
    await chatApi.deleteConversation(id)
    ElMessage.success('删除成功')
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (currentConversation.value?.id === id) {
      currentConversation.value = null
      messages.value = []
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('删除失败')
  }
}

const deleteConfirmCallback = ref<(() => void) | null>(null)
const confirmDelete = () => {
  if (deleteConfirmCallback.value) {
    deleteConfirmCallback.value()
  }
  deleteDialogVisible.value = false
}

// 下载知识库原文件
const downloadSourceFile = async (source: any) => {
  if (!source?.uploadFileId) return
  try {
    await uploadApi.downloadDocument(
      source.uploadFileId,
      sourceFileName(source) || `document-${source.uploadFileId}`,
    )
  } catch (error) {
    console.error(error)
  }
}

// 头像上传
const avatarFile = ref<File | null>(null)
const beforeAvatarUpload = (file: File) => {
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isLt2M) {
    ElMessage.error('头像大小不能超过 2MB')
    return false
  }
  avatarFile.value = file
  // 预览
  const reader = new FileReader()
  reader.onload = (e) => {
    avatarPreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
  return true
}

const handleAvatarUpload = (options: { file: File }) => {
  beforeAvatarUpload(options.file)
}

const submitAvatar = async () => {
  if (!avatarFile.value) {
    ElMessage.warning('请先选择一张图片')
    return
  }
  try {
    const formData = new FormData()
    formData.append('avatar', avatarFile.value)
    await authApi.updateAvatar(formData)
    ElMessage.success('更换头像成功')
    avatarDialogVisible.value = false
    // 更新 store 中的用户信息
    const profile = await authApi.getProfile()
    userStore.setUserInfo(profile)
  } catch (error) {
    console.error(error)
    ElMessage.error('更换头像失败')
  }
}

// 发送消息
const sendQuestion = async () => {
  if (!currentConversation.value) {
    ElMessage.warning('请先创建或选择对话')
    return
  }
  const userQuestion = question.value.trim()
  if (!userQuestion) return

  // 用户消息立即显示
  messages.value.push({
    id: Date.now(),
    role: 'user',
    content: userQuestion,
    conversationId: currentConversation.value.id,
    createdAt: new Date().toISOString(),
  })
  question.value = ''
  nextTick(() => scrollToBottom())

  sending.value = true
  // 添加 AI 加载占位
  const aiLoadingIndex = messages.value.length
  messages.value.push({
    id: Date.now() + 1,
    role: 'assistant',
    content: '',
    conversationId: currentConversation.value.id,
    createdAt: new Date().toISOString(),
    loading: true,
  })
  nextTick(() => scrollToBottom())

  try {
    const res = await chatApi.sendMessage(currentConversation.value.id, userQuestion)
    // 替换加载占位
    messages.value[aiLoadingIndex] = {
      ...res.message,
      sources: res.message.sources ?? res.sources ?? [],
    }
    nextTick(() => scrollToBottom())
  } catch (error) {
    console.error(error)
    ElMessage.error('发送失败')
    question.value = userQuestion
    // 移除加载占位
    messages.value.splice(aiLoadingIndex, 1)
  } finally {
    sending.value = false
  }
}

const handleCommand = (command: string) => {
  if (command === 'uploadAvatar') {
    avatarDialogVisible.value = true
    avatarPreview.value = fullAvatarUrl.value || ''
  } else if (command === 'logout') {
    userStore.logout()
    window.location.href = '/login'
  }
}

// 来源处理工具函数
const isExternalSource = (source: any) => {
  // 兼容旧数据：有 uploadFileId 视为知识库
  return !source?.uploadFileId
}

const knowledgeBaseSources = (msg: any) => {
  const list = Array.isArray(msg?.sources) ? msg.sources : []
  return list.filter((source: any) => !isExternalSource(source))
}

const externalSources = (msg: any) => {
  const list = Array.isArray(msg?.sources) ? msg.sources : []
  return list.filter((source: any) => isExternalSource(source))
}

const hasAnySources = (msg: any) =>
  knowledgeBaseSources(msg).length > 0 || externalSources(msg).length > 0

const sourceFileName = (source: any) => {
  return source?.metadata?.originalName || source?.originalName || ''
}

const externalSourceTitle = (source: any) => {
  return source?.metadata?.title || source?.title || '外部资料'
}

// 新增：提取外部资料的跳转链接
// 提取外部资料的跳转链接：优先真实URL，没有则用标题搜索
const externalSourceUrl = (source: any) => {
  const url = source?.metadata?.url || source?.url || source?.metadata?.link || ''
  if (url) return url

  // 没有URL时，用标题作为关键词拼接百度搜索链接，保证标题可点击
  const title = source?.metadata?.title || source?.title || ''
  if (title) {
    return `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`
  }
  return ''
}

const sourceContent = (source: any) => {
  return source?.content || source?.pageContent || ''
}

const formatScore = (score: number) => {
  return (score * 100).toFixed(1)
}

const formatMessageContent = (content: string) => {
  return content.replace(/\n/g, '<br>')
}

onMounted(() => {
  loadDocuments()
  loadConversations()
})
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
}

.header .user-info {
  display: flex;
  align-items: center;
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

/* Tab 居中样式 */
.sidebar-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.sidebar-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.sidebar-tabs :deep(.el-tabs__nav) {
  width: 100%;
  display: flex;
  justify-content: center;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
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

.question-icon {
  font-size: 16px;
  color: #909399;
  cursor: help;
}

/* 文档表格美化 */
.file-list-section {
  margin-top: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 12px;
}

/* 表格样式优化 */
.custom-table {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #ebeef5;
}

.custom-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.custom-table :deep(.el-table__row:hover) {
  background-color: #f5f7fa !important;
}

.custom-table :deep(.el-button) {
  margin: 0;
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
}

.conv-info-sidebar .conv-time {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

.chat-section {
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
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
  margin-bottom: 16px;
  max-width: 80%;
  width: fit-content;
  word-break: break-word;
}

.message-item.user {
  margin-left: auto;
  background-color: #409eff;
  color: #fff;
  padding: 12px 16px;
  border-radius: 8px;
}

.message-item.assistant {
  margin-right: auto;
  background-color: #f5f5f5;
  padding: 12px 16px;
  border-radius: 8px;
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
  height: 60px;
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