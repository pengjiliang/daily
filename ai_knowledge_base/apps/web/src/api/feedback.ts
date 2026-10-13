/**
 * 反馈看板接口（亮点 4：反馈驱动的自优化闭环）。
 */
import request from './request';
import type { FeedbackDashboard } from '@ai-knowledge-base/shared';

export const feedbackApi = {
  getDashboard() {
    return request.get<FeedbackDashboard>('/feedback/dashboard');
  },
};
