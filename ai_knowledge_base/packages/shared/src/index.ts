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

/** 对话模型协议：OpenAI 兼容（含火山方舟/豆包等网关）或 Anthropic 原生协议 */
export type ChatProvider = 'openai' | 'anthropic';

/** 文档索引重建状态：idle 空闲 / pending 待重建 / running 重建中 / done 完成 / failed 失败 */
export type ReindexStatus = 'idle' | 'pending' | 'running' | 'done' | 'failed';

/** 重建进度：按用户全部文档逐文件重索引的计数与当前文件名 */
export interface ReindexProgress {
  total: number;
  done: number;
  failed: number;
  currentFile?: string;
}

/** 单个模型配置组的回显视图：密钥只回显是否已配置，不回显明文 */
export interface ProviderConfigView {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
}

/** 设置页 GET /settings 的完整回显载荷 */
export interface AiSettingsView {
  chatProvider: ChatProvider;
  openai: ProviderConfigView;
  anthropic: ProviderConfigView;
  embedding: ProviderConfigView;
  temperature: number;
  topK: number;
  keywordTopK: number;
  minScore: number;
  rerankTopN: number;
  reindex: {
    status: ReindexStatus;
    progress: ReindexProgress | null;
  };
}

/** 统计总览 KPI */
export interface StatsOverview {
  documentCount: number;
  conversationCount: number;
  questionCount: number;
  answerCount: number;
  /** 命中内部知识库的 AI 回答数 */
  kbHitCount: number;
  /** 知识库命中率（0~1） */
  hitRate: number;
}

/** 每日问答趋势点 */
export interface StatsTrendPoint {
  date: string;
  count: number;
}

/** 热门问题 TopN */
export interface StatsPopularQuestion {
  content: string;
  count: number;
}

/** 统计页一次性聚合载荷 */
export interface StatsPayload {
  overview: StatsOverview;
  trend: StatsTrendPoint[];
  popularQuestions: StatsPopularQuestion[];
}

/** 知识图谱节点：一个上传文档 */
export interface GraphNode {
  id: number;
  name: string;
  chunkCount: number;
  createdAt: string;
}

/** 知识图谱连线：两文档平均向量相似度达阈值 */
export interface GraphEdge {
  source: number;
  target: number;
  weight: number;
}

/** 知识图谱载荷 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
