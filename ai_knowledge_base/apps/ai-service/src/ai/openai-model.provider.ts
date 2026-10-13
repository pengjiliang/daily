/**
 * 模型提供方：按用户懒创建并缓存对话模型（chatModel）与向量模型（embeddings），
 * 配置指纹变化时自动重建——用户在设置页修改配置后无需重启即可生效。
 * - 对话模型：支持 OpenAI 兼容协议（含火山方舟/豆包）与 Anthropic 原生协议（fetch 实现）；
 * - 向量模型：始终使用 OpenAI 兼容 Embeddings（Anthropic 不提供 Embedding 服务）。
 */
import { Injectable } from '@nestjs/common';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { UserSettingsService, type EffectiveSettings } from '../settings/user-settings.service.js';

/** 模型消息：系统/用户/助手三种角色的纯文本消息（兼容 OpenAI 与 Anthropic 两种协议） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 对话模型统一接口：invoke 一次性返回 { text }；stream 逐块返回 { content } */
export interface ChatModelLike {
  invoke(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<{ text: string; usage?: ModelTokenUsage }>;
  stream(
    messages: ChatMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<AsyncIterable<{ content: string | string[]; usage?: ModelTokenUsage }>>;
}

export interface ModelTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
}

/** 缓存条目：按指纹判断配置是否变化，变化时重建实例 */
interface CachedEntry<T> {
  fingerprint: string;
  instance: T;
}

@Injectable()
export class ModelProvider {
  private readonly chatModels = new Map<number, CachedEntry<ChatModelLike>>();
  private readonly embeddingsCache = new Map<number, CachedEntry<MeteredOpenAIEmbeddings>>();

  constructor(private readonly userSettings: UserSettingsService) {}

  /** 用临时配置发起最小请求，不改变用户已保存设置。 */
  async testChat(
    provider: 'openai' | 'anthropic',
    config: { baseUrl: string; apiKey: string; chatModel: string },
    temperature: number,
  ): Promise<{ usage?: ModelTokenUsage }> {
    const model = provider === 'anthropic'
      ? new AnthropicChatModel(config, temperature)
      : createOpenAiChatModel(config, temperature);
    const result = await model.invoke([{ role: 'user', content: 'Reply with exactly OK.' }], {
      signal: AbortSignal.timeout(20_000),
    });
    return { usage: result.usage };
  }

  /** 用临时配置向量化一段短文本，不改变用户已保存设置。 */
  async testEmbedding(config: { baseUrl: string; apiKey: string; model: string }): Promise<{ promptTokens?: number }> {
    const embeddings = new MeteredOpenAIEmbeddings({
      apiKey: config.apiKey,
      model: config.model,
      configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
    });
    const result = await embeddings.embedQueryWithUsage('connection test');
    return { promptTokens: result.promptTokens };
  }

  /** 取某用户的对话模型：按（提供方+端点+模型+密钥+温度）指纹懒创建缓存 */
  async getChatModel(userId: number): Promise<ChatModelLike> {
    const settings = await this.userSettings.getEffectiveSettings(userId);
    const fingerprint = this.chatFingerprint(settings);
    const cached = this.chatModels.get(userId);
    if (cached && cached.fingerprint === fingerprint) {
      return cached.instance;
    }
    const instance =
      settings.chatProvider === 'anthropic'
        ? new AnthropicChatModel(settings.anthropic, settings.temperature)
        : createOpenAiChatModel(settings.openai, settings.temperature);
    this.chatModels.set(userId, { fingerprint, instance });
    return instance;
  }

  /** 取某用户的向量模型：按（端点+模型+密钥）指纹懒创建缓存 */
  async getEmbeddings(userId: number): Promise<MeteredOpenAIEmbeddings> {
    const settings = await this.userSettings.getEffectiveSettings(userId);
    const fingerprint = `${settings.embedding.baseUrl}|${settings.embedding.model}|${settings.embedding.apiKey}`;
    const cached = this.embeddingsCache.get(userId);
    if (cached && cached.fingerprint === fingerprint) {
      return cached.instance;
    }
    const configuration = settings.embedding.baseUrl ? { baseURL: settings.embedding.baseUrl } : undefined;
    const instance = new MeteredOpenAIEmbeddings({
      apiKey: settings.embedding.apiKey,
      model: settings.embedding.model,
      configuration,
    });
    this.embeddingsCache.set(userId, { fingerprint, instance });
    return instance;
  }

  private chatFingerprint(settings: EffectiveSettings): string {
    if (settings.chatProvider === 'anthropic') {
      return `anthropic|${settings.anthropic.baseUrl}|${settings.anthropic.chatModel}|${settings.anthropic.apiKey}|${settings.temperature}`;
    }
    return `openai|${settings.openai.baseUrl}|${settings.openai.chatModel}|${settings.openai.apiKey}|${settings.temperature}`;
  }
}

/** 构建 OpenAI 兼容协议对话模型（含火山方舟/豆包等网关），统一包装为 ChatModelLike */
function createOpenAiChatModel(
  config: { baseUrl: string; apiKey: string; chatModel: string },
  temperature: number,
): ChatModelLike {
  const configuration = config.baseUrl ? { baseURL: config.baseUrl } : undefined;
  const model = new ChatOpenAI({
    apiKey: config.apiKey,
    model: config.chatModel,
    temperature,
    configuration,
    // 部分网关需显式走 chat completions 通道
    modelName: config.chatModel,
  });
  return {
    async invoke(messages, options) {
      const response = await model.invoke(toLangChainMessages(messages), options);
      return {
        text: response.text,
        usage: response.usage_metadata
          ? { input_tokens: response.usage_metadata.input_tokens, output_tokens: response.usage_metadata.output_tokens }
          : undefined,
      };
    },
    async stream(messages, options) {
      const stream = await model.stream(toLangChainMessages(messages), options);
      return (async function* () {
        for await (const chunk of stream) {
          yield {
            content: chunk.content as string | string[],
            usage: chunk.usage_metadata
              ? { input_tokens: chunk.usage_metadata.input_tokens, output_tokens: chunk.usage_metadata.output_tokens }
              : undefined,
          };
        }
      })();
    },
  };
}

function toLangChainMessages(messages: ChatMessage[]) {
  return messages.map(({ role, content }) =>
    role === 'system' ? new SystemMessage(content) : role === 'assistant' ? new AIMessage(content) : new HumanMessage(content),
  );
}

/**
 * Anthropic 原生协议对话客户端（fetch 实现，无需额外 SDK）：
 * 系统消息拆到顶层 system 字段，其余归入 messages；流式解析 SSE 的 content_block_delta。
 */
class AnthropicChatModel implements ChatModelLike {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly temperature: number;
  private readonly maxTokens = 4096;

