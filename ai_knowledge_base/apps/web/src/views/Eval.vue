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
      <el-button v-if="selectedSetId && setDetail?.cases?.length" :loading="comparing" @click="openCompare">A/B 参数对比</el-button>
    </div>
    <template v-if="setDetail">
      <div class="eval-cases">
        <div class="section-title eval-cases-title">
          <span>用例列表（{{ setDetail.cases.length }}）</span>
          <el-button type="primary" size="small" plain :icon="Plus" @click="openAddCase">添加用例</el-button>
        </div>
        <div v-for="caseItem in setDetail.cases" :key="caseItem.id" class="eval-case-row">
          <div class="eval-case-question">{{ caseItem.question }}</div>
          <div class="eval-case-meta">
            <span v-if="caseItem.expectedFileId">期望文件：{{ fileNameOf(caseItem.expectedFileId) }}</span>
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
      <div v-if="comparison" class="eval-runs">
        <div class="section-title">A/B 对比（同一评估集）</div>
        <table class="compare-table">
          <thead><tr><th>指标</th><th>A</th><th>B</th></tr></thead>
          <tbody>
            <tr><td>Recall@k</td><td>{{ percent(comparison.a.run.recallAtK) }}</td><td>{{ percent(comparison.b.run.recallAtK) }}</td></tr>
            <tr><td>MRR</td><td>{{ comparison.a.run.mrr.toFixed(3) }}</td><td>{{ comparison.b.run.mrr.toFixed(3) }}</td></tr>
            <tr><td>空答率</td><td>{{ percent(comparison.a.run.emptyRate) }}</td><td>{{ percent(comparison.b.run.emptyRate) }}</td></tr>
            <tr><td>引用准确率</td><td>{{ percent(comparison.a.run.citationAccuracy) }}</td><td>{{ percent(comparison.b.run.citationAccuracy) }}</td></tr>
            <tr><td>平均检索耗时</td><td>{{ comparison.a.run.avgRetrieveSec.toFixed(2) }}s</td><td>{{ comparison.b.run.avgRetrieveSec.toFixed(2) }}s</td></tr>
          </tbody>
        </table>
        <div class="compare-actions">
          <el-button size="small" @click="runDetail = comparison.a">查看 A 明细</el-button>
          <el-button size="small" @click="runDetail = comparison.b">查看 B 明细</el-button>
          <span>A: {{ configLabel(comparison.a.run.config) }}</span><span>B: {{ configLabel(comparison.b.run.config) }}</span>
        </div>
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
    <el-dialog v-model="compareDialog" title="A/B 检索参数" width="760px">
      <div class="compare-configs">
        <div v-for="(config, key) in compareConfigs" :key="key" class="compare-config">
          <div class="section-title">参数 {{ key.toUpperCase() }}</div>
          <el-form label-width="110px">
            <el-form-item label="向量候选 topK"><el-input-number v-model="config.topK" :min="1" :max="50" /></el-form-item>
            <el-form-item label="关键词候选数"><el-input-number v-model="config.keywordTopK" :min="1" :max="50" /></el-form-item>
            <el-form-item label="最低相似度"><el-input-number v-model="config.minScore" :min="0" :max="1" :step="0.05" :precision="2" /></el-form-item>
            <el-form-item label="重排保留数"><el-input-number v-model="config.rerankTopN" :min="1" :max="30" /></el-form-item>
          </el-form>
        </div>
      </div>
      <template #footer><el-button @click="compareDialog = false">取消</el-button><el-button type="primary" :loading="comparing" @click="compareEval">开始对比</el-button></template>
    </el-dialog>
    <el-dialog v-model="addCaseDialog" title="添加用例" width="520px" :close-on-click-modal="false">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="问题" required>
          <el-input v-model="newCase.question" placeholder="请输入测试问题" maxlength="2000" show-word-limit />
        </el-form-item>
        <el-form-item label="期望文件">
          <el-select v-model="newCase.expectedFileId" placeholder="可选：期望命中的文档" clearable filterable style="width: 100%">
            <el-option v-for="doc in documents" :key="doc.id" :label="doc.originalName" :value="doc.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="期望关键词">
          <el-select v-model="newCase.expectedKeywords" multiple filterable allow-create default-first-option
            placeholder="可选：检索片段应包含的关键词，回车添加" style="width: 100%" :multiple-limit="10" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newCase.note" type="textarea" :rows="2" placeholder="可选：期望答案要点等" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addCaseDialog = false">取消</el-button>
        <el-button type="primary" :loading="addingCase" @click="submitCase">确定添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Plus, Delete, VideoPlay } from '@element-plus/icons-vue';
