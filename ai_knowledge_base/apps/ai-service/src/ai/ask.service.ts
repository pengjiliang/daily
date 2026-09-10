import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import { createRagGraph, type GenerateResult, type RagState, type RetrievedChunk } from './langgraph/rag.graph.js';
import { OpenAIModelProvider } from './openai-model.provider.js';
import { HistoryMessage } from './dto/ai.dto.js';

export const TOP_K = 5;
export const MIN_SCORE = 0.1;
export const EXTERNAL_WITH_KB = 3;
export const EXTERNAL_WITHOUT_KB = 5;

export interface AskRequest {
  question: string;
  conversationId?: string;
  history?: HistoryMessage[];
}

export interface AskResult {
  answer: string;
  sources: RetrievedChunk[];
}

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

  private async retrieve(question: string): Promise<RetrievedChunk[]> {
    const embedding = await this.models.embeddings.embedQuery(question);
    const vectorStr = `[${embedding.join(',')}]`;
    const sql = `SELECT id, "uploadFileId", content, metadata, embedding::vector <=> '${vectorStr}'::vector AS distance
       FROM document_chunks
       ORDER BY embedding::vector <=> '${vectorStr}'::vector
       LIMIT ${TOP_K}`;
    const rows: SimilarityRow[] = await this.documentChunksRepository.query(sql);

    const chunks = rows
      .map((row) => ({
        sourceType: 'knowledge_base' as const,
        chunkId: row.id,
        uploadFileId: row.uploadFileId,
        content: row.content,
        score: 1 - Number(row.distance),
        metadata: row.metadata ?? {},
      }))
      .filter((chunk) => chunk.score > MIN_SCORE);

    const fileChunkMap = new Map<number, (typeof chunks)[0]>();
    chunks.forEach((chunk) => {
      const existing = fileChunkMap.get(chunk.uploadFileId);
      if (!existing || chunk.score > existing.score) {
        fileChunkMap.set(chunk.uploadFileId, chunk);
      }
    });

    return Array.from(fileChunkMap.values()).sort((a, b) => b.score - a.score);
  }

  private async generate(state: RagState): Promise<GenerateResult> {
    const hasKb = state.context.length > 0;
    const externalLimit = hasKb ? EXTERNAL_WITH_KB : EXTERNAL_WITHOUT_KB;
    const historySection = state.history ? `历史对话：\n\n${state.history}\n\n` : '';

    const kbSection = hasKb
      ? state.context
          .map((chunk, index) => `[知识库${index + 1}]（相似度 ${(chunk.score * 100).toFixed(1)}%）：${chunk.content}`)
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
