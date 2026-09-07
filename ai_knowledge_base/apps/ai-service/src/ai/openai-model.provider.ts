import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class OpenAIModelProvider {
  readonly embeddings: OpenAIEmbeddings;
  readonly chatModel: ChatOpenAI;

  constructor(configService: ConfigService) {
    const apiKey = configService.getOrThrow<string>('openai.apiKey');
    const baseUrl = configService.get<string>('openai.baseUrl');
    const configuration = baseUrl ? { baseURL: baseUrl } : undefined;

    this.embeddings = new OpenAIEmbeddings({
      apiKey,
      model: configService.getOrThrow<string>('openai.embeddingModel'),
      configuration,
    });
    this.chatModel = new ChatOpenAI({
      apiKey,
      model: configService.getOrThrow<string>('openai.chatModel'),
      temperature: 0,
      configuration,
      // For Volcano Engine Doubao, explicitly use chat completions
      modelName: configService.getOrThrow<string>('openai.chatModel'),
    });
  }
}
