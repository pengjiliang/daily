<!--
  RAG 检索调试面板：输入单问题，只跑检索、不生成回答，展示完整检索链路
  （查询改写 → 向量语义路 + 关键词字面路 → RRF 融合 → LLM 重排保留），
  用于定位"为什么检索不到 / 召回不准"。数据来自 POST /chat/retrieve/debug。
-->
<template>
  <div class="debug-content">
    <div class="debug-toolbar">
      <el-input
        v-model="question"
        placeholder="输入一个要调试的问题，例如：张三在哪个部门？"
        clearable
        @keydown.enter.prevent="runDebug"
      />
      <el-button type="primary" :loading="loading" :icon="Search" @click="runDebug">开始调试</el-button>
    </div>
    <div class="debug-tip">只跑检索、不生成回答（重排环节会调用一次聊天模型做相关性过滤）</div>

    <template v-if="view">
      <!-- 查询链路 -->
      <div class="panel query-panel">
        <div class="panel-title"><el-icon><Connection /></el-icon>查询链路</div>
        <div class="chain-row">
          <span class="chain-label">原问题</span>
          <span class="chain-value">{{ view.question }}</span>
        </div>
        <div class="chain-row">
          <span class="chain-label">记忆增强</span>
          <span class="chain-value" :class="{ dim: view.contextualized === view.question }">
            {{ view.contextualized }}
            <em v-if="view.contextualized === view.question">（无历史，未改写）</em>
          </span>
        </div>
        <div class="chain-row">
          <span class="chain-label">短查询改写</span>
          <span class="chain-value" :class="{ dim: view.rewritten === view.contextualized }">
            {{ view.rewritten }}
            <em v-if="view.rewritten === view.contextualized">（无需改写）</em>
          </span>
        </div>
      </div>
      <!-- 多路召回 -->
      <div class="legs-grid">
        <div class="panel leg-panel">
          <div class="panel-title">
            <el-icon><Histogram /></el-icon>向量语义路
            <span class="leg-count">{{ view.vectorLeg.length }}</span>
          </div>
          <div v-if="view.vectorLeg.length === 0" class="leg-empty">无命中（低于 minScore 阈值或未召回）</div>
          <div v-else class="leg-list">
            <div v-for="(item, index) in view.vectorLeg" :key="item.chunkId" class="leg-item">
              <span class="leg-rank">{{ index + 1 }}</span>
              <div class="leg-main">
                <div class="leg-content" :title="item.content">{{ item.content }}</div>
                <div class="leg-sub">文件 #{{ item.uploadFileId }} · 分块 #{{ item.chunkId }}</div>
              </div>
              <el-tag size="small" :type="scoreType(item.score)" class="leg-score"
                >{{ percent(item.score) }}</el-tag
              >
            </div>
          </div>
        </div>

        <div class="panel leg-panel">
          <div class="panel-title"><el-icon><Search /></el-icon>关键词字面路</div>
          <div v-if="view.keywordLegs.length === 0" class="leg-empty">无召回路径</div>
          <div v-for="leg in view.keywordLegs" :key="leg.term" class="kw-group">
            <div class="kw-term">查询词：{{ leg.term }}</div>
            <div v-if="leg.items.length === 0" class="leg-empty">无命中</div>
            <div v-else class="leg-list">
              <div v-for="(item, index) in leg.items" :key="`${leg.term}-${item.chunkId}`" class="leg-item">
                <span class="leg-rank">{{ index + 1 }}</span>
                <div class="leg-main">
                  <div class="leg-content" :title="item.content">{{ item.content }}</div>
                  <div class="leg-sub">文件 #{{ item.uploadFileId }} · 分块 #{{ item.chunkId }}</div>
                </div>
                <el-tag size="small" :type="scoreType(item.score)" class="leg-score"
                  >{{ percent(item.score) }}</el-tag
                >
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 融合与重排 -->
      <div class="legs-grid">
        <div class="panel leg-panel">
          <div class="panel-title">
            <el-icon><Sort /></el-icon>RRF 融合
            <span class="leg-count">{{ view.fused.length }}</span>
          </div>
          <div v-if="view.fused.length === 0" class="leg-empty">无融合结果</div>
          <div v-else class="leg-list">
            <div v-for="(item, index) in view.fused" :key="item.chunkId" class="leg-item">
              <span class="leg-rank">{{ index + 1 }}</span>
              <div class="leg-main">
                <div class="leg-content" :title="item.content">{{ item.content }}</div>
                <div class="leg-sub">文件 #{{ item.uploadFileId }} · 分块 #{{ item.chunkId }}</div>
              </div>
              <el-tag size="small" type="warning" class="leg-score">{{ item.rrf.toFixed(3) }}</el-tag>
            </div>
          </div>
        </div>

        <div class="panel leg-panel">
          <div class="panel-title">
            <el-icon><Select /></el-icon>LLM 重排保留
            <span class="leg-count">{{ view.kept.length }}</span>
          </div>
          <div v-if="view.kept.length === 0" class="leg-empty">未保留（全部被重排过滤）</div>
          <div v-else class="leg-list">
            <div v-for="(item, index) in view.kept" :key="item.chunkId" class="leg-item">
              <span class="leg-rank">{{ index + 1 }}</span>
              <div class="leg-main">
                <div class="leg-content" :title="item.content">{{ item.content }}</div>
                <div class="leg-sub">文件 #{{ item.uploadFileId }} · 分块 #{{ item.chunkId }}</div>
              </div>
              <el-tag size="small" type="success" class="leg-score">{{ percent(item.similarity) }}</el-tag>
            </div>
          </div>
        </div>
      </div>
    </template>
    <el-empty v-else description="输入问题后点击「开始调试」，查看完整检索链路" :image-size="90" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Connection, Histogram, Search, Select, Sort } from '@element-plus/icons-vue';
