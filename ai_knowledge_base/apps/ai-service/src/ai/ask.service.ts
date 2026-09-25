/**
 * 问答核心服务（RAG）。
 * 检索：短碎片查询先经 LLM 改写，再走「向量语义路 + pg_trgm 关键词字面路」多路召回，
 *      RRF 融合、按文件去重后由 LLM 重排，最终校准为展示用相关度。
 * 生成：流式链路 askStream 并行产出答案 token 流与外部资料 JSON，并剔除与知识库重复的伪外部资料；
 *      旧链路 ask 经 LangGraph 一次性返回 JSON。
 * 所有模型调用均按 userId 解析：对话/向量模型配置与检索参数（topK/minScore 等）
 * 取自该用户在设置页保存的配置，未配置时回退 .env 默认值。
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import { SemanticCache } from '../entities/semantic-cache.entity.js';
import { createRagGraph, type GenerateResult, type RagState, type RetrievedChunk } from './langgraph/rag.graph.js';
import type { AskResult, RetrieveDebugView, RetrieveLegItem, RetrieveKeywordLeg } from '@ai-knowledge-base/shared';
import { ModelProvider, type ChatMessage } from './openai-model.provider.js';
import { UserSettingsService } from '../settings/user-settings.service.js';
import type { HistoryMessage } from './dto/ai.dto.js';

/** 向量检索候选数默认值（重排前）；用户未配置时回退该值 */
export const TOP_K = 8;
/** 关键词（字面）检索候选数默认值：pg_trgm 子串匹配，与向量路一起进 RRF 融合 */
export const KEYWORD_TOP_K = 8;
/** 绝对阈值默认值：仅用于向量路——相似度低于该值的片段视为噪声丢弃；关键词路不做分数过滤（字面命中即候选） */
export const MIN_SCORE = 0.3;
/** 重排后最多保留片段数默认值 */
export const RERANK_TOP_N = 5;
/** RRF（Reciprocal Rank Fusion）融合常数，业界常用值 */
export const RRF_K = 60;
/** 短查询改写阈值：查询字符数不超过该值（如人名碎片“彭”“彭基”“基良”）时，先由 LLM 扩展为完整查询再检索 */
export const QUERY_REWRITE_THRESHOLD = 4;

/**
 * 相关度校准：把本次检索保留的片段按最强匹配归一化，映射为直观的“真实相似度”（0~1）。
 * 经过 LLM 重排保留下来的片段均视为“相关”，最强匹配固定显示 90%，
 * 其余按与最强匹配的差距平滑缩放（相对过滤已保证 ratio >= 0.7，最低约 50%），
 * 避免 Embedding 原始相似度区间窄导致“原始分只差一点、相关度却差很多”。
 */
export function relativeSimilarity(rawScore: number, bestScore: number): number {
  if (bestScore <= 0) {
    return 0;
  }
  const ratio = rawScore / bestScore;
  const value = 0.5 + (0.4 * (ratio - 0.7)) / 0.3;
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}

/** 有知识库命中时，补充的外部资料最多条数 */
export const EXTERNAL_WITH_KB = 3;
/** 无知识库命中、完全依赖模型自身知识时，外部资料最多条数 */
export const EXTERNAL_WITHOUT_KB = 5;
/** 外部资料与知识库片段的 bigram 覆盖率达到该阈值时，视为对知识库内容的复述，予以剔除 */
export const EXTERNAL_DEDUP_OVERLAP = 0.4;
/** 语义缓存命中阈值：问题向量余弦相似度达到该值即视为同一类问题，直接复用上次回答 */
export const CACHE_HIT_THRESHOLD = 0.95;
/** 每用户缓存条数上限：超出时删除最旧缓存 */
export const CACHE_LIMIT = 200;

/** 图谱问答（GraphRAG）：问题 + 已检索片段参与实体匹配的文本长度上限 */
export const GRAPH_MATCH_TEXT_LIMIT = 6000;
/** 图谱问答：最多候选实体数 */
export const GRAPH_ENTITY_LIMIT = 30;
/** 图谱问答：最多注入回答的关系三元组条数 */
export const GRAPH_TRIPLE_LIMIT = 20;

export interface AskRequest {
  question: string;
  /** 当前登录用户 id：检索按用户隔离（只查询该用户上传的文档分块） */
  userId: number;
  conversationId?: string;
  history?: HistoryMessage[];
  /** 是否启用图谱问答增强：检索后额外从实体图谱取相关关系注入回答上下文（默认开启） */
  graphEnabled?: boolean;
}

// 跨端共享类型：定义见 packages/shared
export type { AskResult };

interface SimilarityRow {
  id: number;
  uploadFileId: number;
  content: string;
  metadata: Record<string, unknown>;
  distance: string;
}

/** 混合检索的融合候选：score 优先取向量路 cosine 相似度，其次取关键词路 trigram 相似度（仅用于展示与归一化） */
interface FusionCandidate {
  chunkId: number;
  uploadFileId: number;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  rrf: number;
}

/** 一路召回的带排名结果（rank 从 0 开始，best first），供 RRF 融合 */
interface FusionLeg {
  name: string;
  items: { rank: number; chunk: FusionCandidate }[];
}

/** 检索链路调试信息：debugRetrieve 通过 retrieve 的 trace 参数收集各阶段结果，供 RAG 调试面板展示 */
export interface RetrieveTrace {
  contextualized: string;
  rewritten: string;
  vectorLeg: RetrieveLegItem[];
  keywordLegs: RetrieveKeywordLeg[];
  fused: (RetrieveLegItem & { rrf: number })[];
  kept: (RetrieveLegItem & { similarity: number })[];
}

interface ExternalKnowledgeItem {
  title?: string;
  content?: string;
  score?: number;
}

