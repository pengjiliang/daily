/**
 * 统计页接口：使用统计与知识图谱数据。
 */
import request from './request';
import type { EntityGraphData, GraphData, StatsPayload } from '@ai-knowledge-base/shared';

export const statsApi = {
  getStats() {
    return request.get<StatsPayload>('/stats');
  },

  getGraph() {
    return request.get<GraphData>('/stats/graph');
  },

  getEntityGraph() {
    return request.get<EntityGraphData>('/stats/graph/entities');
  },
};
