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
        <div class="message-list" @click="onMessageClick">
          <div
            v-for="msg in chatStore.messages"
            :key="msg.id"
            :data-msg-id="msg.id"
            :class="['message-item', msg.role]"
          >
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
                <div v-html="formatMessageContent(msg.content, msg)"></div>
                <el-collapse
                  v-if="msg.role === 'assistant' && hasAnySources(msg)"
                  v-model="activeSourceCollapse"
                  class="sources"
                >
                  <el-collapse-item v-if="knowledgeBaseSources(msg).length" title="内部知识库" name="kb">
                    <div
                      v-for="(source, index) in knowledgeBaseSources(msg)"
                      :key="'kb-' + index"
                      :id="'source-item-' + msg.id + '-' + (index + 1)"
                      class="source-item kb"
                    >
                      <div class="source-meta">
                        <!-- 来源编号徽标：与正文引用角标一一对应，点击回到正文对应引用处 -->
                        <span
                          class="source-cite-tag"
                          :title="'来源 ' + (index + 1) + '（点击定位到正文引用）'"
                          @click="highlightCitation(msg, index + 1)"
                          >[{{ index + 1 }}]</span
                        >
                        <el-tag size="small" type="primary" effect="plain">知识库</el-tag>
                        <span class="source-score">相关度 {{ formatScore(source.similarity ?? source.score) }}%</span>
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
                        <span class="source-score">相关度 {{ formatScore(source.similarity ?? source.score) }}%</span>
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
                <!-- 消息反馈：点赞/点踩，再次点击同一项取消（仅 AI 回答显示） -->
                <div v-if="msg.role === 'assistant'" class="message-feedback">
                  <el-tooltip :content="msg.feedback === 'like' ? '取消赞同' : '回答有帮助'" placement="top">
                    <el-button
                      text
                      size="small"
                      :class="['feedback-btn', { active: msg.feedback === 'like' }]"
                      @click="setFeedback(msg, 'like')"
                    >
                      👍
                    </el-button>
                  </el-tooltip>
                  <el-tooltip :content="msg.feedback === 'dislike' ? '取消反对' : '回答无帮助'" placement="top">
                    <el-button
                      text
                      size="small"
                      :class="['feedback-btn', { active: msg.feedback === 'dislike' }]"
                      @click="setFeedback(msg, 'dislike')"
                    >
                      👎
                    </el-button>
                  </el-tooltip>
                </div>
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
          <el-button v-else type="primary" circle :icon="Promotion" class="send-btn" @click="sendQuestion" />
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
    const result = await chatApi.sendMessage(
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

    // 语义缓存命中：直接提示"已从缓存返回"（不重新调用模型）
    if (result.cached) {
      ElMessage.info('已从缓存返回同类问题的回答');
    }

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
    await uploadApi.downloadDocument(source.uploadFileId, sourceFileName(source) || `document-${source.uploadFileId}`);
  } catch (error) {
    console.error(error);
  }
};

/** 设置消息反馈：点赞/点踩，再次点击同一项取消（乐观更新，失败回滚） */
const setFeedback = async (msg: any, feedback: 'like' | 'dislike') => {
  if (msg.loading || typeof msg.id !== 'number') {
    return;
  }
  const next = msg.feedback === feedback ? null : feedback;
  const previous = msg.feedback;
  msg.feedback = next;
  try {
    const updated = await chatApi.setMessageFeedback(msg.id, next);
    msg.feedback = updated.feedback ?? null;
  } catch (error) {
    console.error(error);
    msg.feedback = previous;
    ElMessage.error('反馈保存失败');
  }
};

// 来源处理工具函数
// 注意：前端保持 ai-service 下发 kbSources 的原始顺序——该顺序即模型输出
// [知识库1]、[知识库2]… 引用的编号顺序（重排与相关度校准已在后端完成），
// 前端不再按相似度重排，确保角标编号 ↔ 来源项一一对应。

