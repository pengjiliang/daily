/**
 * 基于 LangGraph StateGraph 的 RAG 编排图（供旧版一次性问答 ask() 使用）。
 * 定义贯穿流程的共享状态（问题、历史、知识库上下文、外部资料、答案），
 * 流程固定为 retrieve（检索）→ generate（生成）两步，具体实现由依赖注入解耦。
 */
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { RetrievedChunk, SourceType } from '@ai-knowledge-base/shared';

// 跨端共享类型：定义见 packages/shared，此处仅转发，保持本地导入路径不变
export type { RetrievedChunk, SourceType } from '@ai-knowledge-base/shared';

/** 图的共享状态结构：每个节点返回其中一部分字段作为状态增量 */
export const RagStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  history: Annotation<string>,
  context: Annotation<RetrievedChunk[]>,
  externalSources: Annotation<RetrievedChunk[]>,
  answer: Annotation<string>,
});

export type RagState = typeof RagStateAnnotation.State;

/** generate 节点的返回：答案正文与外部资料列表 */
export interface GenerateResult {
  answer: string;
  externalSources: RetrievedChunk[];
}

/** 图依赖：retrieve/generate 由 AskService 提供，便于测试替换 */
export interface RagGraphDependencies {
  retrieve: (question: string) => Promise<RetrievedChunk[]>;
  generate: (state: RagState) => Promise<GenerateResult>;
}

/**
 * 混合 RAG：始终先检索知识库，再生成答案——答案可结合知识库片段与模型自身知识。
 */
export function createRagGraph(dependencies: RagGraphDependencies) {
  return new StateGraph(RagStateAnnotation)
    // 检索节点：把知识库命中片段写入 context
    .addNode('retrieve', async (state: RagState) => ({
      context: await dependencies.retrieve(state.question),
    }))
    // 生成节点：基于 context 产出答案与外部资料
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