import type { RetrieveDebugView } from '@ai-knowledge-base/shared';
import { chatApi } from '@/api/chat';

const question = ref('');
const loading = ref(false);
const view = ref<RetrieveDebugView | null>(null);

/** 相似度转百分比（保留 2 位小数） */
const percent = (score: number) => `${(score * 100).toFixed(2)}%`;

/** 相似度标签颜色：>=0.7 强相关绿，>=0.5 中等黄，其余灰 */
const scoreType = (score: number): 'success' | 'warning' | 'info' =>
  score >= 0.7 ? 'success' : score >= 0.5 ? 'warning' : 'info';

/** 运行一次检索调试：只跑检索、不生成回答，展示完整检索链路 */
const runDebug = async () => {
  const q = question.value.trim();
  if (!q || loading.value) return;
  loading.value = true;
  try {
    view.value = await chatApi.retrieveDebug(q);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.debug-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 2px;
}

.debug-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.debug-toolbar .el-input {
  flex: 1;
}

.debug-tip {
  font-size: 12px;
  color: var(--kb-text-secondary);
  flex: 0 0 auto;
}

/* 查询链路 / 各召回面板 */
.panel {
  background: var(--kb-bg-card);
  border: 1px solid var(--kb-border-light);
  border-radius: 8px;
  padding: 14px 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--kb-text-primary);
  margin-bottom: 10px;
}

/* 查询链路 */
.query-panel .chain-row {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--kb-border-light);
}
.query-panel .chain-row:last-child {
  border-bottom: none;
}
.chain-label {
  flex: 0 0 72px;
  color: var(--kb-text-secondary);
}
.chain-value {
  flex: 1;
  color: var(--kb-text-primary);
  word-break: break-all;
  line-height: 1.5;
}
.chain-value.dim {
  color: var(--kb-text-placeholder);
}
.chain-value em {
  font-style: normal;
  font-size: 12px;
  color: var(--kb-text-placeholder);
}

/* 召回面板双列 */
.legs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.leg-panel .panel-title .leg-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--kb-text-secondary);
  background: var(--kb-bg-hover);
  border-radius: 10px;
  padding: 0 8px;
  line-height: 18px;
  font-weight: 400;
}

.leg-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leg-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--kb-border-light);
  border-radius: 8px;
  background: var(--kb-bg-page);
}

.leg-rank {
  flex: 0 0 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 4px;
  background: var(--kb-bg-hover);
  color: var(--kb-text-secondary);
  font-size: 12px;
}

.leg-main {
  flex: 1;
  min-width: 0;
}

.leg-content {
  font-size: 13px;
  color: var(--kb-text-primary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.leg-sub {
  font-size: 11px;
  color: var(--kb-text-secondary);
  margin-top: 4px;
}

.leg-score {
  flex: 0 0 auto;
}

/* 关键词路分组 */
.kw-group {
  margin-bottom: 10px;
}
.kw-term {
  font-size: 12px;
  color: var(--kb-text-secondary);
  margin-bottom: 6px;
}

.leg-empty {
  font-size: 12px;
  color: var(--kb-text-placeholder);
  text-align: center;
  padding: 16px 0;
}
</style>