  constructor(
    config: { baseUrl: string; apiKey: string; chatModel: string },
    temperature: number,
  ) {
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1/messages';
    this.model = config.chatModel || 'claude-3-5-sonnet-20241022';
    this.apiKey = config.apiKey;
    this.temperature = temperature;
  }

  async invoke(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<{ text: string; usage?: ModelTokenUsage }> {
    const response = await this.request(messages, false, options?.signal);
    if (!response.ok) {
      throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).map((block) => block.text ?? '').join('');
    return { text, usage: { input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens } };
  }

  async stream(
    messages: ChatMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<AsyncIterable<{ content: string | string[]; usage?: ModelTokenUsage }>> {
    const response = await this.request(messages, true, options?.signal);
    if (!response.ok) {
      throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
    }
    if (!response.body) {
      throw new Error('Anthropic stream response has no body');
    }
    return this.readSse(response.body, options?.signal);
  }

  private request(messages: ChatMessage[], stream: boolean, signal?: AbortSignal): Promise<Response> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const nonSystem = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: nonSystem,
      stream,
    };
    if (system) {
      body.system = system;
    }
    return fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    });
  }

  /** 解析 Anthropic SSE 流：只取 content_block_delta（text_delta）事件里的增量文本 */
  private async *readSse(
    body: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncGenerator<{ content: string; usage?: ModelTokenUsage }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        if (signal?.aborted) {
          break;
        }
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let separator: number;
        while ((separator = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) {
            continue;
          }
          let data: {
            type?: string;
            delta?: { type?: string; text?: string };
            message?: { usage?: { input_tokens?: number } };
            usage?: { output_tokens?: number };
          };
          try {
            data = JSON.parse(dataLine.slice(5).trim()) as typeof data;
          } catch {
            continue;
          }
          if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta' && data.delta.text) {
            yield { content: data.delta.text };
          } else if (data.type === 'message_start' && data.message?.usage?.input_tokens !== undefined) {
            yield { content: '', usage: { input_tokens: data.message.usage.input_tokens } };
          } else if (data.type === 'message_delta' && data.usage?.output_tokens !== undefined) {
            yield { content: '', usage: { output_tokens: data.usage.output_tokens } };
          }
        }
      }
    } catch {
      // 上游被 abort 时 read 会抛错：直接结束流即可
    }
  }
}

/** Embeddings 客户端，直接保留 API 响应返回的 prompt token 数。 */
export class MeteredOpenAIEmbeddings extends OpenAIEmbeddings {
  constructor(fields: ConstructorParameters<typeof OpenAIEmbeddings>[0]) {
    super(fields);
  }

  async embedQueryWithUsage(text: string): Promise<{ embedding: number[]; promptTokens?: number }> {
    const input = this.stripNewLines ? text.replace(/\n/g, ' ') : text;
    const params: { model: string; input: string; dimensions?: number; encoding_format?: 'float' | 'base64' } = {
      model: this.model,
      input,
    };
    if (this.dimensions) params.dimensions = this.dimensions;
    if (this.encodingFormat) params.encoding_format = this.encodingFormat;
    const response = await this.embeddingWithRetry(params);
    return { embedding: response.data[0].embedding, promptTokens: response.usage?.prompt_tokens };
  }

  async embedDocumentsWithUsage(texts: string[]): Promise<{ embeddings: number[][]; promptTokens?: number }> {
    const batches: string[][] = [];
    const normalized = this.stripNewLines ? texts.map((text) => text.replace(/\n/g, ' ')) : texts;
    for (let i = 0; i < normalized.length; i += this.batchSize) batches.push(normalized.slice(i, i + this.batchSize));
    const responses = await Promise.all(
      batches.map((input) => {
        const params: { model: string; input: string[]; dimensions?: number; encoding_format?: 'float' | 'base64' } = {
          model: this.model,
          input,
        };
        if (this.dimensions) params.dimensions = this.dimensions;
        if (this.encodingFormat) params.encoding_format = this.encodingFormat;
        return this.embeddingWithRetry(params);
      }),
    );
    return {
      embeddings: responses.flatMap((response) => response.data.map((item) => item.embedding)),
      promptTokens: responses.every((response) => response.usage?.prompt_tokens !== undefined)
        ? responses.reduce((total, response) => total + (response.usage?.prompt_tokens ?? 0), 0)
        : undefined,
    };
  }

  override async embedQuery(text: string): Promise<number[]> {
    return (await this.embedQueryWithUsage(text)).embedding;
  }

  override async embedDocuments(texts: string[]): Promise<number[][]> {
    return (await this.embedDocumentsWithUsage(texts)).embeddings;
  }
}
