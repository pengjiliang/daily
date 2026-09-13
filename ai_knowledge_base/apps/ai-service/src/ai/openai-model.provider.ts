/**
 * 模型工厂：根据配置一次性创建并暴露 LangChain 的向量模型（embeddings）
 * 与对话模型（chatModel），供索引服务与问答服务注入复用。
 * 兼容任何实现 OpenAI Chat Completions / Embeddings 协议的网关（如火山方舟豆包）。
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class OpenAIModelProvider {
  /** 文档切片与问题向量化共用的 Embedding 模型 */
  readonly embeddings: OpenAIEmbeddings;
  /** 对话生成 / LLM 重排 / 查询改写共用的聊天模型 */
  readonly chatModel: ChatOpenAI;

  constructor(configService: ConfigService) {
    const apiKey = configService.getOrThrow<string>('openai.apiKey');
    const baseUrl = configService.get<string>('openai.baseUrl');
    // baseUrl 为空时不传 configuration，由 SDK 使用 OpenAI 官方地址
    const configuration = baseUrl ? { baseURL: baseUrl } : undefined;

    this.embeddings = new OpenAIEmbeddings({
      apiKey,
      model: configService.getOrThrow<string>('openai.embeddingModel'),
      configuration,
    });
    this.chatModel = new ChatOpenAI({
      apiKey,
      model: configService.getOrThrow<string>('openai.chatModel'),
      temperature: 0, // 检索/问答类任务要求稳定确定的输出
      configuration,
      // For Volcano Engine Doubao, explicitly use chat completions
      modelName: configService.getOrThrow<string>('openai.chatModel'),
    });
  }
}