interface ModelJsonResponse {
  answer?: string;
  externalSources?: ExternalKnowledgeItem[];
}

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);

  constructor(
    @InjectRepository(DocumentChunk)
    private readonly documentChunksRepository: Repository<DocumentChunk>,
    @InjectRepository(SemanticCache)
    private readonly semanticCacheRepository: Repository<SemanticCache>,
    private readonly models: ModelProvider,
    private readonly userSettings: UserSettingsService,
  ) {}

  /** 旧版一次性问答：走 LangGraph（retrieve → generate），等待完整 JSON 后返回 */
  async ask(request: AskRequest): Promise<AskResult> {
    const graph = createRagGraph({
      retrieve: (question) => this.retrieve(question, request.userId),
      generate: (state) => this.generate(state, request.userId),
    });
    const result = await graph.invoke({
      question: request.question,
      history: this.buildHistory(request.history),
      context: [],
      externalSources: [],
      answer: '',
    });

    // 内部知识库在前，外部资料在后
    const sources = [...result.context, ...result.externalSources];
    return { answer: result.answer, sources };
  }

  /**
   * 流式问答：先检索（结果通过 onSources 推送），再并行执行
   * ① 答案流式生成（逐 token 推送）② 外部资料 JSON 生成，最后合并。
   */
  async askStream(
    request: AskRequest,
    callbacks: {
      onSources: (sources: RetrievedChunk[]) => void | Promise<void>;
      onToken: (chunk: string) => void | Promise<void>;
    },
    signal?: AbortSignal,
  ): Promise<AskResult> {
    const startedAt = Date.now();
    // ① 语义缓存：同类问题直接复用上次结果，跳过检索与模型调用（仍按 SSE 协议输出，前端可正常收尾）
    const cacheHit = await this.findCached(request);
    if (cacheHit) {
      const { cache, similarity } = cacheHit;
      this.logger.log(
        `Semantic cache hit (${(similarity * 100).toFixed(1)}%) for userId=${request.userId}: ${request.question}`,
      );
      // 命中次数 +1（仅统计，失败不阻塞）
      await this.semanticCacheRepository
        .increment({ id: cache.id }, 'hitCount', 1)
        .catch((error) => this.logger.warn(`Failed to bump cache hitCount: ${String(error)}`));
      const cachedSources = Array.isArray(cache.sources) ? cache.sources : [];
      await callbacks.onSources(cachedSources);
      if (cache.answer) {
        // 整段答案作为单个 token 输出，保持流式协议一致
        await callbacks.onToken(cache.answer);
      }
      return {
        answer: cache.answer || '',
        sources: cachedSources,
        cached: true,
        stats: { retrieveMs: 0, answerMs: 0, totalMs: Date.now() - startedAt },
        suggestions: [],
      };
    }

    // ② 混合检索（多轮记忆增强：结合历史把当前问题改写为独立查询），并统计检索耗时
    const retrieveStart = Date.now();
    const kbSources = await this.retrieve(request.question, request.userId, request.history);
    const retrieveMs = Date.now() - retrieveStart;
    await callbacks.onSources(kbSources);

    // ②·5 图谱问答增强（GraphRAG）：从实体图谱召回与问题相关的实体关系三元组并注入回答上下文，
    //     纯 SQL 召回（不额外调 LLM），失败/无命中静默降级不影响回答
    let graphContext = '';
    let graphHitCount = 0;
    if (request.graphEnabled !== false) {
      const graph = await this.retrieveGraphContext(request.question, request.userId, kbSources);
      graphContext = graph.text;
      graphHitCount = graph.count;
    }

    const externalLimit = kbSources.length > 0 ? EXTERNAL_WITH_KB : EXTERNAL_WITHOUT_KB;
    const messages = this.buildMessages(request.question, request.history, kbSources, graphContext);

    // ③ 答案流式输出；④ 外部资料一次性生成（并行进行，不拖慢首字），并统计生成耗时
    const answerStart = Date.now();
    const [answer, rawExternalSources] = await Promise.all([
      this.streamAnswer(messages.answerMessages, callbacks.onToken, signal, request.userId),
      this.fetchExternalSources(messages.externalMessages, externalLimit, signal, request.userId),
    ]);
    const answerMs = Date.now() - answerStart;
    // 兜底去重：剔除与内部知识库重复（同一文件/同内容改写）的“伪外部资料”
    const externalSources = this.dedupeAgainstKb(rawExternalSources, kbSources);

    const finalAnswer = answer.trim() || '暂时无法生成回答。';
    const sources = [...kbSources, ...externalSources];
    // 生成完成后写入语义缓存（失败仅告警，不影响本次回答）
    await this.saveCache(request, finalAnswer, sources);
    // 相关追问建议（纯增强：失败静默返回空，不影响回答本身）
    const suggestions = await this.generateSuggestions(request.question, finalAnswer, request.userId);
    return {
      answer: finalAnswer,
      sources,
      stats: { retrieveMs, answerMs, totalMs: Date.now() - startedAt },
      suggestions,
      graphHitCount,
    };
  }

  /** 语义缓存查询：embed 问题向量，与该用户近期缓存按余弦相似度比较，返回最优命中 */
  private async findCached(
    request: AskRequest,
  ): Promise<{ cache: SemanticCache; similarity: number } | null> {
    try {
      const embeddingsModel = await this.models.getEmbeddings(request.userId);
      const embedding = await embeddingsModel.embedQuery(request.question);
      const rows = (await this.semanticCacheRepository.query(
        `SELECT id, question, answer, sources, "hitCount", "createdAt", "updatedAt",
                ("questionEmbedding"::vector <=> $1::vector) AS distance
           FROM semantic_cache
          WHERE "userId" = $2
          ORDER BY "questionEmbedding"::vector <=> $1::vector
          LIMIT 1`,
        [`[${embedding.join(',')}]`, request.userId],
      )) as Array<{ id: number; question: string; answer: string; sources: RetrievedChunk[]; distance: string }>;
      if (rows.length === 0) {
        return null;
      }
      const row = rows[0];
      const similarity = 1 - Number(row.distance);
      if (similarity < CACHE_HIT_THRESHOLD) {
        return null;
      }
      const cache = this.semanticCacheRepository.create({
        id: row.id,
        question: row.question,
        answer: row.answer,
        sources: row.sources ?? [],
      });
      return { cache, similarity };
    } catch (error) {
      this.logger.warn(`Failed to query semantic cache: ${String(error)}`);
      return null;
    }
  }

  /** 写入语义缓存：新答案入库；每用户条数超限时删除最旧缓存，保持缓存规模可控 */
  private async saveCache(request: AskRequest, answer: string, sources: RetrievedChunk[]): Promise<void> {
    if (!answer.trim()) {
      return;
    }
    try {
      const embeddingsModel = await this.models.getEmbeddings(request.userId);
      const embedding = await embeddingsModel.embedQuery(request.question);
      const count = await this.semanticCacheRepository.count({ where: { userId: request.userId } });
      if (count >= CACHE_LIMIT) {
        const oldest = await this.semanticCacheRepository.find({
          where: { userId: request.userId },
          order: { createdAt: 'ASC' },
          take: count - CACHE_LIMIT + 1,
        });
        if (oldest.length > 0) {
          await this.semanticCacheRepository.remove(oldest);
        }
      }
      await this.semanticCacheRepository.save(
        this.semanticCacheRepository.create({
          userId: request.userId,
          question: request.question,
          questionEmbedding: `[${embedding.join(',')}]`,
          answer,
          sources,
        }),
      );
    } catch (error) {
      this.logger.warn(`Failed to save semantic cache: ${String(error)}`);
    }
  }

  /** 逐 token 调用模型，累积并回调每个增量片段（兼容 content 为字符串或片段数组） */
  private async streamAnswer(
    messages: ChatMessage[],
    onToken: (chunk: string) => void | Promise<void>,
    signal: AbortSignal | undefined,
    userId: number,
  ): Promise<string> {
    let answer = '';
    const chatModel = await this.models.getChatModel(userId);
    const stream = await chatModel.stream(messages, { signal });
    for await (const chunk of stream) {
      const text = Array.isArray(chunk.content)
        ? chunk.content
            .map((part) => (typeof part === 'string' ? part : ((part as { text?: string }).text ?? '')))
            .join('')
        : chunk.content;
      if (text) {
        answer += text;
        await onToken(text);
      }
    }
    return answer;
  }

  /** 一次性调用模型生成「外部资料」要点；失败或返回空时重试一次，最终容错返回空数组（不影响回答流） */
  private async fetchExternalSources(
    messages: ChatMessage[],
    externalLimit: number,
    signal: AbortSignal | undefined,
    userId: number,
  ): Promise<RetrievedChunk[]> {
    const chatModel = await this.models.getChatModel(userId);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (signal?.aborted) {
        return [];
      }
      try {
        const response = await chatModel.invoke(messages, { signal });
        const sources = this.parseExternalSourcesResponse(response.text, externalLimit);
        if (sources.length > 0 || attempt === 1) {
          return sources;
        }
        this.logger.warn('External sources response was empty, retrying once');
      } catch (error) {
        if (signal?.aborted) {
          return [];
        }
        this.logger.warn(`Failed to fetch external sources (attempt ${attempt + 1}): ${String(error)}`);
        if (attempt === 1) {
          return [];
        }
      }
    }
    return [];
  }

  /** 解析外部资料模型返回：兼容纯 JSON 数组、代码围栏数组、{ externalSources: [...] } 对象三种格式 */
  private parseExternalSourcesResponse(raw: string, externalLimit: number): RetrievedChunk[] {
    try {
      const jsonText = this.extractJsonValue(raw);
      const data = JSON.parse(jsonText) as ModelJsonResponse | ExternalKnowledgeItem[];
      const items = Array.isArray(data) ? data : Array.isArray(data.externalSources) ? data.externalSources : [];
      return items
        .map((item, index) => this.toExternalSource(item, index))
        .filter((item): item is RetrievedChunk => item !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, externalLimit);
    } catch (error) {
      this.logger.warn(`Failed to parse external sources response: ${String(error)}`);
      return [];
    }
  }

  /**
   * 从模型输出中提取 JSON 文本，同时兼容对象与数组：
   * 优先 ```json 代码围栏；否则按首个 '[' / '{' 与最后一个 ']' / '}' 截取，
   * 避免 extractJson 只按花括号截取而丢失裸数组的外层中括号。
   */
  private extractJsonValue(raw: string): string {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }
    const arrayStart = trimmed.indexOf('[');
    const objectStart = trimmed.indexOf('{');
    const start = arrayStart === -1 ? objectStart : objectStart === -1 ? arrayStart : Math.min(arrayStart, objectStart);
    if (start === -1) {
      return trimmed;
    }
    const closeChar = trimmed[start] === '[' ? ']' : '}';
    const end = trimmed.lastIndexOf(closeChar);
    if (end > start) {
      return trimmed.slice(start, end + 1);
    }
    return trimmed;
  }

  /**
   * 兜底剔除与内部知识库重复的“伪外部资料”（模型偶尔会把知识库文档改写成外部资料）：
   * 1) 标题等于/包含知识库原文件名（如直接拿 “杨阳-简历.pdf” 当外部资料标题）；
   * 2) 内容与某个知识库片段的相邻字符二元组（bigram）覆盖率过高，判定为对知识库内容的复述改写。
   */
  private dedupeAgainstKb(externalSources: RetrievedChunk[], kbSources: RetrievedChunk[]): RetrievedChunk[] {
    if (kbSources.length === 0 || externalSources.length === 0) {
      return externalSources;
    }

    const kbFileNames = kbSources
      .map((chunk) => String(chunk.metadata?.originalName ?? '').trim())
      .filter(Boolean);
    const kbBigrams = kbSources.map((chunk) => this.toBigrams(chunk.content));

    return externalSources.filter((item) => {
      const title = String(item.metadata?.title ?? '').trim();

      // 规则 1：标题与知识库文件名重合（忽略扩展名与空白）；标题需足够长，避免短标题被长文件名包含而误杀
      const normalizedTitle = this.normalizeName(title);
      for (const fileName of kbFileNames) {
        const normalizedFileName = this.normalizeName(fileName);
        if (
          normalizedFileName.length >= 4 &&
          normalizedTitle.length >= 4 &&
          (normalizedTitle === normalizedFileName || normalizedTitle.includes(normalizedFileName))
        ) {
          this.logger.warn(`Drop duplicated external source (file name match): ${title}`);
          return false;
        }
      }

      // 规则 2：外部资料内容与知识库片段 bigram 覆盖率过高（短内容不判定，避免误杀）
      const externalBigrams = this.toBigrams(item.content);
      if (externalBigrams.size >= 20) {
        for (const kb of kbBigrams) {
          const overlap = this.bigramCoverage(externalBigrams, kb);
          if (overlap >= EXTERNAL_DEDUP_OVERLAP) {
            this.logger.warn(
              `Drop duplicated external source (content overlap ${(overlap * 100).toFixed(0)}%): ${title}`,
            );
            return false;
          }
        }
      }

      return true;
    });
  }

  /** 去掉扩展名与非字母数字汉字字符，便于文件名比较 */
  private normalizeName(name: string): string {
    return name
      .replace(/\.[^.]+$/, '')
      .replace(/[^0-9a-zA-Z\u4e00-\u9fa5]/g, '')
      .toLowerCase();
  }

  /** 将文本规范化后切分为相邻字符二元组集合（去重），用于内容重合度计算 */
  private toBigrams(text: string): Set<string> {
    const normalized = (text ?? '').replace(/[^0-9a-zA-Z\u4e00-\u9fa5]/g, '');
    const bigrams = new Set<string>();
    for (let i = 0; i < normalized.length - 1; i += 1) {
      bigrams.add(normalized.slice(i, i + 2));
    }
    return bigrams;
  }

  /** external 的 bigram 中有多少比例能在 kb 中找到（以外部资料为基准的覆盖率） */
  private bigramCoverage(external: Set<string>, kb: Set<string>): number {
    if (external.size === 0) {
      return 0;
    }
    let matched = 0;
    external.forEach((bigram) => {
      if (kb.has(bigram)) {
        matched += 1;
      }
    });
    return matched / external.size;
  }

  private buildMessages(
    question: string,
    history: HistoryMessage[] | undefined,
    kbSources: RetrievedChunk[],
    graphContext = '',
  ): {
    answerMessages: ChatMessage[];
    externalMessages: ChatMessage[];
  } {
    const hasKb = kbSources.length > 0;
    const externalLimit = hasKb ? EXTERNAL_WITH_KB : EXTERNAL_WITHOUT_KB;
    const historySection = this.buildHistory(history);
    const historyText = historySection ? `历史对话：\n\n${historySection}\n\n` : '';

    const kbSection = hasKb
      ? kbSources
          .map((chunk, index) => `[知识库${index + 1}]（相关度 ${(chunk.similarity * 100).toFixed(1)}%）：${chunk.content}`)
          .join('\n\n')
      : '（知识库中未检索到相关内容）';

    const answerSystem = hasKb
      ? [
          '你是知识库问答助手。请优先使用知识库片段回答，再补充你自身已有的相关知识。',
          '回答要求：',
          '1. 先写「【知识库】」部分：仅基于提供的知识库片段作答，并用 [知识库1]、[知识库2] 标注引用。',
          '2. 再写「【补充知识】」部分：补充你自身具备的相关知识（不要重复知识库已写内容）。',
          '3. 直接输出回答正文，使用中文纯文本与换行排版，不要输出任何 JSON 或代码块包裹。',
        ].join('\n')
      : [
          '你是知识库问答助手。当前知识库没有相关内容，请仅使用你自身已有知识回答。',
          '回答要求：',
          '1. 直接给出完整中文回答（可标明来自模型自身知识）。',
          '2. 直接输出回答正文，使用中文纯文本与换行排版，不要输出任何 JSON 或代码块包裹。',
        ].join('\n');

    const externalSystem = hasKb
      ? [
          '你是资料整理助手。知识库片段仅供你了解“内部知识库已经包含哪些内容”，以便输出互补资料。',
          '请输出与问题相关、但知识库中【没有】的「外部资料」要点（来自你自身的通用知识，如背景概念、同名区分、延伸信息等）。',
          '严格禁止：',
          '1. 不得总结、复述、改写知识库片段中的任何内容，不得把知识库文档再列为一条资料；',
          '2. 标题不得使用知识库文档的文件名（如 .pdf/.docx 文件名）；',
          '3. 如果没有真正的补充资料，输出空数组 []。',
          `只输出 JSON 数组，最多 ${externalLimit} 条，按相关度从高到低，score 为 0~1，不要输出其他文字：`,
          '[{"title":"...","content":"...","score":0.9}]',
        ].join('\n')
      : [
          '你是资料整理助手。请根据问题，输出你自身知识中与问题最相关的「外部资料」要点。',
          `只输出 JSON 数组，最多 ${externalLimit} 条，按相关度从高到低，score 为 0~1，不要输出其他文字：`,
          '[{"title":"...","content":"...","score":0.9}]',
        ].join('\n');

    const graphSection = graphContext
      ? `[图谱关系]（来自知识库实体图谱，请优先据此回答实体/关系层面的问题）：\n${graphContext}`
      : '';
    const contextText = [
      hasKb ? `知识库片段（仅供了解已包含内容，禁止作为外部资料复述）：\n\n${kbSection}` : '',
      graphSection,
      `问题：${question}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      answerMessages: [
        { role: 'system', content: answerSystem },
        { role: 'user', content: `${historyText}${contextText}` },
      ],
      externalMessages: [
        { role: 'system', content: externalSystem },
        { role: 'user', content: `${historyText}${contextText}` },
      ],
    };
  }

  /**
   * 查询改写（方案 A）：短碎片查询（如人名简称“彭”“彭基”“基良”）直接做 embedding 是语义噪声，
   * 先由 LLM 扩展为完整表达（如“彭”→“彭基良”）。
   * 改写结果用于「向量语义路」与「精确关键词路」；原始查询仍用于「子串关键词路」保证字面召回。
   * 长查询（超过 QUERY_REWRITE_THRESHOLD 字符）不改写以省一次模型调用；改写失败/空结果回退原查询。
   */
  private async rewriteQuery(question: string, userId: number): Promise<string> {
    if (question.trim().length > QUERY_REWRITE_THRESHOLD) {
      return question;
    }
    try {
      const chatModel = await this.models.getChatModel(userId);
      const response = await chatModel.invoke([
        {
          role: 'system',
          content:
            '你是查询改写助手。用户可能输入了人名、术语的简称或碎片（例如“彭”“彭基”“基良”）。' +
            '请把它改写成知识库检索可用的完整查询（例如“彭”→“彭基良”）。' +
            '直接输出改写后的查询文本，不要任何解释、引号或多余标点。',
        },
        { role: 'user', content: `原始查询：${question}\n改写为：` },
      ]);
      const rewritten = response.text.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
      return rewritten && rewritten !== question ? rewritten : question;
    } catch (error) {
      this.logger.warn(`Query rewrite failed, fallback to original query: ${String(error)}`);
      return question;
    }
  }

  /**
   * 多轮记忆增强检索：结合最近对话历史，把当前问题改写为不依赖上下文的独立检索查询
   * （补全"它/这个方案/上面的数据"等指代），供向量路 embedding 与关键词路召回。
   * 无历史/改写失败/结果为空时回退原问题（额外一次 LLM 调用，失败不阻塞主流程）。
   */
  private async contextualizeQuery(
    question: string,
    history: HistoryMessage[] | undefined,
    userId: number,
  ): Promise<string> {
    if (!history || history.length === 0) {
      return question;
    }
    try {
      const chatModel = await this.models.getChatModel(userId);
      const historyText = history
        .slice(-6)
        .map((msg) => `${msg.role === 'user' ? '用户' : '助手'}：${msg.content.slice(0, 200)}`)
        .join('\n');
      const response = await chatModel.invoke([
        {
          role: 'system',
          content:
            '你是检索查询理解助手。用户在多轮对话中连续提问，最后一个问题可能含指代（如"它""这个方案""上面的数据"）。' +
            '请结合对话历史，把最后一个问题改写为一条独立、完整、可直接检索知识库的查询（补全指代与上下文）。' +
            '直接输出改写后的查询文本，不要任何解释、引号或多余标点。',
        },
        { role: 'user', content: `对话历史：\n${historyText}\n\n最后一个问题：${question}\n改写为：` },
      ]);
      const rewritten = response.text.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
      return rewritten && rewritten !== question ? rewritten : question;
    } catch (error) {
      this.logger.warn(`Contextualize query failed, fallback to original query: ${String(error)}`);
      return question;
    }
  }

  /**
   * 相关追问建议：基于「问题 + 回答」生成 2~3 条用户最可能继续追问的问题。
   * 纯增强功能：任何失败仅告警并返回空数组，不影响回答本身。
   */
  private async generateSuggestions(question: string, answer: string, userId: number): Promise<string[]> {
    try {
      const chatModel = await this.models.getChatModel(userId);
      const response = await chatModel.invoke([
        {
          role: 'system',
          content:
            '你是对话助手。根据用户的问题和 AI 的回答，生成 2~3 条用户最可能继续追问的问题。' +
            '每条一句话、简短具体、不要编号。只输出 JSON 字符串数组，例如 ["问题1","问题2"]，不要任何解释文字。',
        },
        { role: 'user', content: `问题：${question}\n\n回答：${answer.slice(0, 800)}` },
      ]);
      return this.parseSuggestionList(response.text);
    } catch (error) {
      this.logger.warn(`Suggestions generation failed: ${String(error)}`);
      return [];
    }
  }

  /** 解析模型输出的字符串数组（兼容代码围栏/前后多余文字），失败返回空数组 */
  private parseSuggestionList(raw: string): string[] {
    const jsonText = this.extractJson(raw);
    if (!jsonText) {
      return [];
    }
    try {
      const data = JSON.parse(jsonText) as unknown;
      if (!Array.isArray(data)) {
        return [];
      }
      return data.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 3);
    } catch (error) {
      this.logger.warn(`Failed to parse suggestions: ${String(error)}`);
      return [];
    }
  }

  /**
   * 混合检索（方案 B）：多路召回 → RRF 融合 → 每文件保留最优 → LLM 重排。
   * - 向量语义路：Embedding cosine 相似度（用改写后的查询，碎片“彭”的原始向量是噪声），
   *   内部做 minScore 绝对阈值过滤；
   * - 关键词字面路：pg_trgm 子串匹配（`ILIKE '%term%'`），原始查询与改写查询各一路，
   *   保证“输入‘彭’能命中含‘彭基良’的文档”——纯向量检索只认语义、不认字，这是它补的短板。
   * 关键词路不做分数阈值过滤（字面命中即候选，避免碎片查询被绝对阈值误杀），
   * 最终相关性由 LLM 重排把关；分数阈值与融合分数不可比，故融合后也不再做相对阈值过滤。
   * 检索参数（topK/keywordTopK/minScore/rerankTopN）取该用户在设置页保存的值。
   */
  private async retrieve(
    question: string,
    userId: number,
    history?: HistoryMessage[],
    trace?: RetrieveTrace,
  ): Promise<RetrievedChunk[]> {
    const settings = await this.userSettings.getEffectiveSettings(userId);

    // ① 多轮记忆增强（方案）：结合最近对话历史把当前问题改写为独立可检索查询，
    //    解决连续追问（如"它的优缺点呢"）缺失上文主题导致检索落空的问题；无历史/失败回退原问题。
    const contextualized = await this.contextualizeQuery(question, history, userId);
    // ② 查询改写（方案 A）：短碎片 → 完整表达（基于上下文化后的查询）
    const rewritten = await this.rewriteQuery(contextualized, userId);
    if (trace) {
      trace.contextualized = contextualized;
      trace.rewritten = rewritten;
    }

    // ② 向量语义路
    // LEFT JOIN upload_files：过滤已删除文档遗留的“孤儿分块”，并按 uploaderId 隔离用户——
    // 只检索当前登录用户上传的文档（server 与 ai-service 共用同一数据库，upload_files 由 server 维护），
    // 避免跨用户检索泄漏他人文档
    const embeddingsModel = await this.models.getEmbeddings(userId);
    const vectorEmbedding = await embeddingsModel.embedQuery(rewritten);
    const vectorRows: SimilarityRow[] = await this.documentChunksRepository.query(
      `SELECT c.id, c."uploadFileId", c.content, c.metadata,
              c.embedding::vector <=> $1::vector AS distance
         FROM document_chunks c
         LEFT JOIN upload_files f ON f.id = c."uploadFileId"
        WHERE f.id IS NOT NULL
          AND (f."uploaderId" = $2
               OR f.id IN (SELECT "uploadFileId" FROM share_records WHERE "shareeId" = $2))
        ORDER BY c.embedding::vector <=> $1::vector
        LIMIT ${settings.topK}`,
      [`[${vectorEmbedding.join(',')}]`, userId],
    );

    // ③ 关键词字面路（原始查询 + 改写查询各一路，Set 去重；每路按 trigram 相似度排序召回）
    const vectorFiltered = vectorRows.filter((row) => 1 - Number(row.distance) > settings.minScore);
    if (trace) {
      trace.vectorLeg = vectorFiltered.map((row) => ({
        chunkId: row.id,
        uploadFileId: row.uploadFileId,
        content: row.content,
        score: 1 - Number(row.distance),
      }));
    }
    const legs: FusionLeg[] = [
      {
        name: 'vector',
        items: vectorFiltered.map((row, rank) => ({ rank, chunk: this.toFusionCandidate(row, 1 - Number(row.distance)) })),
      },
    ];
    for (const term of new Set([question, contextualized, rewritten].filter((t) => t.trim()))) {
      const rows = await this.keywordSearch(term, userId, settings.keywordTopK);
      if (trace) {
        trace.keywordLegs.push({
          term,
          items: rows.map((row) => ({
            chunkId: row.id,
            uploadFileId: row.uploadFileId,
            content: row.content,
            score: Math.max(Number(row.distance), MIN_SCORE),
          })),
        });
      }
      legs.push({
        name: `keyword:${term}`,
        items: rows.map((row, rank) => ({
          rank,
          // 关键词路 SimilarityRow.distance 字段存放 pg_trgm similarity（0~1，越大越相关）；
          // 1~2 字符的短词 trigram 相似度可能为 0，但已字面命中，给 MIN_SCORE 下限避免展示为 0%
          chunk: this.toFusionCandidate(row, Math.max(Number(row.distance), MIN_SCORE)),
        })),
      });
    }

    // ④ RRF 融合（只比较排名、不比较绝对分数，天然适配“cosine 分 + trigram 分”两种不可比空间），
    //    再按文件保留最优片段，避免同一文档多条候选占满重排名额
    const fused = this.reciprocalRankFusion(legs);
    if (trace) {
      trace.fused = fused.map((chunk) => ({
        chunkId: chunk.chunkId,
        uploadFileId: chunk.uploadFileId,
        content: chunk.content,
        score: chunk.score,
        rrf: chunk.rrf,
      }));
    }
    const fileChunkMap = new Map<number, FusionCandidate>();
    fused.forEach((chunk) => {
      const existing = fileChunkMap.get(chunk.uploadFileId);
      if (!existing || chunk.rrf > existing.rrf) {
        fileChunkMap.set(chunk.uploadFileId, chunk);
      }
    });

    const candidates: Omit<RetrievedChunk, 'similarity'>[] = Array.from(fileChunkMap.values())
      .sort((a, b) => b.rrf - a.rrf)
      .map((chunk) => ({
        sourceType: 'knowledge_base' as const,
        chunkId: chunk.chunkId,
        uploadFileId: chunk.uploadFileId,
        content: chunk.content,
        score: chunk.score,
        metadata: chunk.metadata,
      }));

    // ⑤ LLM 重排：最终相关性过滤（关键词路可能命中无关文档，由重排剔除），并校准展示分数
    const kept = await this.rerank(question, candidates, userId);
    if (trace) {
      trace.kept = kept.map((chunk) => ({
        chunkId: chunk.chunkId ?? 0,
        uploadFileId: chunk.uploadFileId ?? 0,
        content: chunk.content,
        score: chunk.score,
        similarity: chunk.similarity,
      }));
    }
    return kept;
  }

  /**
   * 检索调试（只检索、不生成回答）：返回完整检索链路（改写查询 → 多路召回 → RRF 融合 → 重排保留），
   * 供 RAG 调试/评估面板展示，帮助定位"为什么检索不到/召回不准"。
   * 注意：链路中的 LLM 重排仍会调用该用户配置的聊天模型（与真实问答保持一致，用于相关性过滤）。
   */
  async debugRetrieve(question: string, userId: number): Promise<RetrieveDebugView> {
    const trace: RetrieveTrace = {
      contextualized: question,
      rewritten: question,
      vectorLeg: [],
      keywordLegs: [],
      fused: [],
      kept: [],
    };
    await this.retrieve(question, userId, undefined, trace);
    return {
      question,
      contextualized: trace.contextualized,
      rewritten: trace.rewritten,
      vectorLeg: trace.vectorLeg,
      keywordLegs: trace.keywordLegs,
      fused: trace.fused,
      kept: trace.kept,
    };
  }

  /** 关键词（字面）检索：pg_trgm 子串匹配 + trigram 相似度排序；term 与 userId 参数化传入（防注入），LIMIT 由设置决定。
   *  同样 LEFT JOIN upload_files 过滤已删除文档的孤儿分块，并按 uploaderId 隔离用户（与向量路一致）。 */
  private async keywordSearch(term: string, userId: number, keywordTopK: number): Promise<SimilarityRow[]> {
    if (!term.trim()) {
      return [];
    }
    const sql = `SELECT c.id, c."uploadFileId", c.content, c.metadata,
                        similarity(c.content, $1) AS distance
                   FROM document_chunks c
                   LEFT JOIN upload_files f ON f.id = c."uploadFileId"
                  WHERE f.id IS NOT NULL
                    AND (f."uploaderId" = $2
                         OR f.id IN (SELECT "uploadFileId" FROM share_records WHERE "shareeId" = $2))
                    AND c.content ILIKE '%' || $1 || '%'
                  ORDER BY distance DESC
                  LIMIT ${keywordTopK}`;
    return this.documentChunksRepository.query(sql, [term, userId]);
  }

  /**
   * 图谱问答增强（GraphRAG）：从实体图谱召回与本次问答相关的「实体—关系—实体」三元组，
   * 拼成纯文本注入回答上下文，让模型在实体/关系层面作答时更有依据。
   * - 候选实体：按名称与问题的 pg_trgm 相似度取前 N 个（含共享给我的文档，隔离口径与检索 SQL 一致）；
   * - 相关关系：候选实体间的关系，按三元组文本与「问题+检索片段」的 bigram 重叠率打分过滤；
   * - 纯 SQL 召回 + 字符串匹配，不额外调 LLM；任何异常静默降级，不影响回答主流程。
   */
  private async retrieveGraphContext(
    question: string,
    userId: number,
    kbSources: RetrievedChunk[],
  ): Promise<{ text: string; count: number }> {
    try {
      // ① 匹配文本（haystack）：问题 + 已检索片段，据此判断实体/关系是否与本次问答相关
      const pieces = [question, ...kbSources.map((chunk) => chunk.content || '')].filter((s) => s.trim());
      const haystack = pieces.join('\n').slice(0, GRAPH_MATCH_TEXT_LIMIT);

      // ② 候选实体：名称与问题最接近的前 N 个（含共享给我的文档）
      const entities: { id: number; name: string; entityType: string }[] =
        await this.documentChunksRepository.query(
          `SELECT e.id, e.name, e."entityType"
             FROM graph_entities e
             LEFT JOIN upload_files f ON f.id = e."uploadFileId"
             LEFT JOIN share_records s ON s."uploadFileId" = e."uploadFileId"
            WHERE f.id IS NOT NULL
              AND (e."userId" = $1 OR s."shareeId" = $1)
            ORDER BY similarity(e.name, $2) DESC
            LIMIT ${GRAPH_ENTITY_LIMIT}`,
          [userId, question],
        );

      if (entities.length === 0) {
        return { text: '', count: 0 };
      }

      // ③ 候选实体间的关系三元组（带两端实体名称/类型）
      const entityIds = entities.map((entity) => entity.id);
      const relations: {
        relation: string;
        sourceName: string;
        sourceType: string;
        targetName: string;
        targetType: string;
      }[] = await this.documentChunksRepository.query(
        `SELECT r.relation,
                se.name AS "sourceName", se."entityType" AS "sourceType",
                te.name AS "targetName", te."entityType" AS "targetType"
           FROM graph_relations r
           JOIN graph_entities se ON se.id = r."sourceEntityId"
           JOIN graph_entities te ON te.id = r."targetEntityId"
          WHERE r."sourceEntityId" = ANY($1) OR r."targetEntityId" = ANY($1)`,
        [entityIds],
      );

      // ④ 按三元组文本与 haystack 的 bigram 重叠打分，去重后取最相关的注入
      const scored = relations.map((rel) => {
        const text = `${rel.sourceName}${rel.relation}${rel.targetName}`;
        return {
          ...rel,
          key: `${rel.sourceName}|${rel.relation}|${rel.targetName}`,
          score: this.bigramOverlap(text, haystack),
        };
      });
      const byKey = new Map<string, (typeof scored)[number]>();
      for (const item of scored) {
        const prev = byKey.get(item.key);
        if (item.score > 0 && (!prev || item.score > prev.score)) {
          byKey.set(item.key, item);
        }
      }
      const triples = Array.from(byKey.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, GRAPH_TRIPLE_LIMIT);

      if (triples.length === 0) {
        return { text: '', count: 0 };
      }
      const text = triples
        .map(
          (rel) =>
            `- ${rel.sourceName}（${rel.sourceType}）— ${rel.relation} — ${rel.targetName}（${rel.targetType}）`,
        )
        .join('\n');
      return { text, count: triples.length };
    } catch (error) {
      this.logger.warn(`GraphRAG context retrieval failed: ${String(error)}`);
      return { text: '', count: 0 };
    }
  }

  /** 字符 bigram 重叠率（0~1）：query 中的 bigram 有多少出现在 text 里；单字串退化为单字匹配 */
  private bigramOverlap(query: string, text: string): number {
    const grams = (value: string): string[] => {
      const chars = Array.from(value.replace(/\s+/g, ''));
      if (chars.length <= 1) {
        return chars;
      }
      return chars.slice(0, -1).map((_, index) => chars[index] + chars[index + 1]);
    };
    const qGrams = grams(query);
    if (qGrams.length === 0) {
      return 0;
    }
    const tSet = new Set(grams(text));
    let hit = 0;
    for (const gram of qGrams) {
      if (tSet.has(gram)) {
        hit += 1;
      }
    }
    return hit / qGrams.length;
  }

  /** 把一行 SQL 结果统一转成融合候选结构（rrf 初始为 0，融合时累加） */
  private toFusionCandidate(row: SimilarityRow, score: number): FusionCandidate {
    return {
      chunkId: row.id,
      uploadFileId: row.uploadFileId,
      content: row.content,
      metadata: row.metadata ?? {},
      score,
      rrf: 0,
    };
  }

  /**
   * RRF（Reciprocal Rank Fusion）：多路召回按排名融合，score = Σ 1/(k + rank + 1)。
   * 只比较排名、不比较绝对分数，适合向量分与关键词分不可比的多路召回场景。
   */
  private reciprocalRankFusion(legs: FusionLeg[], k = RRF_K): FusionCandidate[] {
    const map = new Map<number, FusionCandidate>();
    for (const leg of legs) {
      for (const { rank, chunk } of leg.items) {
        const existing = map.get(chunk.chunkId);
        if (existing) {
          existing.rrf += 1 / (k + rank + 1);
        } else {
          map.set(chunk.chunkId, { ...chunk, rrf: 1 / (k + rank + 1) });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.rrf - a.rrf);
  }

  /**
   * LLM 重排：向量相似度分数区间窄（豆包等 Embedding 常见），绝对值区分度低，
   * 因此交给模型判断候选片段是否与问题真正相关，只保留相关片段。
   */
  private async rerank(question: string, candidates: Omit<RetrievedChunk, 'similarity'>[], userId: number): Promise<RetrievedChunk[]> {
    const settings = await this.userSettings.getEffectiveSettings(userId);
    let kept: Omit<RetrievedChunk, 'similarity'>[];
    if (candidates.length <= 1) {
      kept = candidates;
    } else {
      const list = candidates
        .map((chunk, index) => `[${index + 1}]：${chunk.content.slice(0, 400)}`)
        .join('\n\n');

      const chatModel = await this.models.getChatModel(userId);
      const response = await chatModel.invoke([
        { role: 'system', content: '你是检索相关性判断助手。只判断候选片段是否与问题相关，不要回答用户问题。' },
        {
          role: 'user',
          content: `问题：${question}\n\n候选片段：\n\n${list}\n\n只输出相关片段编号的 JSON 数组，例如 [1,3]；都不相关则输出 []。`,
        },
      ]);

      const parsed = this.parseIndexList(response.text);
      if (parsed === null) {
        // 解析失败：退回向量排序结果，避免误删候选
        kept = candidates.slice(0, settings.rerankTopN);
      } else if (parsed.length === 0) {
        // 模型判定无相关片段：返回空，让模型用自身知识回答
        kept = [];
      } else {
        kept = parsed
          .map((index) => candidates[index - 1])
          .filter((chunk): chunk is Omit<RetrievedChunk, 'similarity'> => Boolean(chunk))
          .slice(0, settings.rerankTopN);
      }
    }

    return this.applyRelativeSimilarity(kept);
  }

  /** 计算保留片段的“真实相似度”：按本次检索最强匹配归一化，保证展示值直观稳定 */
  private applyRelativeSimilarity(chunks: Omit<RetrievedChunk, 'similarity'>[]): RetrievedChunk[] {
    if (chunks.length === 0) {
      return [];
    }
    const best = Math.max(...chunks.map((chunk) => chunk.score));
    return chunks.map((chunk) => ({
      ...chunk,
      similarity: relativeSimilarity(chunk.score, best),
    }));
  }

  /** 从模型输出中抽取重排编号数组（如“相关片段为 [1,3]”）；无法解析时返回 null 触发兜底策略 */
  private parseIndexList(raw: string): number[] | null {
    const match = raw.match(/\[([\d,\s]*)\]/);
    if (!match) {
      return null;
    }
    return match[1]
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((index) => Number.isInteger(index) && index > 0);
  }

  /** LangGraph 生成节点（旧链路）：一次性输出 { answer, externalSources } JSON */
  private async generate(state: RagState, userId: number): Promise<GenerateResult> {
    const hasKb = state.context.length > 0;
    const externalLimit = hasKb ? EXTERNAL_WITH_KB : EXTERNAL_WITHOUT_KB;
    const historySection = state.history ? `历史对话：\n\n${state.history}\n\n` : '';

    const kbSection = hasKb
      ? state.context
          .map((chunk, index) => `[知识库${index + 1}]（相关度 ${(chunk.similarity * 100).toFixed(1)}%）：${chunk.content}`)
          .join('\n\n')
      : '（知识库中未检索到相关内容）';

    const systemPrompt = hasKb
      ? [
          '你是知识库问答助手。请先检索并优先使用知识库片段回答，再补充你自身已有的相关知识。',
          '回答要求：',
          '1. 先写「【知识库】」部分：仅基于提供的知识库片段作答，并用 [知识库1]、[知识库2] 标注引用。',
          '2. 再写「【补充知识】」部分：补充你自身具备的相关知识（不要重复知识库已写内容）。',
          `3. 另返回最多 ${externalLimit} 条与问题相关的「外部资料」要点，按相关度从高到低，score 为 0~1。`,
          '请使用中文。必须只输出合法 JSON，不要 Markdown 代码块：',
          '{"answer":"...","externalSources":[{"title":"...","content":"...","score":0.9}]}',
        ].join('\n')
      : [
          '你是知识库问答助手。当前知识库没有相关内容，请仅使用你自身已有知识回答。',
          '回答要求：',
          '1. 直接给出完整中文回答（可标明来自模型自身知识）。',
          `2. 另返回最多 ${externalLimit} 条与问题最相关的「外部资料」要点，按相关度从高到低，score 为 0~1。`,
          '请使用中文。必须只输出合法 JSON，不要 Markdown 代码块：',
          '{"answer":"...","externalSources":[{"title":"...","content":"...","score":0.9}]}',
        ].join('\n');

    const chatModel = await this.models.getChatModel(userId);
    const response = await chatModel.invoke([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${historySection}知识库片段：\n\n${kbSection}\n\n问题：${state.question}`,
      },
    ]);

    const parsed = this.parseModelResponse(response.text, externalLimit);
    return parsed;
  }

  /** 解析旧链路模型 JSON 响应：answer 缺失时把整段文本兜底为答案，解析失败外部资料置空 */
  private parseModelResponse(raw: string, externalLimit: number): GenerateResult {
    const fallbackAnswer = raw?.trim() || '暂时无法生成回答。';
    try {
      const jsonText = this.extractJson(raw);
      const data = JSON.parse(jsonText) as ModelJsonResponse;
      const answer = typeof data.answer === 'string' && data.answer.trim() ? data.answer.trim() : fallbackAnswer;

      const externalSources = (Array.isArray(data.externalSources) ? data.externalSources : [])
        .map((item, index) => this.toExternalSource(item, index))
        .filter((item): item is RetrievedChunk => item !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, externalLimit);

      return { answer, externalSources };
    } catch (error) {
      this.logger.warn(`Failed to parse model JSON response: ${String(error)}`);
      return { answer: fallbackAnswer, externalSources: [] };
    }
  }

  /** 从模型文本中截取最外层 { ... } JSON（兼容代码围栏与前后多余文字） */
  private extractJson(raw: string): string {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1);
    }
    return trimmed;
  }

  /** 把模型给出的一条外部资料归一化为 RetrievedChunk（无 chunkId/uploadFileId，score 缺省按序号递减） */
  private toExternalSource(item: ExternalKnowledgeItem, index: number): RetrievedChunk | null {
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (!content) {
      return null;
    }
    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `外部资料 ${index + 1}`;
    const score =
      typeof item.score === 'number' && Number.isFinite(item.score)
        ? Math.min(1, Math.max(0, item.score))
        : Math.max(0, 1 - index * 0.1);

    return {
      sourceType: 'external',
      chunkId: null,
      uploadFileId: null,
      content,
      score,
      similarity: score,
      metadata: { title, origin: 'model_knowledge' },
    };
  }

  /** 把历史消息数组拼成模型可读的「问：…／答：…」文本，无历史时返回空串 */
  private buildHistory(history?: HistoryMessage[]): string {
    if (!history || history.length === 0) {
      return '';
    }
    return history
      .map((msg) => {
        const role = msg.role === 'user' ? '问' : '答';
        return `${role}：${msg.content}`;
      })
      .join('\n');
  }
}
