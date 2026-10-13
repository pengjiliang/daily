/**
 * 评估看板接口（亮点 3：RAG 评估与回归看板）。
 */
import request from './request';
import type { EvalCase, EvalComparisonView, EvalRun, EvalRunConfig, EvalRunView, EvalSet } from '@ai-knowledge-base/shared';

export const evalApi = {
  listSets() {
    return request.get<(EvalSet & { caseCount: number })[]>('/eval/sets');
  },
  createSet(name: string, description?: string) {
    return request.post<EvalSet>('/eval/sets', { name, description });
  },
  getSet(id: number) {
    return request.get<EvalSet & { cases: EvalCase[] }>('/eval/sets/' + id);
  },
  deleteSet(id: number) {
    return request.delete('/eval/sets/' + id);
  },
  addCase(
    setId: number,
    input: { question: string; expectedFileId?: number | null; expectedKeywords?: string[]; note?: string },
  ) {
    return request.post<EvalCase>('/eval/sets/' + setId + '/cases', input);
  },
  updateCase(
    caseId: number,
    input: { question?: string; expectedFileId?: number | null; expectedKeywords?: string[]; note?: string },
  ) {
    return request.patch<EvalCase>('/eval/cases/' + caseId, input);
  },
  deleteCase(caseId: number) {
    return request.delete('/eval/cases/' + caseId);
  },
  runEval(setId: number) {
    return request.post<EvalRunView>('/eval/sets/' + setId + '/run');
  },
  compareEval(setId: number, a: EvalRunConfig, b: EvalRunConfig) {
    return request.post<EvalComparisonView>('/eval/sets/' + setId + '/compare', { a, b });
  },
  listRuns(setId: number) {
    return request.get<EvalRun[]>('/eval/runs', { params: { setId } });
  },
  getRun(runId: number) {
    return request.get<EvalRunView>('/eval/runs/' + runId);
  },
};
