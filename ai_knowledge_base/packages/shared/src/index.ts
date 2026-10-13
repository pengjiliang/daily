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

/** 单文档索引状态：pending 排队中 / running 索引中 / done 成功 / failed 失败 / skipped 跳过 */
export type IndexStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** 索引失败原因分类（供前端提示） */
export type IndexErrorKind =
  | 'unsupported_format'
  | 'empty_content'
  | 'embedding_failed'
  | 'document_deleted'
  | 'unknown';

/** 单文档索引状态视图（文档列表返回项中的索引信息） */
export interface IndexStatusView {
  status: IndexStatus;
  /** 成功索引的分块数 */
  chunkCount: number | null;
  /** 索引完成时间 */
  indexedAt: string | null;
  /** 索引失败原因（仅 failed/skipped 有值） */
  indexError: string | null;
  /** 失败原因分类（仅 failed/skipped 有值） */
  errorKind: IndexErrorKind | null;
  /** 已尝试次数 */
  indexAttempts: number;
  /** 索引所用向量模型（done 后有值） */
  embeddingModel: string | null;
  /** 向量维度（done 后有值） */
  embeddingDim: number | null;
}

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
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
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

// ==================== RAG 评估（亮点 3）====================

/** 评估问题集：一组有标准答案的评测问题（用户私有） */
export interface EvalSet {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  createdAt: string;
  /** 该问题集包含的用例数（列表聚合） */
  caseCount?: number;
}

/** 单条评估用例：问题 + 期望命中的文档 / 关键片段关键词 / 期望答案要点 */
export interface EvalCase {
  id: number;
  evalSetId: number;
  question: string;
  /** 期望命中的文档 id（检索 kept 中应出现该文件） */
  expectedFileId: number | null;
  /** 期望命中的关键片段关键词（引用片段内容应包含其中至少一个） */
  expectedKeywords: string[];
  /** 期望答案要点（备注用） */
  note: string | null;
}

/** 一次评估运行的参数快照（用于 A/B 对比不同检索参数） */
export interface EvalRunConfig {
  topK: number;
  keywordTopK: number;
  minScore: number;
  rerankTopN: number;
}

/** 一次评估运行：运行参数快照 + 聚合指标（RAG 回归看板核心数据） */
export interface EvalRun {
  id: number;
  evalSetId: number;
  config: EvalRunConfig;
  caseCount: number;
  /** 期望文档进 kept 的用例占比（0~1） */
  recallAtK: number;
  /** 平均倒数排名（期望文档在 kept 中的名次倒数，未命中记 0） */
  mrr: number;
  /** 空答率：检索 kept 为空的用例占比（0~1） */
  emptyRate: number;
  /** 引用准确率：kept 片段内容命中任一期望关键词的用例占比（0~1） */
  citationAccuracy: number;
  /** 平均检索耗时（秒） */
  avgRetrieveSec: number;
  /** 平均生成耗时（秒） */
  avgAnswerSec: number;
  createdAt: string;
}

/** 单条用例的评估结果（逐题明细） */
export interface EvalCaseResult {
  caseId: number;
  question: string;
  expectedFileId: number | null;
  expectedKeywords: string[];
  /** 期望文档是否进入 kept */
  hitExpectedFile: boolean;
  /** 期望文档在 kept 中的名次（1 起，未命中为 null） */
  expectedFileRank: number | null;
  /** 该题对 MRR 的贡献（1/rank 或 0） */
  mrrContribution: number;
  /** 是否空答（kept 为空） */
  empty: boolean;
  /** 引用是否命中任一期望关键词 */
  citationHit: boolean;
  /** 检索耗时（秒） */
  retrieveSec: number;
  /** 生成耗时（秒） */
  answerSec: number;
  /** 本次检索 kept 片段（供逐题排查） */
  kept: (RetrieveLegItem & { similarity: number })[];
}

/** 评估运行 + 逐题明细（POST run / GET run 详情返回） */
export interface EvalRunView {
  run: EvalRun;
  results: EvalCaseResult[];
}

/** 同一问题集的两套检索参数 A/B 对比结果。 */
export interface EvalComparisonView {
  a: EvalRunView;
  b: EvalRunView;
}

// ==================== 成本与用量看板（亮点 5）====================

/** 用量事件类型：对应问答链路各模型调用点 */
export type UsageKind =
  | 'contextualize'
  | 'rewrite'
  | 'rerank'
  | 'answer'
  | 'external'
  | 'suggestions'
  | 'embedding'
  | 'extraction'
  | 'connection_test'
  | 'cache_hit';

/** 单条用量事件（ai_usage_events 表） */
export interface UsageEvent {
  id: number;
  userId: number;
  conversationId: number | null;
  messageId: number | null;
  provider: string;
  model: string;
  kind: UsageKind;
  promptTokens: number;
  completionTokens: number;
  /** 调用耗时 ms */
  latencyMs: number;
  /** 是否缓存命中（kind=cache_hit 时为 true） */
  cached: boolean;
  usageSource: 'provider' | 'unavailable' | 'legacy_estimate';
  costUsd: number | null;
  createdAt: string;
}

/** 按天聚合的用量点（趋势图） */
export interface UsageDailyPoint {
  date: string;
  promptTokens: number;
  completionTokens: number;
  calls: number;
  costUsd: number;
}

/** 成本与用量看板聚合载荷 */
export interface UsageDashboard {
  /** 时间范围内总 token 与调用数 */
  total: { promptTokens: number; completionTokens: number; calls: number; cacheHits: number };
  /** 缓存命中率（0~1） */
  cacheHitRate: number;
  costUsd: number;
  unpricedCalls: number;
  unmeteredCalls: number;
  dailyQuota: { limit: number; used: number };
  monthlyQuota: { limit: number; used: number };
  estimatedCalls: number;
  /** 按天趋势 */
  daily: UsageDailyPoint[];
  /** 按类型（kind）聚合 */
  byKind: { kind: UsageKind | string; calls: number; promptTokens: number; completionTokens: number; costUsd: number }[];
  /** 按模型聚合 */
  byModel: { model: string; calls: number; promptTokens: number; completionTokens: number; costUsd: number }[];
}

// ==================== 反馈闭环（亮点 4）====================

/** 点踩原因（前端弹窗选项） */
export type FeedbackReason =
  | 'irrelevant_sources'
  | 'incomplete_answer'
  | 'kb_not_used'
  | 'off_topic'
  | 'other';

/** 反馈看板聚合载荷（热门点踩问题 Top10 + 按文档统计点踩引用） */
export interface FeedbackDashboard {
  /** 热门点踩问题（按正文聚合） */
  topDislikedQuestions: { content: string; count: number }[];
  /** 按文档统计的点踩引用来源（sources 中 uploadFileId 聚合） */
  topDislikedSources: { uploadFileId: number; originalName: string; count: number }[];
  /** 点踩原因分布 */
  reasonBreakdown: { reason: FeedbackReason | string; count: number }[];
}

