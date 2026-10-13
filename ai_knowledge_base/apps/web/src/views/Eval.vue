<!--
  RAG 评估与回归看板（亮点 3）：
  评估集管理（选择/新建/删除）+ 用例列表 + 历史运行 + 运行结果明细。
  数据来自 /eval/* 接口。
-->
<template>
  <div class="eval-content">
    <div class="eval-toolbar">
      <el-select v-model="selectedSetId" placeholder="选择评估集" style="flex: 1" @change="loadSetDetail">
        <el-option v-for="set in sets" :key="set.id" :label="set.name + '（' + set.caseCount + ' 题）'" :value="set.id" />
      </el-select>
      <el-input v-model="newSetName" placeholder="新建评估集名称" style="width: 200px" @keydown.enter="createSet" />
      <el-button type="primary" :icon="Plus" @click="createSet">新建</el-button>
      <el-button v-if="selectedSetId" type="danger" plain :icon="Delete" @click="deleteSet">删除评估集</el-button>
      <el-button v-if="selectedSetId && setDetail?.cases?.length" type="success" :loading="running" :icon="VideoPlay" @click="runEval">运行评估</el-button>
    </div>
    <template v-if="setDetail">
      <div class="eval-cases">
        <div class="section-title">用例列表（{{ setDetail.cases.length }}）</div>
        <div v-for="caseItem in setDetail.cases" :key="caseItem.id" class="eval-case-row">
          <div class="eval-case-question">{{ caseItem.question }}</div>
          <div class="eval-case-meta">
            <span v-if="caseItem.expectedFileId">期望文件 #{{ caseItem.expectedFileId }}</span>
            <span v-if="caseItem.expectedKeywords?.length">关键词：{{ caseItem.expectedKeywords.join('、') }}</span>
            <span v-if="caseItem.note">{{ caseItem.note }}</span>
          </div>
          <div class="eval-case-actions">
            <el-button text size="small" :icon="Delete" @click="deleteCase(caseItem.id)" />
          </div>
        </div>
        <div v-if="setDetail.cases.length === 0" class="section-empty">暂无用例</div>
      </div>
      <div class="eval-runs">
        <div class="section-title">历史运行</div>
        <div v-for="run in runs" :key="run.id" class="eval-run-row">
          <el-tag size="small" type="success">recall@k {{ percent(run.recallAtK) }}</el-tag>
          <el-tag size="small">MRR {{ run.mrr.toFixed(3) }}</el-tag>
          <el-tag size="small" type="warning">空答率 {{ percent(run.emptyRate) }}</el-tag>
          <el-tag size="small">引用准确率 {{ percent(run.citationAccuracy) }}</el-tag>
          <span class="eval-run-time">{{ chatStore.formatDate(run.createdAt) }}</span>
          <span class="eval-run-config">topK={{ run.config.topK }} / minScore={{ run.config.minScore }}</span>
          <el-button text size="small" @click="loadRunDetail(run.id)">明细</el-button>
        </div>
        <div v-if="runs.length === 0" class="section-empty">尚无运行记录</div>
      </div>
      <div v-if="runDetail" class="eval-result">
        <div class="section-title">运行明细（{{ runDetail.run.caseCount }} 题）</div>
        <div v-for="result in runDetail.results" :key="result.caseId" class="eval-result-row">
          <div class="eval-result-q">{{ result.question }}</div>
          <div class="eval-result-metrics">
            <el-tag :type="result.hitExpectedFile ? 'success' : 'danger'" size="small">
              {{ result.hitExpectedFile ? '命中 #' + result.expectedFileRank : '未命中期望文件' }}
            </el-tag>
            <el-tag v-if="result.empty" type="warning" size="small">空答</el-tag>
            <el-tag :type="result.citationHit ? 'success' : 'info'" size="small">
              {{ result.citationHit ? '引用准确' : '引用未含关键词' }}
            </el-tag>
            <span class="eval-result-sec">{{ result.retrieveSec.toFixed(2) }}s</span>
          </div>
        </div>
      </div>
    </template>
    <el-empty v-else description="先选择一个评估集或新建一个" :image-size="90" />
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Plus, Delete, VideoPlay } from '@element-plus/icons-vue';
import { evalApi } from '@/api/eval';
import { useChatStore } from '@/stores/chat';
import type { EvalRun, EvalRunView, EvalSet } from '@ai-knowledge-base/shared';
import { ElMessage, ElMessageBox } from 'element-plus';

const chatStore = useChatStore();
const sets = ref<(EvalSet & { caseCount: number })[]>([]);
const selectedSetId = ref<number | null>(null);
const setDetail = ref<(EvalSet & { cases: any[] }) | null>(null);
const runs = ref<EvalRun[]>([]);
const runDetail = ref<EvalRunView | null>(null);
const newSetName = ref('');
const running = ref(false);

const percent = (v: number) => (v * 100).toFixed(1) + '%';

const loadSets = async () => {
  try {
    sets.value = await evalApi.listSets();
    if (selectedSetId.value == null && sets.value.length > 0) {
      selectedSetId.value = sets.value[0].id;
      await loadSetDetail(selectedSetId.value);
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('加载评估集失败');
  }
};

const createSet = async () => {
  if (!newSetName.value.trim()) {
    ElMessage.warning('请输入评估集名称');
    return;
  }
  try {
    const set = await evalApi.createSet(newSetName.value.trim());
    newSetName.value = '';
    selectedSetId.value = set.id;
    await loadSets();
    await loadSetDetail(set.id);
  } catch (error) {
    console.error(error);
    ElMessage.error('创建评估集失败');
  }
};

const loadSetDetail = async (setId: number) => {
  try {
    setDetail.value = await evalApi.getSet(setId);
    runs.value = await evalApi.listRuns(setId);
  } catch (error) {
    console.error(error);
    ElMessage.error('加载评估集详情失败');
  }
};

const deleteSet = async () => {
  if (!selectedSetId.value) return;
  try {
    await ElMessageBox.confirm('确定删除该评估集及其用例、运行记录？', '删除评估集', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await evalApi.deleteSet(selectedSetId.value);
    selectedSetId.value = null;
    setDetail.value = null;
    runs.value = [];
    await loadSets();
  } catch (error) {
    console.error(error);
    ElMessage.error('删除评估集失败');
  }
};

const deleteCase = async (caseId: number) => {
  if (!selectedSetId.value) return;
  try {
    await evalApi.deleteCase(caseId);
    await loadSetDetail(selectedSetId.value);
  } catch (error) {
    console.error(error);
    ElMessage.error('删除用例失败');
  }
};

const runEval = async () => {
  if (!selectedSetId.value) return;
  running.value = true;
  try {
    runDetail.value = await evalApi.runEval(selectedSetId.value);
    await loadSetDetail(selectedSetId.value);
    ElMessage.success('评估完成');
  } catch (error) {
    console.error(error);
    ElMessage.error('评估运行失败：' + (error instanceof Error ? error.message : String(error)));
  } finally {
    running.value = false;
  }
};

const loadRunDetail = async (runId: number) => {
  try {
    runDetail.value = await evalApi.getRun(runId);
  } catch (error) {
    console.error(error);
    ElMessage.error('加载运行明细失败');
  }
};

onMounted(() => {
  loadSets();
});
</script>
<style scoped>
.eval-content { height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 0 2px; }
.eval-toolbar { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.section-title { font-size: 14px; font-weight: 600; color: var(--kb-text-primary); margin: 4px 0; }
.section-empty { font-size: 12px; color: var(--kb-text-placeholder); text-align: center; padding: 16px 0; }
.eval-cases, .eval-runs, .eval-result { background: var(--kb-bg-card); border: 1px solid var(--kb-border-light); border-radius: 8px; padding: 12px 14px; }
.eval-case-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--kb-border-light); }
.eval-case-question { flex: 1; font-size: 13px; color: var(--kb-text-primary); }
.eval-case-meta { font-size: 12px; color: var(--kb-text-secondary); display: flex; gap: 8px; flex-wrap: wrap; }
.eval-case-actions { flex-shrink: 0; }
.eval-run-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px dashed var(--kb-border-light); font-size: 12px; flex-wrap: wrap; }
.eval-run-time { color: var(--kb-text-secondary); }
.eval-run-config { color: var(--kb-text-placeholder); }
.eval-result-row { padding: 8px 0; border-bottom: 1px dashed var(--kb-border-light); }
.eval-result-q { font-size: 13px; color: var(--kb-text-primary); margin-bottom: 4px; }
.eval-result-metrics { display: flex; align-items: center; gap: 8px; }
.eval-result-sec { font-size: 12px; color: var(--kb-text-secondary); }
</style>

