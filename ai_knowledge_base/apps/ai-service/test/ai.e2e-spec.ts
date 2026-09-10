import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AIController } from '../src/ai/ai.controller.js';
import { AskService } from '../src/ai/ask.service.js';
import { DocumentIndexService } from '../src/ai/document-index.service.js';
import { OpenAIModelProvider } from '../src/ai/openai-model.provider.js';
import { DocumentChunk } from '../src/entities/document-chunk.entity.js';

describe('AIController (e2e)', () => {
  let app: INestApplication<App>;
  let saved: DocumentChunk[];
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ai-e2e-'));
    saved = [];

    const repository = {
      create: (chunk: Partial<DocumentChunk>) => chunk as DocumentChunk,
      save: async (chunks: DocumentChunk[]) => {
        saved.push(...chunks);
        return chunks;
      },
      delete: async () => ({ affected: 0 }),
      query: async () => [
        {
          id: 1,
          uploadFileId: 5,
          content: 'The knowledge base uses pgvector.',
          metadata: { originalName: 'notes.txt' },
          distance: '0.2',
        },
      ],
    };

    const models = {
      embeddings: {
        embedDocuments: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]),
        embedQuery: async () => [0.1, 0.2, 0.3],
      },
      chatModel: {
        invoke: async () => ({ text: 'It uses pgvector. [1]' }),
      },
    };

    const moduleFixture = await Test.createTestingModule({
      controllers: [AIController],
      providers: [
        DocumentIndexService,
        AskService,
        { provide: getRepositoryToken(DocumentChunk), useValue: repository },
        { provide: OpenAIModelProvider, useValue: models },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /ai/index-document indexes a file into DocumentChunk rows', async () => {
    const filePath = join(directory, 'notes.txt');
    await writeFile(filePath, 'The knowledge base uses pgvector for search.', 'utf8');

    const response = await request(app.getHttpServer())
      .post('/ai/index-document')
      .send({
        uploadFileId: 5,
        filePath,
        originalName: 'notes.txt',
        mimeType: 'text/plain',
      })
      .expect(201);

    expect(response.body).toEqual({ uploadFileId: 5, chunks: 1 });
    expect(saved).toHaveLength(1);
    expect(saved[0].uploadFileId).toBe(5);
    expect(saved[0].embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('POST /ai/index-document rejects an invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/ai/index-document')
      .send({ uploadFileId: 'not-a-number', filePath: '', originalName: '', mimeType: '' })
      .expect(400);
  });

  it('POST /ai/ask returns an answer with sources', async () => {
    const response = await request(app.getHttpServer())
      .post('/ai/ask')
      .send({ question: 'What does the knowledge base use?' })
      .expect(201);

    expect(response.body.answer).toBe('It uses pgvector. [1]');
    expect(response.body.sources).toHaveLength(1);
    expect(response.body.sources[0]).toMatchObject({
      chunkId: 1,
      uploadFileId: 5,
      content: 'The knowledge base uses pgvector.',
    });
  });

  it('POST /ai/ask requires a question and rejects unknown fields', async () => {
    await request(app.getHttpServer()).post('/ai/ask').send({}).expect(400);
    await request(app.getHttpServer()).post('/ai/ask').send({ question: 'ok', unexpected: true }).expect(400);
  });

  it('does not require JWT authentication', async () => {
    await request(app.getHttpServer()).post('/ai/ask').send({ question: 'No auth header supplied' }).expect(201);
  });
});
