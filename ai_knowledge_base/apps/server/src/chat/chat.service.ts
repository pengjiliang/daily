import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { Message } from './message.entity.js';

export interface AskAnswer {
  answer: string;
  sources: unknown[];
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

  createConversation(userId: number): Promise<Conversation> {
    return this.conversationsRepository.save(
      this.conversationsRepository.create({ userId }),
    );
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

  async sendMessage(
    id: number,
    userId: number,
    content: string,
  ): Promise<{ answer: string; sources: unknown[]; message: Message }> {
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

    const { answer, sources } = await this.ask(content, conversation.id, history);

    const assistantMessage = await this.messagesRepository.save(
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

    return { answer, sources, message: assistantMessage };
  }

  private async findOwnedConversation(
    id: number,
    userId: number,
  ): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOneBy({ id });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.userId !== userId) {
      throw new ForbiddenException('You can only access your own conversations');
    }
    return conversation;
  }

  private async ask(
    question: string,
    conversationId: number,
    history: Message[],
  ): Promise<AskAnswer> {
    const aiServiceUrl = this.configService.get<string>(
      'aiService.url',
      'http://localhost:3001',
    );

    let response: Response;
    try {
      response = await fetch(`${aiServiceUrl}/ai/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question,
          conversationId: String(conversationId),
          history: history.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });
    } catch (error) {
      throw new BadGatewayException(
        `AI service is unreachable: ${String(error)}`,
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `AI service responded with ${response.status}`,
      );
    }

    const body = (await response.json()) as Partial<AskAnswer>;
    return { answer: body.answer ?? '', sources: body.sources ?? [] };
  }
}
