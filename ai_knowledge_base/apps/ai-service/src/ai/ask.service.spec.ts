import type { Repository } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import { AskService, EXTERNAL_WITH_KB, EXTERNAL_WITHOUT_KB, TOP_K } from './ask.service.js';
import type { OpenAIModelProvider } from './openai-model.provider.js';

interface QueryCall {
  sql: string;
}

function createHarness(rows: unknown[], modelText: string) {
  const queries: QueryCall[] = [];
  const repository = {
    query: async (sql: string) => {
      queries.push({ sql });
      return rows;
    },
  } as unknown as Repository<DocumentChunk>;

  const prompts: unknown[][] = [];
  const models = {
    embeddings: {
      embedQuery: async () => [0.1, 0.2, 0.3],
    },
    chatModel: {
      invoke: async (messages: unknown[]) => {
        prompts.push(messages);
        return { text: modelText };
      },
    },
  } as unknown as OpenAIModelProvider;

  return { queries, prompts, service: new AskService(repository, models) };
}

const row = {
  id: 11,
  uploadFileId: 3,
  content: 'pgvector stores embeddings.',
  metadata: { originalName: 'doc.txt', chunkIndex: 0 },
  distance: '0.25',
};

describe('AskService', () => {
  it('prioritizes KB sources and appends up to 3 external sources', async () => {
    const modelText = JSON.stringify({
      answer: '【知识库】pgvector 用于存储向量。[知识库1]\n【补充知识】它常用于 RAG。',
      externalSources: [
        { title: '向量库', content: '向量数据库适合相似度检索', score: 0.9 },
        { title: 'RAG', content: '检索增强生成依赖向量检索', score: 0.8 },
        { title: 'Embedding', content: '文本可转为向量', score: 0.7 },
        { title: '多余', content: '不应出现', score: 0.6 },
      ],
    });
    const harness = createHarness([row], modelText);
    const result = await harness.service.ask({ question: 'What stores embeddings?' });

    expect(harness.queries).toHaveLength(1);
    expect(harness.queries[0].sql).toContain('ORDER BY');
    expect(harness.queries[0].sql).toContain(`LIMIT ${TOP_K}`);
    expect(EXTERNAL_WITH_KB).toBe(3);

    expect(result.answer).toContain('【知识库】');
    expect(result.sources[0]).toMatchObject({
      sourceType: 'knowledge_base',
      chunkId: 11,
      uploadFileId: 3,
      score: 0.75,
    });
    expect(result.sources.filter((s) => s.sourceType === 'external')).toHaveLength(3);
    expect(result.sources.map((s) => s.sourceType)).toEqual(['knowledge_base', 'external', 'external', 'external']);
  });

  it('uses model knowledge with top 5 external sources when KB is empty', async () => {
    const modelText = JSON.stringify({
      answer: '这是模型自身知识的回答。',
      externalSources: [
        { title: 'a', content: 'c1', score: 0.95 },
        { title: 'b', content: 'c2', score: 0.9 },
        { title: 'c', content: 'c3', score: 0.85 },
        { title: 'd', content: 'c4', score: 0.8 },
        { title: 'e', content: 'c5', score: 0.7 },
        { title: 'f', content: 'c6', score: 0.6 },
      ],
    });
    const harness = createHarness([], modelText);
    const result = await harness.service.ask({ question: 'Unindexed topic?' });

    expect(EXTERNAL_WITHOUT_KB).toBe(5);
    expect(result.answer).toBe('这是模型自身知识的回答。');
    expect(result.sources).toHaveLength(5);
    expect(result.sources.every((s) => s.sourceType === 'external')).toBe(true);
    expect(result.sources[0].score).toBeGreaterThanOrEqual(result.sources[4].score);
    expect(harness.prompts).toHaveLength(1);
  });

  it('asks the model to prioritize KB then supplement own knowledge', async () => {
    const modelText = JSON.stringify({
      answer: 'ok',
      externalSources: [],
    });
    const harness = createHarness([row], modelText);
    await harness.service.ask({ question: 'What stores embeddings?' });

    const systemMessage = harness.prompts[0][0] as { content: string };
    const userMessage = harness.prompts[0][1] as { content: string };
    expect(systemMessage.content).toContain('优先使用知识库');
    expect(systemMessage.content).toContain('补充知识');
    expect(userMessage.content).toContain('[知识库1]');
    expect(userMessage.content).toContain('pgvector stores embeddings.');
    expect(userMessage.content).toContain('问题：What stores embeddings?');
  });
});