/** 是否为模型外部资料：无 uploadFileId 即不是知识库片段（兼容旧数据） */
const isExternalSource = (source: any) => {
  return !source?.uploadFileId;
};

/** 取一条消息中的知识库来源（保持后端编号顺序，与回答中的 [知识库N] 引用对齐） */
const knowledgeBaseSources = (msg: any) => {
  const list = Array.isArray(msg?.sources) ? msg.sources : [];
  return list.filter((source: any) => !isExternalSource(source));
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

/** 外部资料跳转地址：优先真实 URL（兼容 metadata.link），无 URL 时用标题拼百度搜索链接，保证标题可点击 */
const externalSourceUrl = (source: any) => {
  const url = source?.metadata?.url || source?.url || source?.metadata?.link || '';
  if (url) return url;

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

/**
 * 消息正文渲染：HTML 转义 → 换行转 <br> → [知识库N] 引用标记渲染为可点击角标。
 * 角标携带 data-cite（模型编号），点击由 onMessageClick 委托定位到对应来源项。
 */
const formatMessageContent = (content: string, msg: any) => {
  const kbCount = knowledgeBaseSources(msg).length;
  let html = escapeHtml(content);
  html = html.replace(/\[知识库(\d+)\]/g, (match, n: string) => {
    const index = Number.parseInt(n, 10);
    // 仅当编号落在该消息可展示的来源范围内才渲染为角标，否则保留原文（如 [知识库] 无编号）
    if (index >= 1 && index <= kbCount) {
      return `<span class="cite-badge" id="cite-badge-${msg.id}-${index}" data-cite="${index}" title="查看对应来源">[${index}]</span>`;
    }
    return match;
  });
  return html.replace(/\n/g, '<br>');
};

/** 消息区点击委托：命中引用角标时，定位到对应消息中的来源项并闪烁高亮 */
const onMessageClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const badge = target.closest('.cite-badge') as HTMLElement | null;
  if (!badge) return;
  const item = target.closest('.message-item') as HTMLElement | null;
  if (!item) return;
  const msgId = Number(item.dataset.msgId);
  const msg = chatStore.messages.find((m) => m.id === msgId);
  const cite = Number(badge.dataset.cite);
  if (!msg || !Number.isInteger(cite)) return;
  scrollToCitation(msg, cite);
};

/** 定位到消息中第 cite 号来源项：展开内部知识库折叠面板、滚动居中并闪烁高亮 */
const scrollToCitation = (msg: any, cite: number) => {
  const count = knowledgeBaseSources(msg).length;
  if (cite < 1 || cite > count) return;
  if (!activeSourceCollapse.value.includes('kb')) {
    activeSourceCollapse.value = [...activeSourceCollapse.value, 'kb'];
  }
  nextTick(() => {
    const el = document.getElementById(`source-item-${msg.id}-${cite}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('cite-flash');
    setTimeout(() => el.classList.remove('cite-flash'), 2000);
  });
};

/** 点击来源编号徽标：定位到正文中对应引用角标并闪烁高亮（与角标→来源形成双向联动） */
const highlightCitation = (msg: any, cite: number) => {
  const el = document.getElementById(`cite-badge-${msg.id}-${cite}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('cite-badge-flash');
  setTimeout(() => el.classList.remove('cite-badge-flash'), 2000);
};
</script>

<style scoped>
.chat-section {
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
  background-color: var(--kb-bg-card);
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
  border-bottom: 1px solid var(--kb-border-light);
}

.chat-toolbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--kb-text-primary);
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
  background-color: var(--kb-bubble-ai);
  color: var(--kb-text-primary);
}

.sources {
  margin-top: 12px;
  border-top: 1px solid var(--kb-border);
  padding-top: 12px;
}

/* 消息反馈按钮：默认半透明，选中时高亮主色 */
.message-feedback {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 8px;
}

.message-feedback .feedback-btn {
  font-size: 14px;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 6px;
  opacity: 0.45;
}

.message-feedback .feedback-btn:hover {
  opacity: 1;
}

.message-feedback .feedback-btn.active {
  opacity: 1;
  background-color: var(--el-color-primary-light-9);
}

.source-item {
  margin-bottom: 12px;
  padding: 10px;
  background: var(--kb-source-bg);
  border-radius: 6px;
  border-left: 3px solid var(--el-color-primary);
}

.source-item.external {
  border-left-color: var(--el-color-warning);
  background: var(--kb-source-external-bg);
}

.source-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.source-score {
  font-size: 12px;
  color: var(--kb-text-secondary);
}

.source-raw-score {
  font-size: 12px;
  color: var(--kb-text-placeholder);
}

.source-file {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  word-break: break-all;
}
.source-file span {
  color: var(--el-color-primary);
}

.source-file.clickable {
  cursor: pointer;
  width: fit-content;
  max-width: 100%;
}

.source-file.clickable:hover {
  text-decoration: underline;
  color: var(--el-color-primary-dark-2);
}

/* 来源文件名：点击定位到文档列表 */
.source-file-name {
  cursor: pointer;
}

.source-file .download-icon {
  cursor: pointer;
  color: var(--kb-text-secondary);
  flex-shrink: 0;
}

.source-file .download-icon:hover {
  color: var(--el-color-primary);
}

/* 外部资料链接样式 */
.source-link {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: var(--el-color-primary);
  text-decoration: underline; /* 添加下划线，提示用户可点击 */
  cursor: pointer;
  word-break: break-all;
}

.source-link:hover {
  text-decoration: underline;
  color: var(--el-color-primary-dark-2);
}

.source-content {
  font-size: 13px;
  color: var(--kb-text-primary);
  line-height: 1.5;
}

/* 来源片段关键词高亮 */
.source-content mark {
  background-color: var(--kb-mark-bg);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

/* 折叠面板标题内边距（原 Home 全局样式，随折叠面板迁入本组件） */
.sources :deep(.el-collapse-item__title) {
  padding-left: 8px;
}

/* 来源项编号徽标：与正文引用角标一一对应，浅色样式区分主次，点击可回到正文引用处 */
.source-cite-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-5);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.15s,
    color 0.15s,
    transform 0.15s;
}

.source-cite-tag:hover {
  background-color: var(--el-color-primary);
  color: #fff;
  transform: scale(1.1);
}

/* 引用定位高亮：来源项闪烁提示 */
.source-item.cite-flash {
  animation: cite-flash 0.6s ease 3;
  border-color: var(--el-color-primary);
}

@keyframes cite-flash {
  0%,
  100% {
    background-color: inherit;
  }
  50% {
    background-color: var(--el-color-primary-light-8);
  }
}

.input-area {
  border-top: 1px solid var(--kb-border);
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
  color: var(--kb-text-secondary);
  font-size: 14px;
  padding: 8px 0;
}

.empty-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--kb-text-secondary);
  font-size: 14px;
}
</style>

<style>
/* 回答正文引用角标 [N]：做成"链接式可点击"——主色数字 + 下划线 + 虚线描边 + 手型光标，
   一眼就能看出可以点击（点击定位到对应来源）；悬停填充主色并放大进一步强化反馈 */
.cite-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  margin: 0 3px;
  border-radius: 10px;
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px dashed var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  text-decoration: underline;
  text-underline-offset: 3px;
  vertical-align: baseline;
  transition:
    background-color 0.15s,
    color 0.15s,
    transform 0.15s,
    box-shadow 0.15s;
}

.cite-badge:hover {
  background-color: var(--el-color-primary);
  color: #fff;
  text-decoration: none;
  transform: scale(1.12);
  box-shadow: 0 3px 8px rgba(64, 158, 255, 0.45);
}

.cite-badge:active {
  transform: scale(0.95);
}

/* 正文引用角标闪烁提示（点击来源编号徽标触发） */
.cite-badge.cite-badge-flash {
  animation: cite-flash 0.6s ease 3;
  outline: 2px solid var(--el-color-warning);
  outline-offset: 1px;
}
</style>
