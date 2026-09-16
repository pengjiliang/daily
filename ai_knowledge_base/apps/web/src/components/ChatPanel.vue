<!--
  右侧聊天区（右）：会话工具栏（标题重命名、复制/下载对话）、SSE 流式消息流
  （先出来源、再逐 token 出答案，来源含知识库/外部两类：排序展示、关键词高亮、点击定位到文档）、
  输入区（发送/停止生成，生成中可随时中断且不影响其他会话后台任务）。
  共享状态来自 useChatStore；流式发送与来源展示逻辑内聚在本组件。
-->
<template>
  <el-main class="chat-section">
    <div v-if="!chatStore.currentConversation" class="empty-placeholder">
      <span>请选择或新建对话开始聊天</span>
    </div>
    <div class="messages-container" v-if="chatStore.currentConversation">
      <!-- 会话工具栏：标题（可重命名）+ 复制/下载当前对话 -->
      <div class="chat-toolbar">
        <span class="chat-toolbar-title">{{ chatStore.currentConversation.title || '新对话' }}</span>
        <el-tooltip content="重命名当前会话" placement="bottom">
          <el-button
            text
            size="small"
            :icon="EditPen"
            style="margin-left: 4px"
            @click="chatStore.openRenameConversationDialog(chatStore.currentConversation)"
          />
        </el-tooltip>
        <div class="chat-toolbar-actions">
          <el-button
            text
            size="small"
            :icon="CopyDocument"
            :disabled="chatStore.messages.length === 0"
            @click="copyConversation"
          >
            复制对话
          </el-button>
          <el-button
            text
            size="small"
            :icon="Download"
            :disabled="chatStore.messages.length === 0"
            @click="downloadConversation"
          >
            下载对话
          </el-button>
        </div>
      </div>
      <el-scrollbar ref="messageScrollRef">
        <div class="message-list">
          <div v-for="msg in chatStore.messages" :key="msg.id" :class="['message-item', msg.role]">
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
                      <div
                        class="source-file"
                        v-if="sourceFileName(source)"
                        :class="{ clickable: !!source.uploadFileId }"
                      >
                        <el-icon><DocumentIcon /></el-icon>
                        <span
                          class="source-file-name"
                          :title="source.uploadFileId ? '点击定位到文档列表中的文件' : undefined"
                          @click="chatStore.openSourceInDocuments(source)"
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
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Collection,
  CopyDocument,
  Cpu,
  Document as DocumentIcon,
  Download,
  EditPen,
  Loading,
  Promotion,
  UserFilled,
  VideoPause,
} from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';
import { useChatStore } from '@/stores/chat';
import { chatApi } from '@/api/chat';
import { uploadApi } from '@/api/upload';
import type { Source } from '@/api/chat';

const userStore = useUserStore();
const chatStore = useChatStore();

/** 头像相对路径补全为 server 静态资源绝对地址 */
const fullAvatarUrl = computed(() => {
  if (!userStore.userInfo?.avatarUrl) return '';
  return `http://localhost:3000${userStore.userInfo.avatarUrl}`;
});

// ---- 输入与流式状态（组件私有） ----
const question = ref('');
const activeSourceCollapse = ref(['kb', 'ext']);
/** el-scrollbar 实例（wrapRef 为内部滚动容器 DOM） */
const messageScrollRef = ref<{ wrapRef?: HTMLElement } | null>(null);
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
/** 当前查看的会话是否正在生成中（发送按钮切换为"停止生成"） */
const isCurrentStreaming = computed(() =>
  chatStore.currentConversation ? streamingConversationIds.value.has(chatStore.currentConversation.id) : false,
);
/** 各会话正在流式请求的 AbortController（供"停止生成"使用；非响应式，仅运行时读取） */
const streamingControllers = new Map<number, AbortController>();

/** 滚动聊天区到底部 */
const scrollToBottom = () => {
  nextTick(() => {
    if (messageScrollRef.value?.wrapRef) {
      messageScrollRef.value.wrapRef.scrollTop = messageScrollRef.value.wrapRef.scrollHeight;
    }
  });
};

// 切换会话/加载消息后滚动到底部
watch(
  () => chatStore.messages,
  () => scrollToBottom(),
);

/** 停止当前会话的生成：中断 fetch，服务端尽力保存已生成内容（不影响其他会话后台任务） */
const stopStreaming = () => {
  if (!chatStore.currentConversation) return;
  const controller = streamingControllers.get(chatStore.currentConversation.id);
  if (controller) {
    controller.abort();
    streamingControllers.delete(chatStore.currentConversation.id);
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
  if (!chatStore.currentConversation) {
    ElMessage.warning('请先创建或选择对话');
    return;
  }
  const userQuestion = question.value.trim();
  if (!userQuestion) return;

  // 记录发送时的会话与消息数组引用（切换会话后 messages.value 会被替换，回调始终写这个数组）
  const conversationId = chatStore.currentConversation.id;
  const localMessages = chatStore.messages;

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
  const isCurrentView = () => chatStore.currentConversation?.id === conversationId;

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
      await chatStore.loadMessages();
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
    chatStore.loadConversations();
  }
};

// 会话导出：把当前对话拼成 Markdown（复制到剪贴板 / 下载 .md 文件），纯前端实现
/** 当前会话导出为 Markdown 文本 */
const conversationToMarkdown = () => {
  const conv = chatStore.currentConversation;
  if (!conv) return '';
  const lines: string[] = [`# ${conv.title || '新对话'}`, '', `> 导出时间：${new Date().toLocaleString('zh-CN')}`, ''];
  for (const msg of chatStore.messages) {
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
  link.download = `${(chatStore.currentConversation?.title || '对话').replace(/[\\/:*?"<>|]/g, '_')}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// 下载知识库原文件
const downloadSourceFile = async (source: any) => {
  if (!source?.uploadFileId) return;
  try {
    await uploadApi.downloadDocument(
      source.uploadFileId,
      sourceFileName(source) || `document-${source.uploadFileId}`,
    );
  } catch (error) {
    console.error(error);
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

/** 外部资料展示标题（缺省"外部资料"） */
const externalSourceTitle = (source: any) => {
  return source?.metadata?.title || source?.title || '外部资料';
};

/** 外部资料跳转地址（缺省空串不渲染链接） */
const externalSourceUrl = (source: any) => {
  return source?.metadata?.url || source?.url || '';
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
  const index = chatStore.messages.indexOf(msg);
  if (index <= 0) return [];
  for (let i = index - 1; i >= 0; i--) {
    const prev = chatStore.messages[i];
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

/** 相关度 0~1 转百分比文本，如 0.832 -> "83.2" */
const formatScore = (score: number) => {
  return (score * 100).toFixed(1);
};

/** 消息正文渲染：换行转 <br>（配合 v-html，正文为模型输出的纯文本） */
const formatMessageContent = (content: string) => {
  return content.replace(/\n/g, '<br>');
};
</script>

<style scoped>
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

/* 来源片段关键词高亮 */
.source-content mark {
  background-color: #fef08a;
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

/* 折叠面板标题内边距（原 Home 全局样式，随折叠面板迁入本组件） */
.sources :deep(.el-collapse-item__title) {
  padding-left: 8px;
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
</style>