import { evalApi } from '@/api/eval';
import { uploadApi, type UploadDocument } from '@/api/upload';
import { useChatStore } from '@/stores/chat';
import type { EvalComparisonView, EvalRun, EvalRunConfig, EvalRunView, EvalSet } from '@ai-knowledge-base/shared';
import { settingsApi } from '@/api/settings';
import { ElMessage, ElMessageBox } from 'element-plus';

const chatStore = useChatStore();
const sets = ref<(EvalSet & { caseCount: number })[]>([]);
const selectedSetId = ref<number | null>(null);
const setDetail = ref<(EvalSet & { cases: any[] }) | null>(null);
const runs = ref<EvalRun[]>([]);
const runDetail = ref<EvalRunView | null>(null);
const documents = ref<UploadDocument[]>([]);
const newSetName = ref('');
const running = ref(false);
const comparing = ref(false);
const compareDialog = ref(false);
const addCaseDialog = ref(false);
const addingCase = ref(false);
const newCase = ref<{ question: string; expectedFileId: number | null; expectedKeywords: string[]; note: string }>({
  question: '',
  expectedFileId: null,
  expectedKeywords: [],
  note: '',
});
const comparison = ref<EvalComparisonView | null>(null);
const compareConfigs = ref<{ a: EvalRunConfig; b: EvalRunConfig }>({
  a: { topK: 8, keywordTopK: 8, minScore: 0.3, rerankTopN: 5 },
  b: { topK: 8, keywordTopK: 8, minScore: 0.4, rerankTopN: 5 },
});

const percent = (v: number) => (v * 100).toFixed(1) + '%';
const configLabel = (c: EvalRunConfig) => `topK=${c.topK}, keywordTopK=${c.keywordTopK}, minScore=${c.minScore}, rerankTopN=${c.rerankTopN}`;
const fileNameOf = (fileId: number) => documents.value.find((d) => d.id === fileId)?.originalName ?? '#' + fileId;

const loadDocuments = async () => {
  try {
    documents.value = await uploadApi.listDocuments();
  } catch (error) {
    console.error(error);
    ElMessage.error('加载文档列表失败');
  }
};

const openAddCase = () => {
  newCase.value = { question: '', expectedFileId: null, expectedKeywords: [], note: '' };
  addCaseDialog.value = true;
};

const submitCase = async () => {
  if (!newCase.value.question.trim()) {
    ElMessage.warning('请输入问题');
    return;
  }
  if (!selectedSetId.value) return;
  addingCase.value = true;
  try {
    await evalApi.addCase(selectedSetId.value, {
      question: newCase.value.question,
      expectedFileId: newCase.value.expectedFileId,
      expectedKeywords: newCase.value.expectedKeywords,
      note: newCase.value.note || undefined,
    });
    addCaseDialog.value = false;
    await loadSetDetail(selectedSetId.value);
    ElMessage.success('用例添加成功');
  } catch (error) {
    console.error(error);
    ElMessage.error('添加用例失败：' + (error instanceof Error ? error.message : String(error)));
  } finally {
    addingCase.value = false;
  }
};

const openCompare = async () => {
  try {
    const settings = await settingsApi.getSettings();
    const current = { topK: settings.topK, keywordTopK: settings.keywordTopK, minScore: settings.minScore, rerankTopN: settings.rerankTopN };
    compareConfigs.value = { a: { ...current }, b: { ...current, minScore: Math.min(1, Number((current.minScore + 0.1).toFixed(2))) } };
    compareDialog.value = true;
  } catch (error) {
    console.error(error);
    ElMessage.error('读取当前检索参数失败');
  }
};

const compareEval = async () => {
  if (!selectedSetId.value) return;
  comparing.value = true;
  try {
    comparison.value = await evalApi.compareEval(selectedSetId.value, compareConfigs.value.a, compareConfigs.value.b);
    compareDialog.value = false;
    runDetail.value = comparison.value.a;
    await loadSetDetail(selectedSetId.value);
    ElMessage.success('A/B 对比完成');
  } catch (error) {
    console.error(error);
    ElMessage.error('A/B 对比失败：' + (error instanceof Error ? error.message : String(error)));
  } finally {
    comparing.value = false;
  }
};

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
  loadDocuments();
});
</script>
<style scoped>
.eval-content { height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 0 2px; }
.eval-toolbar { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.section-title { font-size: 14px; font-weight: 600; color: var(--kb-text-primary); margin: 4px 0; }
.eval-cases-title { display: flex; align-items: center; justify-content: space-between; }
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
.compare-configs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.compare-config { min-width: 0; }
.compare-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.compare-table th, .compare-table td { text-align: left; padding: 8px; border-bottom: 1px solid var(--kb-border-light); }
.compare-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; font-size: 12px; color: var(--kb-text-secondary); }
</style>

