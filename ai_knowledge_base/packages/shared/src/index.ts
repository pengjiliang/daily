/**
 * AI 知识库跨端共享类型与契约。
 * 仅供 `import type` 使用（纯类型包，无运行时代码），
 * 供 apps/server、apps/ai-service、apps/web 三方共用，避免类型重复定义。
 */

/** 引用来源类型：内部知识库向量片段 / 模型补充的外部资料 */
export type SourceType = 'knowledge_base' | 'external';

/** RAG 检索命中的引用片段（知识库向量检索或模型补充的外部资料） */
export interface RetrievedChunk {
  sourceType: SourceType;
  chunkId: number | null;
  uploadFileId: number | null;
  content: string;
  /** 原始 Embedding 相似度（0~1），区间窄、数值低，用于排序与过滤 */
  score: number;
  /** 按本次检索最强匹配归一化后的真实相似度（0~1），更直观，用于页面展示 */
  similarity: number;
  metadata: Record<string, unknown>;
}

/** 传给 AI 服务的对话历史消息最小契约 */
export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 问答结果契约：答案 + 引用来源 */
export interface AskResult {
  answer: string;
  sources: RetrievedChunk[];
}
