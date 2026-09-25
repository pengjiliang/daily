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
  /** 语义缓存命中标记：true 表示本次回答直接复用同类问题的缓存（未重新调用模型） */
  cached?: boolean;
  /** 回答性能指标（缓存命中时检索/生成耗时为 0） */
  stats?: AnswerStats;
  /** 相关追问建议（2~3 条，生成失败或缓存命中时为空数组） */
  suggestions?: string[];
  /** 图谱问答命中实体关系三元组条数（未开启图谱增强或未命中时为 0） */
  graphHitCount?: number;
}

/** 回答性能指标：问答各阶段耗时（毫秒） */
export interface AnswerStats {
  /** 知识库检索耗时 ms */
  retrieveMs: number;
  /** 模型生成回答耗时 ms */
  answerMs: number;
  /** 总耗时 ms */
  totalMs: number;
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

/** 实体级知识图谱节点：一个知识实体（人物/组织/概念等），由文档索引后的 LLM 抽取 */
export interface EntityGraphNode {
  id: number;
  /** 实体名（如"张三""研发部"） */
  name: string;
  /** 实体类型：人物/组织/地点/概念/项目/产品/事件/其他 */
  entityType: string;
  /** 抽取自哪个上传文档（可在文档管理中定位） */
  uploadFileId: number | null;
  /** 来源文档名（便于回溯实体出处） */
  fileName?: string | null;
}

/** 实体级知识图谱连线：两个实体间的一条具体关系 */
export interface EntityGraphRelation {
  id: number;
  source: number;
  target: number;
  /** 关系描述（如"任职于""参与""位于"） */
  relation: string;
}

/** 实体级知识图谱载荷 */
export interface EntityGraphData {
  entities: EntityGraphNode[];
  relations: EntityGraphRelation[];
}

/** 检索调试：单路召回的片段条目（向量路为 cosine 相似度，关键词路为 trigram 相似度，0~1） */
export interface RetrieveLegItem {
  chunkId: number;
  uploadFileId: number;
  /** 片段内容预览 */
  content: string;
  /** 相似度/分数 */
  score: number;
}

/** 检索调试：关键词字面路（每路对应一个查询词） */
export interface RetrieveKeywordLeg {
  term: string;
  items: RetrieveLegItem[];
}

/**
 * 单问题检索调试结果：只跑检索、不生成回答，展示完整检索链路（供 RAG 调试/评估面板）。
 * 链路：查询改写 → 向量语义路 + 关键词字面路多路召回 → RRF 融合 → LLM 重排保留。
 */
export interface RetrieveDebugView {
  question: string;
  /** 多轮记忆增强后的查询（无历史时为原问题） */
  contextualized: string;
  /** 短查询改写后的查询 */
  rewritten: string;
  /** 向量语义路召回（cosine 相似度降序） */
  vectorLeg: RetrieveLegItem[];
  /** 关键词字面路召回（trigram 相似度降序，每路一个查询词） */
  keywordLegs: RetrieveKeywordLeg[];
  /** RRF 融合结果（按融合分降序，含 rrf 融合分） */
  fused: (RetrieveLegItem & { rrf: number })[];
  /** LLM 重排后最终保留（用于回答，similarity 为校准后的真实相似度） */
  kept: (RetrieveLegItem & { similarity: number })[];
}
