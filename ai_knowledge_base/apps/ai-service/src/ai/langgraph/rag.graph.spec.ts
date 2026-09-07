import {
  createRagGraph,
  type RetrievedChunk,
} from './rag.graph.js';

const chunk: RetrievedChunk = {
  sourceType: 'knowledge_base',
  chunkId: 1,
  uploadFileId: 2,
  content: 'pgvector stores embeddings.',
  score: 0.9,
  metadata: {},
};

describe('rag graph', () => {
  it('always generates after retrieve when context exists', async () => {
    const seen: string[] = [];
    const graph = createRagGraph({
      retrieve: async (question) => {
        seen.push(question);
        return [chunk];
      },
      generate: async (state) => ({
        answer: `answer from ${state.context.length} chunk(s)`,
        externalSources: [],
      }),
    });

    const result = await graph.invoke({
      question: 'What stores embeddings?',
      history: '',
      context: [],
      externalSources: [],
      answer: '',
    });

    expect(seen).toEqual(['What stores embeddings?']);
    expect(result.answer).toBe('answer from 1 chunk(s)');
    expect(result.context).toEqual([chunk]);
  });

  it('still generates from model knowledge when retrieval is empty', async () => {
    let generateCalls = 0;
    const external: RetrievedChunk = {
      sourceType: 'external',
      chunkId: null,
      uploadFileId: null,
      content: 'model knowledge snippet',
      score: 0.8,
      metadata: { title: '外部资料 1' },
    };

    const graph = createRagGraph({
      retrieve: async () => [],
      generate: async () => {
        generateCalls += 1;
        return {
          answer: 'answer from model knowledge',
          externalSources: [external],
        };
      },
    });

    const result = await graph.invoke({
      question: 'unknown topic',
      history: '',
      context: [],
      externalSources: [],
      answer: '',
    });

    expect(generateCalls).toBe(1);
    expect(result.answer).toBe('answer from model knowledge');
    expect(result.externalSources).toEqual([external]);
    expect(result.context).toEqual([]);
  });
});
