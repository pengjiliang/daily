import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { ChatController } from '../src/chat/chat.controller.js';
import { ChatService } from '../src/chat/chat.service.js';
import { Conversation } from '../src/chat/conversation.entity.js';
import { Message } from '../src/chat/message.entity.js';

const SECRET = 'test_secret';

describe('ChatController (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let conversations: Conversation[];
  let messages: Message[];

  beforeAll(async () => {
    conversations = [];
    messages = [];

    const conversationsRepository = {
      create: (input: Partial<Conversation>) => ({
        id: conversations.length + 1,
        title: '新对话',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      }),
      save: async (input: Conversation) => {
        conversations.push(input);
        return input;
      },
      find: async ({ where }: { where: { userId: number } }) =>
        conversations.filter((item) => item.userId === where.userId),
      findOneBy: async ({ id }: { id: number }) =>
        conversations.find((item) => item.id === id) ?? null,
      remove: async (input: Conversation) => input,
      update: async () => ({ affected: 1 }),
    };

    const messagesRepository = {
      create: (input: Partial<Message>) => ({
        id: messages.length + 1,
        createdAt: new Date(),
        ...input,
      }),
      save: async (input: Message) => {
        messages.push(input);
        return input;
      },
      find: async ({ where }: { where: { conversationId: number } }) =>
        messages.filter((item) => item.conversationId === where.conversationId),
      delete: async () => ({ affected: 0 }),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          answer: '知识库使用 pgvector 做相似度检索。',
          sources: [{ chunkId: 1, uploadFileId: 5 }],
        }),
      })),
    );

    const configService = {
      get: () => 'http://ai.test',
      getOrThrow: () => SECRET,
    };

    const moduleFixture = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: SECRET })],
      controllers: [ChatController],
      providers: [
        ChatService,
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(Conversation), useValue: conversationsRepository },
        { provide: getRepositoryToken(Message), useValue: messagesRepository },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    token = moduleFixture
      .get(JwtService)
      .sign({ sub: 10, email: 'owner@example.com' });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  it('rejects requests without a JWT', async () => {
    await request(app.getHttpServer()).get('/chat/conversations').expect(401);
  });

  it('POST /chat/conversations creates a conversation for the token owner', async () => {
    const response = await request(app.getHttpServer())
      .post('/chat/conversations')
      .set('authorization', `Bearer ${token}`)
      .expect(201);

    expect(response.body).toMatchObject({ id: 1, userId: 10, title: '新对话' });
  });

  it('GET /chat/conversations lists the conversations of the current user', async () => {
    const response = await request(app.getHttpServer())
      .get('/chat/conversations')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
  });

  it('POST /chat/conversations/:id/messages stores both messages and returns the answer', async () => {
    const response = await request(app.getHttpServer())
      .post('/chat/conversations/1/messages')
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'pgvector 有什么用？' })
      .expect(201);

    expect(response.body.answer).toBe('知识库使用 pgvector 做相似度检索。');
    expect(response.body.sources).toEqual([{ chunkId: 1, uploadFileId: 5 }]);
    expect(messages).toHaveLength(2);
  });

  it('GET /chat/conversations/:id/messages returns the message list', async () => {
    const response = await request(app.getHttpServer())
      .get('/chat/conversations/1/messages')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.map((item: Message) => item.role)).toEqual(['user', 'assistant']);
  });

  it('rejects an empty message body', async () => {
    await request(app.getHttpServer())
      .post('/chat/conversations/1/messages')
      .set('authorization', `Bearer ${token}`)
      .send({ content: '' })
      .expect(400);
  });

  it('DELETE /chat/conversations/:id removes the conversation', async () => {
    const response = await request(app.getHttpServer())
      .delete('/chat/conversations/1')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ deleted: true });
  });
});