import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { BaseMessageChunk } from '@langchain/core/messages';
import { Repository } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import { createRagGraph, type GenerateResult, type RagState, type RetrievedChunk } from './langgraph/rag.graph.js';
import type { AskResult } from '@ai-knowledge-base/shared';
import { OpenAIModelProvider } from './openai-model.provider.js';
import type { HistoryMessage } from './dto/ai.dto.js';

/** 向量检索候选数（重排前） */
export const TOP_K = 8;
/** 绝对阈值：相似度低于该值的片段视为不相关，直接丢弃 */
export const MIN_SCORE = 0.3;
/** 相对阈值：低于最高分该比例的片段视为低相关，丢弃（自适应不同 Embedding 模型的分数分布） */
export const RELATIVE_MIN_SCORE = 0.7;
/** 重排后最多保留的片段数 */
export const RERANK_TOP_N = 5;

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

export const EXTERNAL_WITH_KB = 3;
export const EXTERNAL_WITHOUT_KB = 5;
/** 外部资料与知识库片段的 bigram 覆盖率达到该阈值时，视为对知识库内容的复述，予以剔除 */
export const EXTERNAL_DEDUP_OVERLAP = 0.4;

export interface AskRequest {
  question: string;
  conversationId?: string;
  history?: HistoryMessage[];
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

  private readonly graph = createRagGraph({
    retrieve: (question) => this.retrieve(question),
    generate: (state) => this.generate(state),
  });

  constructor(
    @InjectRepository(DocumentChunk)
    private readonly documentChunksRepository: Repository<DocumentChunk>,
    private readonly models: OpenAIModelProvider,
  ) {}

