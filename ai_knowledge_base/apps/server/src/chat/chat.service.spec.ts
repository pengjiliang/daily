import { BadGatewayException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service.js';
import { Conversation } from './conversation.entity.js';
import { Message } from './message.entity.js';

describe('ChatService', () => {
  let service: ChatService;
  let conversations: Conversation[];
  let messages: Message[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    conversations = [{ id: 1, userId: 10, title: '新对话', createdAt: new Date(), updatedAt: new Date() }];
    messages = [];

    const conversationsRepository = {
      create: (input: Partial<Conversation>) => ({ id: 2, title: '新对话', ...input }),
      save: async (input: Conversation) => {
        conversations.push(input);
        return input;
      },
      find: async () => conversations,
      findOneBy: async ({ id }: { id: number }) => conversations.find((item) => item.id === id) ?? null,
      remove: async (input: Conversation) => {
        conversations = conversations.filter((item) => item.id !== input.id);
        return input;
      },
      update: async () => ({ affected: 1 }),
    };

    const messagesRepository = {
      create: (input: Partial<Message>) => ({ id: messages.length + 1, ...input }),
      save: async (input: Message) => {
        messages.push(input);
        return input;
      },
      find: async () => messages,
      delete: async () => ({ affected: messages.length }),
    };

    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ answer: 'pgvector 用于相似度检索。', sources: [{ chunkId: 1 }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Conversation), useValue: conversationsRepository },
        { provide: getRepositoryToken(Message), useValue: messagesRepository },
        { provide: ConfigService, useValue: { get: () => 'http://ai.test' } },
      ],
    }).compile();

    service = moduleRef.get(ChatService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a conversation with the default title', async () => {
    const conversation = await service.createConversation(10);
    expect(conversation).toMatchObject({ userId: 10, title: '新对话' });
  });

  it('saves the user message, calls ai-service and saves the assistant message', async () => {
    const result = await service.sendMessage(1, 10, 'pgvector 有什么用？');

    expect(fetchMock).toHaveBeenCalledWith('http://ai.test/ai/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: 'pgvector 有什么用？',
        conversationId: '1',
        history: [{ role: 'user', content: 'pgvector 有什么用？' }],
      }),
    });
    expect(result.answer).toBe('pgvector 用于相似度检索。');
    expect(result.sources).toEqual([{ chunkId: 1 }]);
    expect(messages).toEqual([
      expect.objectContaining({ conversationId: 1, role: 'user', content: 'pgvector 有什么用？' }),
      expect.objectContaining({
        conversationId: 1,
        role: 'assistant',
        content: 'pgvector 用于相似度检索。',
        sources: [{ chunkId: 1 }],
      }),
    ]);
  });

  it('rejects access to a conversation owned by another user', async () => {
    await expect(service.listMessages(1, 99)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when the conversation does not exist', async () => {
    await expect(service.listMessages(404, 10)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the conversation and its messages', async () => {
    await service.removeConversation(1, 10);
    expect(conversations).toHaveLength(0);
  });

  it('reports a bad gateway when ai-service fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(service.sendMessage(1, 10, 'hi')).rejects.toBeInstanceOf(BadGatewayException);
  });
});
