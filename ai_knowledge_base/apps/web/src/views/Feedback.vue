<!--
  反馈看板（亮点 4：反馈驱动的自优化闭环）：
  热门点踩问题 Top10 + 按文档统计点踩引用（定位内容质量差的文档）+ 点踩原因分布。
  数据来自 GET /feedback/dashboard。
-->
<template>
  <div class="feedback-content">
    <template v-if="dashboard">
      <div class="feedback-panels">
        <div class="feedback-panel">
          <div class="section-title">热门点踩问题 Top10</div>
          <div v-for="(item, index) in dashboard.topDislikedQuestions" :key="index" class="feedback-row">
            <span class="feedback-rank">{{ index + 1 }}</span>
            <span class="feedback-text">{{ item.content }}</span>
            <el-tag size="small" type="danger" class="feedback-count">{{ item.count }} 次</el-tag>
          </div>
          <div v-if="dashboard.topDislikedQuestions.length === 0" class="section-empty">暂无点踩记录</div>
        </div>
        <div class="feedback-panel">
          <div class="section-title">最常被点踩的引用来源（按文档）</div>
          <div v-for="(item, index) in dashboard.topDislikedSources" :key="index" class="feedback-row">
            <span class="feedback-rank">{{ index + 1 }}</span>
            <span class="feedback-text">{{ item.originalName }}</span>
            <el-tag size="small" type="warning" class="feedback-count">{{ item.count }} 次</el-tag>
          </div>
          <div v-if="dashboard.topDislikedSources.length === 0" class="section-empty">暂无被点踩引用</div>
        </div>
        <div class="feedback-panel">
          <div class="section-title">点踩原因分布</div>
          <div v-for="item in dashboard.reasonBreakdown" :key="item.reason" class="feedback-row">
            <span class="feedback-text">{{ reasonLabel(item.reason) }}</span>
            <el-tag size="small" class="feedback-count">{{ item.count }} 次</el-tag>
          </div>
          <div v-if="dashboard.reasonBreakdown.length === 0" class="section-empty">暂无原因记录</div>
        </div>
      </div>
      <div class="feedback-tip">点踩会自动把该问题写入「自动收集的 Badcase」评估集，与评估看板（亮点 3）打通。</div>
    </template>
    <el-empty v-else description="加载反馈数据…" :image-size="90" />
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { feedbackApi } from '@/api/feedback';
import type { FeedbackDashboard, FeedbackReason } from '@ai-knowledge-base/shared';
import { ElMessage } from 'element-plus';

const dashboard = ref<FeedbackDashboard | null>(null);

const reasonLabel = (reason: string | FeedbackReason) => {
  switch (reason) {
    case 'irrelevant_sources': return '引用无关';
    case 'incomplete_answer': return '答案不全';
    case 'kb_not_used': return '未用知识库';
    case 'off_topic': return '答非所问';
    case 'other': return '其他';
    default: return reason;
  }
};

const loadDashboard = async () => {
  try {
    dashboard.value = await feedbackApi.getDashboard();
  } catch (error) {
    console.error(error);
    ElMessage.error('加载反馈看板失败');
  }
};

onMounted(() => {
  loadDashboard();
});
</script>
<style scoped>
.feedback-content { height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 0 2px; }
.feedback-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.feedback-panel { background: var(--kb-bg-card); border: 1px solid var(--kb-border-light); border-radius: 8px; padding: 12px 14px; }
.section-title { font-size: 14px; font-weight: 600; color: var(--kb-text-primary); margin: 4px 0 8px; }
.section-empty { font-size: 12px; color: var(--kb-text-placeholder); text-align: center; padding: 16px 0; }
.feedback-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--kb-border-light); font-size: 13px; }
.feedback-rank { flex-shrink: 0; width: 20px; height: 20px; line-height: 20px; text-align: center; border-radius: 4px; background: var(--kb-bg-hover); color: var(--kb-text-secondary); font-size: 12px; }
.feedback-text { flex: 1; color: var(--kb-text-primary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.feedback-count { flex-shrink: 0; }
.feedback-tip { font-size: 12px; color: var(--kb-text-secondary); padding: 4px 2px; }
</style>

