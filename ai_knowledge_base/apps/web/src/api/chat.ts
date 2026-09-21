/**
 * 聊天相关接口与会话/消息类型定义。
 * 会话与消息的普通 CRUD 走全局 axios；发送消息使用原生 fetch 读取 SSE 流（见 sendMessage）。
 */
import request from './request';
import { useUserStore } from '../stores/user';
import type { AnswerStats, RetrievedChunk } from '@ai-knowledge-base/shared';

const API_BASE = 'http://localhost:3000';

export interface Conversation {
  id: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  /** 会话主题描述（服务端按首条用户消息前 20 字生成；空会话为"新对话"） */
  title?: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[] | null;
  /** 用户对 AI 回答的反馈：like / dislike，未评价为 null */
  feedback?: 'like' | 'dislike' | null;
  createdAt: string;
  /** 仅前端使用：AI 思考中占位 */
  loading?: boolean;
  /** 仅前端使用：本次回答的性能指标/追问建议/缓存标记（临时展示，非服务端持久化字段） */
  meta?: { stats?: AnswerStats; suggestions?: string[]; cached?: boolean };
}

// 跨端共享类型：定义见 packages/shared（来源片段契约），前端保留旧名避免改动页面代码
export type Source = RetrievedChunk;

export interface StreamDoneResult {
  answer: string;
  sources: Source[];
  message: Message | null;
  /** 语义缓存命中：true 表示回答直接复用同类问题缓存（未重新调用模型） */
  cached?: boolean;
  /** 回答性能指标（检索/生成耗时） */
  stats?: AnswerStats;
  /** 相关追问建议 */
  suggestions?: string[];
}

export interface StreamHandlers {
  onSources?: (sources: Source[]) => void;
  onToken?: (token: string) => void;
}

export const chatApi = {
  createConversation() {
    return request.post<Conversation>('/chat/conversations');
  },

  listConversations() {
    return request.get<Conversation[]>('/chat/conversations');
  },

  deleteConversation(id: number) {
    return request.delete(`/chat/conversations/${id}`);
  },

  /** 手动重命名会话标题 */
  renameConversation(id: number, title: string) {
    return request.patch<Conversation>(`/chat/conversations/${id}`, { title });
  },

  listMessages(id: number) {
    return request.get<Message[]>(`/chat/conversations/${id}/messages`);
  },

  /** 设置消息反馈（点赞/点踩/取消）：再次点击同一项即取消 */
  setMessageFeedback(messageId: number, feedback: 'like' | 'dislike' | null) {
    return request.patch<Message>(`/chat/messages/${messageId}/feedback`, { feedback });
  },

  /**
   * 流式发送消息：服务端以 SSE 返回 sources/token/done/error 事件。
   * 不设置固定超时（模型边生成边推送，只要持续有 token 即视为正常）。
   */
  async sendMessage(
    id: number,
    content: string,
    handlers: StreamHandlers = {},
    signal?: AbortSignal,
  ): Promise<StreamDoneResult> {
    const userStore = useUserStore();
    const response = await fetch(`${API_BASE}/chat/conversations/${id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}),
      },
      body: JSON.stringify({ content }),
      signal,
    });

    if (!response.ok || !response.body) {
      // 尽量解析 Nest 的错误响应
      let message = `请求失败（${response.status}）`;
      try {
        const errorBody = (await response.json()) as { message?: string | string[] };
        if (errorBody?.message) {
          message = Array.isArray(errorBody.message) ? errorBody.message.join('；') : errorBody.message;
        }
      } catch {
        // 忽略 JSON 解析失败
      }
      if (response.status === 401) {
        userStore.logout();
        window.location.href = '/login';
      }
      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    let sources: Source[] = [];

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        let event = 'message';
        const dataLines: string[] = [];
        for (const line of rawFrame.split('\n')) {
          if (line.startsWith('event:')) {
            event = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
        if (dataLines.length === 0) continue;

        let data: unknown;
        try {
          data = JSON.parse(dataLines.join('\n'));
        } catch {
          data = dataLines.join('\n');
        }

        if (event === 'sources') {
          sources = Array.isArray(data) ? (data as Source[]) : [];
          handlers.onSources?.(sources);
        } else if (event === 'token') {
          const token = typeof data === 'string' ? data : '';
          if (token) {
            answer += token;
            handlers.onToken?.(token);
          }
        } else if (event === 'done') {
          const result = data as Partial<StreamDoneResult>;
          if (typeof result.answer === 'string' && result.answer) {
            answer = result.answer;
          }
          if (Array.isArray(result.sources)) {
            sources = result.sources;
          }
          return {
            answer,
            sources,
            message: result.message ?? null,
            cached: result.cached === true,
            stats: result.stats,
            suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
          };
        } else if (event === 'error') {
          const message =
            data && typeof data === 'object' && 'message' in data
              ? String((data as { message: unknown }).message)
              : 'AI 服务异常';
          throw new Error(message);
        }
      }
    }

    // 服务端正常结束但未收到 done（不应发生）：返回累积内容
    return { answer, sources, message: null };
  },
};
