/**
 * 用量看板接口（亮点 5：成本与用量看板）。
 */
import request from './request';
import type { UsageDashboard } from '@ai-knowledge-base/shared';

export const usageApi = {
  getDashboard(from?: string, to?: string) {
    return request.get<UsageDashboard>('/usage', { params: { from, to } });
  },
};
