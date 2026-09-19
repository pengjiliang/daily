<!--
  模型配置页：双 Tab。
  「模型与生成」：对话提供方（OpenAI 兼容 / Anthropic）、OpenAI/Anthropic 配置、向量模型配置（含重建索引提示）、温度；
  「检索参数」：topK / keywordTopK / minScore / rerankTopN。
  保存时 apiKey 留空表示不修改；向量模型变化后服务端会自动后台重建索引，页面轮询展示进度。
-->
<template>
  <div class="settings-content">
    <div class="settings-toolbar">
      <span class="toolbar-tip">修改后保存立即生效；API Key 留空表示保留原值</span>
    </div>

    <!-- 重建索引进度提示 -->
    <el-alert
      v-if="reindex.status === 'running' || reindex.status === 'pending'"
      type="info"
      :closable="false"
      show-icon
      class="reindex-alert"
    >
      <template #title>
        正在重建向量索引
        <span v-if="reindex.progress && reindex.progress.total > 0">
          （{{ reindex.progress.done }}/{{ reindex.progress.total }}，失败 {{ reindex.progress.failed }}）
        </span>
        <span v-if="reindex.progress?.currentFile">—— {{ reindex.progress.currentFile }}</span>
      </template>
    </el-alert>
    <el-alert
      v-else-if="reindex.status === 'done'"
      type="success"
      :closable="true"
      show-icon
      class="reindex-alert"
      title="向量索引重建完成"
    />
    <el-alert
      v-else-if="reindex.status === 'failed'"
      type="error"
      :closable="true"
      show-icon
      class="reindex-alert"
      title="向量索引重建失败，请检查文档与向量模型配置"
    />

    <el-tabs v-model="activeTab" class="settings-tabs">
      <!-- Tab 1：模型与生成 -->
      <el-tab-pane label="模型与生成" name="model">
        <el-form label-width="140px" label-position="left">
          <el-form-item label="对话提供方">
            <el-radio-group v-model="form.chatProvider">
              <el-radio-button value="openai">OpenAI 兼容（含豆包/火山方舟）</el-radio-button>
              <el-radio-button value="anthropic">Anthropic（Claude）</el-radio-button>
            </el-radio-group>
            <div class="field-tip">默认读取 .env；在此填写后按用户保存覆盖</div>
          </el-form-item>

          <!-- OpenAI 兼容配置 -->
          <template v-if="form.chatProvider === 'openai'">
            <el-divider content-position="left">OpenAI 兼容对话模型</el-divider>
            <el-form-item label="API 地址">
              <el-input v-model="form.openai.baseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" />
            </el-form-item>
            <el-form-item label="对话模型">
              <el-input v-model="form.openai.model" autocomplete="off" placeholder="gpt-4o-mini / doubao-seed-1-6-250615" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input
                v-model="form.openai.apiKey"
                type="password"
                show-password
                autocomplete="new-password"
                :placeholder="view.openai.hasApiKey ? '已配置（留空则不修改）' : '请输入 API Key'"
              />
            </el-form-item>
          </template>

          <!-- Anthropic 配置 -->
          <template v-else>
            <el-divider content-position="left">Anthropic 对话模型</el-divider>
            <el-form-item label="API 地址">
              <el-input v-model="form.anthropic.baseUrl" placeholder="https://api.anthropic.com/v1/messages" />
            </el-form-item>
            <el-form-item label="对话模型">
              <el-input v-model="form.anthropic.model" autocomplete="off" placeholder="claude-3-5-sonnet-20241022" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input
                v-model="form.anthropic.apiKey"
                type="password"
                show-password
                autocomplete="new-password"
                :placeholder="view.anthropic.hasApiKey ? '已配置（留空则不修改）' : '请输入 API Key'"
              />
            </el-form-item>
          </template>

          <el-divider content-position="left">向量模型（Embedding）</el-divider>
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            title="更改向量模型后，必须重新向量化全部文档才能生效；保存后系统会自动在后台重建索引。"
            class="embedding-tip"
          />
          <el-form-item label="API 地址">
            <el-input v-model="form.embedding.baseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" />
          </el-form-item>
          <el-form-item label="向量模型">
            <el-input v-model="form.embedding.model" autocomplete="off" placeholder="text-embedding-ada-002 / doubao-embedding-large" />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input
              v-model="form.embedding.apiKey"
              type="password"
              show-password
              autocomplete="new-password"
              :placeholder="view.embedding.hasApiKey ? '已配置（留空则不修改）' : '请输入 API Key'"
            />
          </el-form-item>

          <el-divider content-position="left">生成参数</el-divider>
          <el-form-item label="温度">
            <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input class="temperature-slider" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- Tab 2：检索参数 -->
      <el-tab-pane label="检索参数" name="retrieval">
        <el-form label-width="200px" label-position="left">
          <el-form-item label="向量候选数（topK）">
            <el-input-number v-model="form.topK" :min="1" :max="50" />
            <div class="field-tip">向量语义路召回片段数（进入重排前）</div>
          </el-form-item>
          <el-form-item label="关键词候选数（keywordTopK）">
            <el-input-number v-model="form.keywordTopK" :min="1" :max="50" />
            <div class="field-tip">pg_trgm 字面匹配路召回片段数</div>
          </el-form-item>
          <el-form-item label="向量相似度阈值（minScore）">
            <el-slider v-model="form.minScore" :min="0" :max="1" :step="0.05" show-input class="temperature-slider" />
            <div class="field-tip">低于该值的向量路片段视为噪声丢弃</div>
          </el-form-item>
          <el-form-item label="重排保留数（rerankTopN）">
            <el-input-number v-model="form.rerankTopN" :min="1" :max="20" />
            <div class="field-tip">LLM 重排后最多保留的引用片段数</div>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <!-- 底部操作栏：保存按钮固定在右下角 -->
    <div class="settings-footer">
      <el-button type="primary" :loading="saving" @click="saveAll">保存全部</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { AiSettingsView, ChatProvider, ReindexStatus } from '@ai-knowledge-base/shared';
