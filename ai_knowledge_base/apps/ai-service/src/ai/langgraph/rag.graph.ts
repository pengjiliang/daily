import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { RetrievedChunk, SourceType } from '@ai-knowledge-base/shared';

// 跨端共享类型：定义见 packages/shared，此处仅转发，保持本地导入路径不变
export type { RetrievedChunk, SourceType } from '@ai-knowledge-base/shared';

export const RagStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  history: Annotation<string>,
  context: Annotation<RetrievedChunk[]>,
  externalSources: Annotation<RetrievedChunk[]>,
  answer: Annotation<string>,
});

export type RagState = typeof RagStateAnnotation.State;

export interface GenerateResult {
  answer: string;
  externalSources: RetrievedChunk[];
}

export interface RagGraphDependencies {
  retrieve: (question: string) => Promise<RetrievedChunk[]>;
  generate: (state: RagState) => Promise<GenerateResult>;
}

/**
 * Hybrid RAG: always retrieve KB first, then generate an answer that may
 * combine knowledge-base context with the model's own knowledge.
 */
export function createRagGraph(dependencies: RagGraphDependencies) {
  return new StateGraph(RagStateAnnotation)
    .addNode('retrieve', async (state: RagState) => ({
      context: await dependencies.retrieve(state.question),
    }))
    .addNode('generate', async (state: RagState) => {
      const result = await dependencies.generate(state);
      return {
        answer: result.answer,
        externalSources: result.externalSources,
      };
    })
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', END)
    .compile();
}
