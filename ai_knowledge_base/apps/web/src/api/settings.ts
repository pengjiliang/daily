/**
 * 设置页接口：AI 模型与检索参数的用户级配置。
 * GET 回显当前生效配置（apiKey 只返回是否已配置）；PUT 保存（缺省字段不覆盖原值）。
 */
import request from './request';
import type { AiSettingsView, ChatProvider } from '@ai-knowledge-base/shared';

/** 单个模型组保存载荷：字段可选，缺省表示不修改（apiKey 传空表示保留原值） */
export interface ProviderSettingsPayload {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

/** 设置保存请求体（与 server 端 SaveSettingsDto 对应） */
export interface SaveSettingsPayload {
  chatProvider?: ChatProvider;
  temperature?: number;
  topK?: number;
  keywordTopK?: number;
  minScore?: number;
  rerankTopN?: number;
  openai?: ProviderSettingsPayload;
  anthropic?: ProviderSettingsPayload;
  embedding?: ProviderSettingsPayload;
}

export const settingsApi = {
  getSettings() {
    return request.get<AiSettingsView>('/settings');
  },

  saveSettings(payload: SaveSettingsPayload) {
    return request.put<AiSettingsView>('/settings', payload);
  },

  /** 手动触发全量重建向量索引（不改动模型配置） */
  reindexAll() {
    return request.post<AiSettingsView>('/settings/reindex');
  },
};
