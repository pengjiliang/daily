<!--
  使用统计页：KPI 总览（文档数/会话数/提问数/命中率）+ 近 14 天提问趋势折线（ECharts）+ 热门问题 Top10。
  数据来自 GET /stats（按当前登录用户聚合）。
-->
<template>
  <div class="stats-content">
    <div class="stats-toolbar">
      <span class="toolbar-tip">仅统计当前账号的数据</span>
      <el-button :loading="loading" @click="loadStats">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <!-- KPI 卡片 -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon kpi-doc"><el-icon><Document /></el-icon></div>
        <div class="kpi-meta">
          <div class="kpi-value">{{ overview.documentCount }}</div>
          <div class="kpi-label">文档数</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-chat"><el-icon><ChatDotRound /></el-icon></div>
        <div class="kpi-meta">
          <div class="kpi-value">{{ overview.conversationCount }}</div>
          <div class="kpi-label">会话数</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-ask"><el-icon><Message /></el-icon></div>
        <div class="kpi-meta">
          <div class="kpi-value">{{ overview.questionCount }}</div>
          <div class="kpi-label">提问数</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-hit"><el-icon><Aim /></el-icon></div>
        <div class="kpi-meta">
          <div class="kpi-value">{{ hitRateText }}</div>
          <div class="kpi-label">知识库命中率</div>
        </div>
      </div>
    </div>

    <!-- 底部区域：趋势图 + 热门问题，左右并排铺满剩余高度 -->
    <div class="stats-bottom">
      <!-- 趋势图 -->
      <div class="panel trend-panel">
        <div class="panel-title">
          <el-icon><TrendCharts /></el-icon>
          近 14 天提问趋势
        </div>
        <div class="trend-wrap">
          <div ref="trendChartRef" class="trend-chart"></div>
          <div v-if="trend.length === 0" class="chart-empty-mask">
            <el-empty description="暂无提问数据" :image-size="72" />
          </div>
        </div>
      </div>

      <!-- 热门问题 -->
      <div class="panel popular-panel">
        <div class="panel-title">
          <el-icon><Histogram /></el-icon>
          热门问题 Top{{ popularQuestions.length || 10 }}
        </div>
        <el-empty v-if="popularQuestions.length === 0" description="暂无提问数据" :image-size="72" />
        <div v-else class="popular-list">
          <div v-for="(item, index) in popularQuestions" :key="`${item.content}-${index}`" class="popular-item">
            <span class="rank" :class="rankClass(index)">{{ index + 1 }}</span>
            <span class="popular-content" :title="item.content">{{ item.content }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barWidth(item.count) }"></div>
            </div>
            <span class="popular-count">{{ item.count }} 次</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import {
  Refresh,
  Document,
  ChatDotRound,
  Message,
  Aim,
  TrendCharts,
  Histogram,
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import type { StatsPayload } from '@ai-knowledge-base/shared';
import { statsApi } from '@/api/stats';
import { useUiStore } from '@/stores/ui';

const loading = ref(false);
const uiStore = useUiStore();

/** 读取当前主题下的 CSS 变量值（随 <html class="dark"> 自动切换） */
const themeCssVar = (name: string, fallback: string) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const overview = ref<StatsPayload['overview']>({
  documentCount: 0,
  conversationCount: 0,
  questionCount: 0,
  answerCount: 0,
  kbHitCount: 0,
  hitRate: 0,
});
const trend = ref<StatsPayload['trend']>([]);
const popularQuestions = ref<StatsPayload['popularQuestions']>([]);

const hitRateText = computed(() => `${Math.round((overview.value.hitRate || 0) * 1000) / 10}%`);
const maxPopularCount = computed(() => Math.max(1, ...popularQuestions.value.map((item) => item.count)));

const rankClass = (index: number) => (index < 3 ? `rank-top${index + 1}` : '');

const barWidth = (count: number) => `${(count / maxPopularCount.value) * 100}%`;

// ---------- ECharts 趋势图 ----------
const trendChartRef = ref<HTMLDivElement | null>(null);
let trendChart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

const setTrendOption = () => {
  ensureChart();
  if (!trendChart) return;
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 24, top: 40, bottom: 36 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.value.map((point) => point.date),
      axisLabel: { color: themeCssVar('--kb-chart-axis', '#606266') },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: themeCssVar('--kb-chart-axis', '#606266') },
      splitLine: { lineStyle: { color: themeCssVar('--kb-chart-split', '#eef0f3') } },
    },
    series: [
      {
        name: '提问数',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: trend.value.map((point) => point.count),
        lineStyle: { width: 3, color: '#409eff' },
        itemStyle: { color: '#409eff' },
        areaStyle: { color: 'rgba(64, 158, 255, 0.12)' },
      },
    ],
  });
};

