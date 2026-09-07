import request from './request'

export interface Conversation {
  id: number
  userId: number
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: number
  conversationId: number
  role: 'user' | 'assistant'
  content: string
  sources?: Source[] | null
  createdAt: string
}

export interface Source {
  sourceType?: 'knowledge_base' | 'external'
  chunkId?: number | null
  uploadFileId?: number | null
  content: string
  score: number
  metadata?: Record<string, unknown>
  pageContent?: string
  originalName?: string
}

export interface SendMessageResult {
  answer: string
  sources: Source[]
  message: Message
}

export const chatApi = {
  createConversation() {
    return request.post<Conversation>('/chat/conversations')
  },

  listConversations() {
    return request.get<Conversation[]>('/chat/conversations')
  },

  deleteConversation(id: number) {
    return request.delete(`/chat/conversations/${id}`)
  },

  listMessages(id: number) {
    return request.get<Message[]>(`/chat/conversations/${id}/messages`)
  },

  sendMessage(id: number, content: string) {
    return request.post<SendMessageResult>(`/chat/conversations/${id}/messages`, { content })
  },
}