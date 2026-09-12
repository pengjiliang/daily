import { BadGatewayException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { Message } from './message.entity.js';
import type { AskResult, RetrievedChunk } from '@ai-knowledge-base/shared';

// 跨端共享类型：定义见 packages/shared
export type AskAnswer = AskResult;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly configService: ConfigService,
  ) {}

  createConversation(userId: number): Promise<Conversation> {
    return this.conversationsRepository.save(this.conversationsRepository.create({ userId }));
  }

  listConversations(userId: number): Promise<Conversation[]> {
    return this.conversationsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async removeConversation(id: number, userId: number): Promise<void> {
    const conversation = await this.findOwnedConversation(id, userId);
    await this.messagesRepository.delete({ conversationId: conversation.id });
    await this.conversationsRepository.remove(conversation);
  }

  async listMessages(id: number, userId: number): Promise<Message[]> {
    const conversation = await this.findOwnedConversation(id, userId);
    return this.messagesRepository.find({
      where: { conversationId: conversation.id },
      order: { id: 'ASC' },
    });
  }

  /**
   * 流式发送消息：持久化用户提问后，调用 ai-service 的 SSE 接口并把事件透传给客户端。
   * onSources：检索到的知识库/外部资料；onToken：回答增量片段。
   * 流结束后持久化完整 AI 回答。客户端断开时中止上游并尽力保存已生成内容。
   */
  async sendMessageStream(
    id: number,
    userId: number,
    content: string,
    callbacks: {
      onSources: (sources: RetrievedChunk[]) => void | Promise<void>;
      onToken: (token: string) => void | Promise<void>;
    },
    clientSignal?: AbortSignal,
  ): Promise<{ answer: string; sources: RetrievedChunk[]; message: Message | null }> {
    const conversation = await this.findOwnedConversation(id, userId);
    await this.messagesRepository.save(
      this.messagesRepository.create({
        conversationId: conversation.id,
        role: 'user',
        content,
      }),
    );

    // 读取最近10轮对话历史传给ai-service
    const history = await this.messagesRepository.find({
      where: { conversationId: conversation.id },
      order: { id: 'ASC' },
      take: 10,
    });

    let answer = '';
    let sources: RetrievedChunk[] = [];
    let message: Message | null = null;
    let clientAborted = false;

    try {
      const result = await this.askStream(content, conversation.id, history, callbacks, clientSignal);
      answer = result.answer;
      sources = result.sources;
    } catch (error) {
      // 客户端主动断开：尽力保存已流式生成的部分回答，不再向上抛
      if (clientSignal?.aborted) {
        clientAborted = true;
      } else {
        throw error;
      }
    }

    if (answer.trim()) {
      message = await this.messagesRepository.save(
        this.messagesRepository.create({
          conversationId: conversation.id,
          role: 'assistant',
          content: answer,
          sources,
        }),
      );
      await this.conversationsRepository.update(conversation.id, {
        updatedAt: new Date(),
      });
    }

    if (clientAborted) {
      return { answer, sources, message };
    }
    return { answer, sources, message };
  }

  /**
   * 以 SSE 方式调用 ai-service：解析上游帧并透传，同时累积完整答案与来源。
   * 采用空闲超时（每收到一个数据块就重置），替代固定总时长超时，避免误杀长回答。
   */
  private async askStream(
    question: string,
    conversationId: number,
    history: Message[],
    callbacks: {
      onSources: (sources: RetrievedChunk[]) => void | Promise<void>;
      onToken: (token: string) => void | Promise<void>;
    },
    clientSignal?: AbortSignal,
  ): Promise<AskAnswer> {
    const aiServiceUrl = this.configService.get<string>('aiService.url', 'http://localhost:3001');

    const upstreamController = new AbortController();
    const abortUpstream = () => upstreamController.abort();
    clientSignal?.addEventListener('abort', abortUpstream, { once: true });

    // 空闲超时：90s 内没有任何数据则中止；正常 token 流会持续重置计时
    let timeoutId: NodeJS.Timeout | undefined;
    const resetIdleTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(abortUpstream, 90000);
    };

    let response: Response;
    try {
      resetIdleTimeout();
      response = await fetch(`${aiServiceUrl}/ai/ask/stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question,
          conversationId: String(conversationId),
          history: history.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
        signal: upstreamController.signal,
      });
    } catch (error) {
      throw new BadGatewayException(`AI service is unreachable: ${String(error)}`);
    }

    if (!response.ok || !response.body) {
      throw new BadGatewayException(`AI service responded with ${response.status}`);
    }

    let answer = '';
    let sources: RetrievedChunk[] = [];
    let buffer = '';
    const decoder = new TextDecoder();

    try {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        resetIdleTimeout();
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex: number;
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawFrame = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const frame = this.parseSseFrame(rawFrame);
          if (!frame) continue;

          if (frame.event === 'sources') {
            const list = (Array.isArray(frame.data) ? frame.data : []) as RetrievedChunk[];
            sources = list;
            await callbacks.onSources(list);
          } else if (frame.event === 'token') {
            const token = typeof frame.data === 'string' ? frame.data : '';
            if (token) {
              answer += token;
              await callbacks.onToken(token);
            }
          } else if (frame.event === 'done') {
            const data = (frame.data ?? {}) as Partial<AskAnswer>;
            answer = typeof data.answer === 'string' && data.answer ? data.answer : answer;
            sources = Array.isArray(data.sources) ? data.sources : sources;
          } else if (frame.event === 'error') {
            const message =
              frame.data && typeof frame.data === 'object' && 'message' in frame.data
                ? String((frame.data as { message: unknown }).message)
                : 'AI service error';
            throw new BadGatewayException(message);
          }
        }
      }
    } catch (error) {
      // 客户端断开导致上游中止：保留已累积的部分回答并正常返回（尽力保存已生成内容）；
      // 其余错误（如超时中止、上游异常）继续向上抛出。
      if (!clientSignal?.aborted) {
        throw error;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      clientSignal?.removeEventListener('abort', abortUpstream);
    }

    return { answer, sources };
  }

  private parseSseFrame(rawFrame: string): { event: string; data: unknown } | null {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of rawFrame.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) {
      return null;
    }
    try {
      return { event, data: JSON.parse(dataLines.join('\n')) as unknown };
    } catch {
      return { event, data: dataLines.join('\n') };
    }
  }

  private async findOwnedConversation(id: number, userId: number): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOneBy({ id });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.userId !== userId) {
      throw new ForbiddenException('You can only access your own conversations');
    }
    return conversation;
  }

  private async ask(question: string, conversationId: number, history: Message[]): Promise<AskAnswer> {
    const aiServiceUrl = this.configService.get<string>('aiService.url', 'http://localhost:3001');

    // 兜底超时：比前端发送消息的超时（180s）略长，避免上游挂起导致请求永久等待
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 185000);

    let response: Response;
    try {
      response = await fetch(`${aiServiceUrl}/ai/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question,
          conversationId: String(conversationId),
          history: history.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new BadGatewayException(`AI service is unreachable: ${String(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new BadGatewayException(`AI service responded with ${response.status}`);
    }

    const body = (await response.json()) as Partial<AskAnswer>;
    return { answer: body.answer ?? '', sources: body.sources ?? [] };
  }
}