const handleResize = () => {
  trendChart?.resize();
};

// 主题切换后重设图表配色
watch(() => uiStore.isDark, () => setTrendOption());

/** 图表容器就绪后懒初始化（容器常驻渲染，确保 ref 一定存在） */
const ensureChart = () => {
  if (trendChart || !trendChartRef.value) return;
  trendChart = echarts.init(trendChartRef.value);
  window.addEventListener('resize', handleResize);
  // 容器随 flex 布局自适应变化时同步图表尺寸
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => trendChart?.resize());
    resizeObserver.observe(trendChartRef.value);
  }
};

// ---------- 数据加载 ----------
const loadStats = async () => {
  loading.value = true;
  try {
    const data = await statsApi.getStats();
    overview.value = data.overview;
    trend.value = data.trend;
    popularQuestions.value = data.popularQuestions;
    await nextTick();
    setTrendOption();
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (trendChart) {
    trendChart.dispose();
    trendChart = null;
  }
});
</script>

<style scoped>
.stats-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 2px;
}

.stats-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex: 0 0 auto;
}

.toolbar-tip {
  font-size: 12px;
  color: var(--kb-text-secondary);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
  flex: 0 0 auto;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--kb-bg-card);
  border: 1px solid var(--kb-border-light);
  border-radius: 8px;
  padding: 14px 16px;
}

.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  flex-shrink: 0;
}

.kpi-doc { background: #409eff; }
.kpi-chat { background: #67c23a; }
.kpi-ask { background: #e6a23c; }
.kpi-hit { background: #f56c6c; }

.kpi-value {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--kb-text-primary);
}

.kpi-label {
  font-size: 13px;
  color: var(--kb-text-secondary);
  margin-top: 2px;
}

.panel {
  background: var(--kb-bg-card);
  border: 1px solid var(--kb-border-light);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

/* 底部区域：趋势图 + 热门问题左右并排，铺满剩余高度 */
.stats-bottom {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 16px;
}

.trend-panel {
  flex: 1 1 58%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}

.popular-panel {
  flex: 1 1 42%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}

.popular-panel .panel-title {
  flex: 0 0 auto;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--kb-text-primary);
  margin-bottom: 12px;
}

.trend-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 180px;
}

.popular-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.trend-chart {
  width: 100%;
  height: 100%;
}

.chart-empty-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--kb-bg-card);
}

.popular-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 4px;
  border-bottom: 1px solid var(--kb-border-lightest);
}

.popular-item:last-child {
  border-bottom: none;
}

.rank {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  text-align: center;
  line-height: 22px;
  font-size: 12px;
  color: var(--kb-text-secondary);
  background: var(--kb-bg-input);
  flex-shrink: 0;
}

.rank-top1 { background: #f56c6c; color: #fff; }
.rank-top2 { background: #e6a23c; color: #fff; }
.rank-top3 { background: #67c23a; color: #fff; }

.popular-content {
  flex: 0 0 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--kb-text-primary);
}

.bar-track {
  flex: 1;
  height: 8px;
  background: var(--kb-bg-input);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #409eff, #79bbff);
  transition: width 0.3s;
}

.popular-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--kb-text-secondary);
  min-width: 56px;
  text-align: right;
}

/* 窄屏（小窗口）回退为上下堆叠，趋势图固定高度 */
@media (max-width: 900px) {
  .stats-bottom {
    flex-direction: column;
    overflow-y: auto;
  }

  .trend-panel {
    flex: none;
    height: 280px;
  }

  .popular-panel {
    flex: none;
  }

  .popular-list {
    overflow: visible;
  }
}
</style>