import { settingsApi, type SaveSettingsPayload } from '@/api/settings';

const activeTab = ref('model');
const saving = ref(false);

/** 设置表单（apiKey 留空表示不修改） */
const form = reactive({
  chatProvider: 'openai' as ChatProvider,
  openai: { baseUrl: '', model: '', apiKey: '' },
  anthropic: { baseUrl: '', model: '', apiKey: '' },
  embedding: { baseUrl: '', model: '', apiKey: '' },
  temperature: 0,
  topK: 8,
  keywordTopK: 8,
  minScore: 0.3,
  rerankTopN: 5,
});

/** 服务端回显视图（用于 apiKey 是否已配置的占位提示） */
const view = reactive<AiSettingsView>({
  chatProvider: 'openai',
  openai: { baseUrl: '', model: '', hasApiKey: false },
  anthropic: { baseUrl: '', model: '', hasApiKey: false },
  embedding: { baseUrl: '', model: '', hasApiKey: false },
  temperature: 0,
  topK: 8,
  keywordTopK: 8,
  minScore: 0.3,
  rerankTopN: 5,
  reindex: { status: 'idle', progress: null },
});

/** 重建索引进度（视图展示用） */
const reindex = ref<{ status: ReindexStatus; progress: AiSettingsView['reindex']['progress'] }>({
  status: 'idle',
  progress: null,
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

const applyView = (data: AiSettingsView) => {
  view.chatProvider = data.chatProvider;
  view.openai = data.openai;
  view.anthropic = data.anthropic;
  view.embedding = data.embedding;
  view.temperature = data.temperature;
  view.topK = data.topK;
  view.keywordTopK = data.keywordTopK;
  view.minScore = data.minScore;
  view.rerankTopN = data.rerankTopN;
  view.reindex = data.reindex;

  form.chatProvider = data.chatProvider;
  form.openai.baseUrl = data.openai.baseUrl ?? '';
  form.openai.model = data.openai.model ?? '';
  form.anthropic.baseUrl = data.anthropic.baseUrl ?? '';
  form.anthropic.model = data.anthropic.model ?? '';
  form.embedding.baseUrl = data.embedding.baseUrl ?? '';
  form.embedding.model = data.embedding.model ?? '';
  form.temperature = data.temperature;
  form.topK = data.topK;
  form.keywordTopK = data.keywordTopK;
  form.minScore = data.minScore;
  form.rerankTopN = data.rerankTopN;

  reindex.value = {
    status: data.reindex.status,
    progress: data.reindex.progress,
  };
  updatePolling(data.reindex.status);
};

const loadSettings = async () => {
  const data = await settingsApi.getSettings();
  applyView(data);
};

const buildPayload = (): SaveSettingsPayload => ({
  chatProvider: form.chatProvider,
  temperature: form.temperature,
  topK: form.topK,
  keywordTopK: form.keywordTopK,
  minScore: form.minScore,
  rerankTopN: form.rerankTopN,
  openai: { baseUrl: form.openai.baseUrl, model: form.openai.model, apiKey: form.openai.apiKey || undefined },
  anthropic: {
    baseUrl: form.anthropic.baseUrl,
    model: form.anthropic.model,
    apiKey: form.anthropic.apiKey || undefined,
  },
  embedding: {
    baseUrl: form.embedding.baseUrl,
    model: form.embedding.model,
    apiKey: form.embedding.apiKey || undefined,
  },
});

const saveAll = async () => {
  saving.value = true;
  try {
    const data = await settingsApi.saveSettings(buildPayload());
    applyView(data);
    ElMessage.success(data.reindex.status === 'pending' || data.reindex.status === 'running'
      ? '保存成功，正在后台重建向量索引'
      : '保存成功');
  } catch (error) {
    console.error(error);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

/** 重建索引进行中时，每 2 秒轮询进度直到完成/失败 */
const updatePolling = (status: ReindexStatus) => {
  if (status === 'pending' || status === 'running') {
    if (!pollTimer) {
      pollTimer = setInterval(async () => {
        try {
          const data = await settingsApi.getSettings();
          reindex.value = { status: data.reindex.status, progress: data.reindex.progress };
          if (data.reindex.status !== 'pending' && data.reindex.status !== 'running') {
            updatePolling(data.reindex.status);
          }
        } catch (error) {
          console.error(error);
        }
      }, 2000);
    }
  } else if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

onMounted(() => {
  loadSettings();
});

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<style scoped>
.settings-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 2px;
}

.settings-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.toolbar-tip {
  font-size: 12px;
  color: #909399;
}

.reindex-alert {
  margin-bottom: 16px;
}

.embedding-tip {
  margin-bottom: 16px;
}

.temperature-slider {
  max-width: 320px;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  margin-left: 12px;
  align-self: center;
}

.settings-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.settings-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  margin-top: 8px;
  border-top: 1px solid #ebeef5;
}
</style>
