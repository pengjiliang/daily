/**
 * 聊天服务：会话与消息的持久化（归属校验 + 级联删除），以及问答的流式转发。
 * 发送消息时先落库用户提问、取最近 10 条历史，再调用 ai-service 的 SSE 接口：
 * 逐帧解析 sources/token/done/error 并通过回调透传给控制器，同时累积完整回答落库；
 * 客户端中途断开时中止上游请求，但仍尽力保存已生成的部分回答。
 */
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { Message } from './message.entity.js';
import type { AskResult, RetrievedChunk } from '@ai-knowledge-base/shared';

// 跨端共享类型：定义见 packages/shared
export type AskAnswer = AskResult;

/** 会话主题描述最大长度（超出截断加省略号） */
const CONVERSATION_TITLE_MAX_LENGTH = 20;

/** 由消息正文生成会话主题描述：压缩连续空白，超长截断加省略号 */
function buildConversationTitle(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= CONVERSATION_TITLE_MAX_LENGTH) {
    return compact;
  }
  return `${compact.slice(0, CONVERSATION_TITLE_MAX_LENGTH)}…`;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly configService: ConfigService,
  ) {}

  /** 创建一个默认标题的空会话 */
  createConversation(userId: number): Promise<Conversation> {
    return this.conversationsRepository.save(this.conversationsRepository.create({ userId }));
  }

  /** 当前用户的会话列表（按最近更新时间倒序），每条附带主题描述 title：手动重命名优先，否则取首条用户消息前 20 字 */
  async listConversations(userId: number): Promise<(Conversation & { title: string })[]> {
    const conversations = await this.conversationsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    if (conversations.length === 0) {
      return [];
    }

    // 联查每个会话的第一条用户消息（DISTINCT ON 每组取最小 id），生成会话主题描述
    const rows: { conversationId: number; content: string }[] = await this.messagesRepository
      .createQueryBuilder('message')
      .select('DISTINCT ON (message."conversationId") message."conversationId" AS "conversationId"')
      .addSelect('message.content AS content')
      .where('message."conversationId" IN (:...ids)', { ids: conversations.map((c) => c.id) })
      .andWhere("message.role = 'user'")
      .orderBy('message."conversationId"', 'ASC')
      .addOrderBy('message.id', 'ASC')
      .getRawMany();

    const autoTitleByConversationId = new Map<number, string>();
    for (const row of rows) {
      autoTitleByConversationId.set(row.conversationId, buildConversationTitle(row.content));
    }

    return conversations.map((conversation) => {
      // 手动重命名过（title 不再是默认"新对话"）则优先用手动标题；否则用自动主题描述
      const manualTitle = conversation.title !== '新对话' ? conversation.title : null;
      return {
        ...conversation,
        title: manualTitle ?? autoTitleByConversationId.get(conversation.id) ?? '新对话',
      };
    });
  }

  /** 手动重命名会话：校验归属后更新 title（非默认值即视为手动标题，列表展示时优先） */
  async renameConversation(id: number, userId: number, title: string): Promise<Conversation> {
    const conversation = await this.findOwnedConversation(id, userId);
    const name = title.trim();
    if (!name) {
      throw new BadRequestException('会话标题不能为空');
    }
    if (name.length > 60) {
      throw new BadRequestException('会话标题过长（最多 60 字符）');
    }
    conversation.title = name;
    return this.conversationsRepository.save(conversation);
  }

  /** 删除会话：先删全部消息再删会话（归属不匹配时 findOwnedConversation 直接抛错） */
  async removeConversation(id: number, userId: number): Promise<void> {
    const conversation = await this.findOwnedConversation(id, userId);
    await this.messagesRepository.delete({ conversationId: conversation.id });
    await this.conversationsRepository.remove(conversation);
  }

  /** 查询会话消息（按 id 正序还原对话），含归属校验 */
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

    // 刷新会话的 updatedAt：会话列表按此排序并显示更新时间（@UpdateDateColumn 自动写入）
    await this.conversationsRepository.save({ id: conversation.id, updatedAt: new Date() });

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
      const result = await this.askStream(content, conversation.id, userId, history, callbacks, clientSignal);
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
    userId: number,
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
          // 检索按用户隔离：ai-service 只查询该用户上传的文档分块
          userId,
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

  /**
   * 解析单个 SSE 帧：形如「event: token\\ndata: "..."」。
   * 多行 data 按规范以 \\n 拼接后尝试 JSON.parse；解析失败则原样作为字符串返回。
   * 没有任何 data 行的帧（如注释行）返回 null。
   */
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

  /** 按 id 取会话并校验归属：不存在抛 404，属于他人抛 403 */
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

  /** 旧版一次性问答调用（POST /ai/ask，非流式），当前流式链路已不使用，保留备用 */
  private async ask(question: string, conversationId: number, userId: number, history: Message[]): Promise<AskAnswer> {
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
          // 检索按用户隔离：ai-service 只查询该用户上传的文档分块
          userId,
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
