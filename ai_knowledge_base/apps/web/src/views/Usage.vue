<!--
  成本与用量看板（亮点 5）：
  总览卡片（token / 调用数 / 缓存命中率）+ 按天趋势 + 按类型（kind）排行 + 按模型排行。
  数据来自 GET /usage?from=&to=。
-->
<template>
  <div class="usage-content">
    <div class="usage-toolbar">
      <el-date-picker
        v-model="range"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        style="width: 260px"
      />
      <el-button type="primary" :icon="Search" @click="loadDashboard">查询</el-button>
    </div>
    <template v-if="dashboard">
      <div class="usage-overview">
        <div class="usage-card"><div class="usage-card-label">总 Token</div><div class="usage-card-value">{{ dashboard.total.promptTokens + dashboard.total.completionTokens }}</div></div>
        <div class="usage-card"><div class="usage-card-label">调用次数</div><div class="usage-card-value">{{ dashboard.total.calls }}</div></div>
        <div class="usage-card"><div class="usage-card-label">缓存命中率</div><div class="usage-card-value">{{ percent(dashboard.cacheHitRate) }}</div></div>
        <div class="usage-card"><div class="usage-card-label">缓存命中数</div><div class="usage-card-value">{{ dashboard.total.cacheHits }}</div></div>
      </div>
      <div class="usage-panels">
        <div class="usage-panel">
          <div class="section-title">按天趋势</div>
          <table class="usage-table"><thead><tr><th>日期</th><th>调用</th><th>输入 Token</th><th>输出 Token</th></tr></thead><tbody>
            <tr v-for="d in dashboard.daily" :key="d.date"><td>{{ d.date }}</td><td>{{ d.calls }}</td><td>{{ d.promptTokens }}</td><td>{{ d.completionTokens }}</td></tr>
          </tbody></table>
        </div>
        <div class="usage-panel">
          <div class="section-title">按类型排行（哪一步最烧钱）</div>
          <table class="usage-table"><thead><tr><th>类型</th><th>调用</th><th>合计 Token</th></tr></thead><tbody>
            <tr v-for="k in dashboard.byKind" :key="k.kind"><td>{{ k.kind }}</td><td>{{ k.calls }}</td><td>{{ k.promptTokens + k.completionTokens }}</td></tr>
          </tbody></table>
        </div>
        <div class="usage-panel">
          <div class="section-title">按模型排行</div>
          <table class="usage-table"><thead><tr><th>模型</th><th>调用</th><th>合计 Token</th></tr></thead><tbody>
            <tr v-for="m in dashboard.byModel" :key="m.model"><td>{{ m.model }}</td><td>{{ m.calls }}</td><td>{{ m.promptTokens + m.completionTokens }}</td></tr>
          </tbody></table>
        </div>
      </div>
    </template>
    <el-empty v-else description="选择日期范围后查询用量" :image-size="90" />
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { usageApi } from '@/api/usage';
import type { UsageDashboard } from '@ai-knowledge-base/shared';
import { ElMessage } from 'element-plus';

const dashboard = ref<UsageDashboard | null>(null);
const range = ref<[string, string] | null>(null);

const percent = (v: number) => (v * 100).toFixed(1) + '%';

const loadDashboard = async () => {
  try {
    dashboard.value = await usageApi.getDashboard(range.value?.[0], range.value?.[1]);
  } catch (error) {
    console.error(error);
    ElMessage.error('加载用量看板失败');
  }
};

onMounted(() => {
  loadDashboard();
});
</script>
<style scoped>
.usage-content { height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 0 2px; }
.usage-toolbar { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.usage-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.usage-card { background: var(--kb-bg-card); border: 1px solid var(--kb-border-light); border-radius: 8px; padding: 14px; text-align: center; }
.usage-card-label { font-size: 12px; color: var(--kb-text-secondary); }
.usage-card-value { font-size: 22px; font-weight: 600; color: var(--el-color-primary); margin-top: 6px; }
.usage-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.usage-panel { background: var(--kb-bg-card); border: 1px solid var(--kb-border-light); border-radius: 8px; padding: 12px 14px; }
.section-title { font-size: 14px; font-weight: 600; color: var(--kb-text-primary); margin: 4px 0 8px; }
.usage-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.usage-table th, .usage-table td { text-align: left; padding: 6px 8px; border-bottom: 1px dashed var(--kb-border-light); }
.usage-table th { color: var(--kb-text-secondary); font-weight: 500; }
</style>