  async ask(request: AskRequest): Promise<AskResult> {
    const result = await this.graph.invoke({
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
    const kbSources = await this.retrieve(request.question);
    await callbacks.onSources(kbSources);

    const externalLimit = kbSources.length > 0 ? EXTERNAL_WITH_KB : EXTERNAL_WITHOUT_KB;
    const messages = this.buildMessages(request.question, request.history, kbSources);

    // ① 答案流式输出；② 外部资料一次性生成（并行进行，不拖慢首字）
    const [answer, rawExternalSources] = await Promise.all([
      this.streamAnswer(messages.answerMessages, callbacks.onToken, signal),
      this.fetchExternalSources(messages.externalMessages, externalLimit, signal),
    ]);
    // 兜底去重：剔除与内部知识库重复（同一文件/同内容改写）的“伪外部资料”
    const externalSources = this.dedupeAgainstKb(rawExternalSources, kbSources);

    const finalAnswer = answer.trim() || '暂时无法生成回答。';
    const sources = [...kbSources, ...externalSources];
    return { answer: finalAnswer, sources };
  }

  /** 逐 token 调用模型，累积并回调每个增量片段 */
  private async streamAnswer(
    messages: Parameters<OpenAIModelProvider['chatModel']['stream']>[0],
    onToken: (chunk: string) => void | Promise<void>,
    signal?: AbortSignal,
  ): Promise<string> {
    let answer = '';
    const stream = await this.models.chatModel.stream(messages, { signal });
    for await (const chunk of stream as AsyncIterable<BaseMessageChunk>) {
      const text = typeof chunk.content === 'string' ? chunk.content : '';
      if (text) {
        answer += text;
        await onToken(text);
      }
    }
    return answer;
  }

  /** 一次性调用模型生成「外部资料」要点；失败或返回空时重试一次，最终容错返回空数组（不影响回答流） */
  private async fetchExternalSources(
    messages: Parameters<OpenAIModelProvider['chatModel']['invoke']>[0],
    externalLimit: number,
    signal?: AbortSignal,
  ): Promise<RetrievedChunk[]> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (signal?.aborted) {
        return [];
      }
      try {
        const response = await this.models.chatModel.invoke(messages, { signal });
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
  ): {
    answerMessages: { role: 'system' | 'user'; content: string }[];
    externalMessages: { role: 'system' | 'user'; content: string }[];
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

    const contextText = hasKb
      ? `知识库片段（仅供了解已包含内容，禁止作为外部资料复述）：\n\n${kbSection}\n\n问题：${question}`
      : `问题：${question}`;

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

  private async retrieve(question: string): Promise<RetrievedChunk[]> {
    const embedding = await this.models.embeddings.embedQuery(question);
    const vectorStr = `[${embedding.join(',')}]`;
    // 向量以参数传入，避免字符串拼接（TOP_K 为常量，直接内联无注入风险）
    const sql = `SELECT id, "uploadFileId", content, metadata, embedding::vector <=> $1::vector AS distance
       FROM document_chunks
       ORDER BY embedding::vector <=> $1::vector
       LIMIT ${TOP_K}`;
    const rows: SimilarityRow[] = await this.documentChunksRepository.query(sql, [vectorStr]);

    let chunks = rows
      .map((row) => ({
        sourceType: 'knowledge_base' as const,
        chunkId: row.id,
        uploadFileId: row.uploadFileId,
        content: row.content,
        score: 1 - Number(row.distance),
        metadata: row.metadata ?? {},
      }))
      .filter((chunk) => chunk.score > MIN_SCORE);

    // 去掉“矮个子里拔高个”的长尾：只保留与最高分相近的片段
    const bestScore = chunks.reduce((best, chunk) => Math.max(best, chunk.score), 0);
    chunks = chunks.filter((chunk) => chunk.score >= bestScore * RELATIVE_MIN_SCORE);

    const fileChunkMap = new Map<number, (typeof chunks)[0]>();
    chunks.forEach((chunk) => {
      const existing = fileChunkMap.get(chunk.uploadFileId);
      if (!existing || chunk.score > existing.score) {
        fileChunkMap.set(chunk.uploadFileId, chunk);
      }
    });

    const candidates: Omit<RetrievedChunk, 'similarity'>[] = Array.from(fileChunkMap.values()).sort(
      (a, b) => b.score - a.score,
    );
    return this.rerank(question, candidates);
  }

  /**
   * LLM 重排：向量相似度分数区间窄（豆包等 Embedding 常见），绝对值区分度低，
   * 因此交给模型判断候选片段是否与问题真正相关，只保留相关片段。
   */
  private async rerank(question: string, candidates: Omit<RetrievedChunk, 'similarity'>[]): Promise<RetrievedChunk[]> {
    let kept: Omit<RetrievedChunk, 'similarity'>[];
    if (candidates.length <= 1) {
      kept = candidates;
    } else {
      const list = candidates
        .map((chunk, index) => `[${index + 1}]：${chunk.content.slice(0, 400)}`)
        .join('\n\n');

      const response = await this.models.chatModel.invoke([
        { role: 'system', content: '你是检索相关性判断助手。只判断候选片段是否与问题相关，不要回答用户问题。' },
        {
          role: 'user',
          content: `问题：${question}\n\n候选片段：\n\n${list}\n\n只输出相关片段编号的 JSON 数组，例如 [1,3]；都不相关则输出 []。`,
        },
      ]);

      const parsed = this.parseIndexList(response.text);
      if (parsed === null) {
        // 解析失败：退回向量排序结果，避免误删候选
        kept = candidates.slice(0, RERANK_TOP_N);
      } else if (parsed.length === 0) {
        // 模型判定无相关片段：返回空，让模型用自身知识回答
        kept = [];
      } else {
        kept = parsed
          .map((index) => candidates[index - 1])
          .filter((chunk): chunk is Omit<RetrievedChunk, 'similarity'> => Boolean(chunk))
          .slice(0, RERANK_TOP_N);
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

  private async generate(state: RagState): Promise<GenerateResult> {
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

    const response = await this.models.chatModel.invoke([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${historySection}知识库片段：\n\n${kbSection}\n\n问题：${state.question}`,
      },
    ]);

    const parsed = this.parseModelResponse(response.text, externalLimit);
    return parsed;
  }

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
