/**
 * 统计页接口：使用统计与知识图谱数据。
 */
import request from './request';
import type { GraphData, StatsPayload } from '@ai-knowledge-base/shared';

export const statsApi = {
  getStats() {
    return request.get<StatsPayload>('/stats');
  },

  getGraph() {
    return request.get<GraphData>('/stats/graph');
  },
};