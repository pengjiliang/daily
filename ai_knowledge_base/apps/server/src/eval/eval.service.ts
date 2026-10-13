/**
 * 评估服务（亮点 3：RAG 评估与回归看板）。
 * - 评估集/用例 CRUD（用户私有）；
 * - 运行评估：逐题调用 ai-service /ai/retrieve/debug（复用现有检索链路，含 LLM 重排），
 *   计算 recall@k / MRR / 空答率 / 引用准确率 / 平均耗时，写入 eval_runs + eval_results；
 * - 历史运行列表 / 明细查询。
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type {
  EvalCase as EvalCaseView,
  EvalRun as EvalRunRecord,
  EvalRunConfig,
  EvalRunView as EvalRunViewResult,
  EvalSet as EvalSetView,
  RetrieveDebugView,
  RetrieveLegItem,
} from '@ai-knowledge-base/shared';
import { aiServiceHeaders } from '../ai/ai-service-headers.js';
import { EvalCase } from './eval-case.entity.js';
import { EvalResult } from './eval-result.entity.js';
import { EvalRun as EvalRunEntity } from './eval-run.entity.js';
import { EvalSet as EvalSetEntity } from './eval-set.entity.js';

/** 运行评估时逐题的检索调用上限（防恶意超大问题集拖垮服务） */
const EVAL_MAX_CASES = 200;

@Injectable()
export class EvalService {
  constructor(
    @InjectRepository(EvalSetEntity)
    private readonly evalSetsRepository: Repository<EvalSetEntity>,
    @InjectRepository(EvalCase)
    private readonly evalCasesRepository: Repository<EvalCase>,
    @InjectRepository(EvalRunEntity)
    private readonly evalRunsRepository: Repository<EvalRunEntity>,
    @InjectRepository(EvalResult)
    private readonly evalResultsRepository: Repository<EvalResult>,
    private readonly configService: ConfigService,
  ) {}

  // ---- 评估集 CRUD ----

  /** 当前用户的评估集列表（附用例数） */
  async listSets(userId: number): Promise<(EvalSetView & { caseCount: number })[]> {
    const sets = await this.evalSetsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const counts = new Map<number, number>();
    if (sets.length > 0) {
      const rows = (await this.evalCasesRepository
        .createQueryBuilder('c')
        .select('c."evalSetId" AS "evalSetId"')
        .addSelect('COUNT(*)::int AS count')
        .where('c."evalSetId" IN (:...ids)', { ids: sets.map((s) => s.id) })
        .groupBy('c."evalSetId"')
        .getRawMany()) as { evalSetId: number; count: number }[];
      rows.forEach((row) => counts.set(row.evalSetId, row.count));
    }
    return sets.map((set) => ({ ...this.toSetView(set), caseCount: counts.get(set.id) ?? 0 }));
  }

  async createSet(userId: number, name: string, description?: string): Promise<EvalSetView> {
    if (!name.trim()) {
      throw new BadRequestException('评估集名称不能为空');
    }
    const set = await this.evalSetsRepository.save(
      this.evalSetsRepository.create({
        userId,
        name: name.trim().slice(0, 100),
        description: description?.trim() || null,
      }),
    );
    return this.toSetView(set);
  }

  /** 评估集详情（含用例列表），校验归属 */
  async getSet(userId: number, setId: number): Promise<EvalSetView & { cases: EvalCaseView[] }> {
    const set = await this.evalSetsRepository.findOne({
      where: { id: setId },
      relations: { cases: true },
    });
    if (!set) {
      throw new NotFoundException('评估集不存在');
    }
    if (set.userId !== userId) {
      throw new ForbiddenException('只能访问自己的评估集');
    }
    const cases: EvalCaseView[] = (set.cases ?? [])
      .sort((a, b) => a.id - b.id)
      .map((c) => this.toCaseView(c));
    return { ...this.toSetView(set), cases };
  }

  /** 删除评估集（级联删用例与运行记录） */
  async deleteSet(userId: number, setId: number): Promise<void> {
    const set = await this.evalSetsRepository.findOneBy({ id: setId });
    if (!set) {
      throw new NotFoundException('评估集不存在');
    }
    if (set.userId !== userId) {
      throw new ForbiddenException('只能删除自己的评估集');
    }
    // 先按 set 找出所有 run 清 results，再删（TypeORM 无跨表级联时手动清理）
    const runs = await this.evalRunsRepository.find({ where: { evalSetId: setId } });
    const runIds = runs.map((r) => r.id);
    if (runIds.length > 0) {
      await this.evalResultsRepository.delete({ runId: In(runIds) });
      await this.evalRunsRepository.delete({ evalSetId: setId });
    }
    await this.evalCasesRepository.delete({ evalSetId: setId });
    await this.evalSetsRepository.remove(set);
  }

  // ---- 用例 CRUD ----

  async addCase(
    userId: number,
    setId: number,
    input: { question?: string; expectedFileId?: number | null; expectedKeywords?: string[]; note?: string },
  ): Promise<EvalCaseView> {
    await this.requireOwnedSet(userId, setId);
    if (!input.question?.trim()) {
      throw new BadRequestException('问题不能为空');
    }
    const evalCase = await this.evalCasesRepository.save(
      this.evalCasesRepository.create({
        evalSetId: setId,
        question: (input.question as string).trim().slice(0, 2000),
        expectedFileId: input.expectedFileId ?? null,
        expectedKeywords: Array.isArray(input.expectedKeywords) ? input.expectedKeywords.slice(0, 10) : [],
        note: input.note?.trim() || null,
      }),
    );
    return this.toCaseView(evalCase);
  }

  async updateCase(
    userId: number,
    caseId: number,
    input: { question?: string; expectedFileId?: number | null; expectedKeywords?: string[]; note?: string },
  ): Promise<EvalCaseView> {
    const evalCase = await this.evalCasesRepository.findOneBy({ id: caseId });
    if (!evalCase) {
      throw new NotFoundException('用例不存在');
    }
    await this.requireOwnedSet(userId, evalCase.evalSetId);
    if (input.question !== undefined) {
      if (!input.question.trim()) {
        throw new BadRequestException('问题不能为空');
      }
      evalCase.question = input.question.trim().slice(0, 2000);
    }
    if (input.expectedFileId !== undefined) {
      evalCase.expectedFileId = input.expectedFileId;
    }
    if (input.expectedKeywords !== undefined) {
      evalCase.expectedKeywords = input.expectedKeywords.slice(0, 10);
    }
    if (input.note !== undefined) {
      evalCase.note = input.note?.trim() || null;
    }
    const saved = await this.evalCasesRepository.save(evalCase);
    return this.toCaseView(saved);
  }

  async deleteCase(userId: number, caseId: number): Promise<void> {
    const evalCase = await this.evalCasesRepository.findOneBy({ id: caseId });
    if (!evalCase) {
      throw new NotFoundException('用例不存在');
    }
    await this.requireOwnedSet(userId, evalCase.evalSetId);
    await this.evalCasesRepository.remove(evalCase);
  }

  // ---- 运行评估 ----

  /**
   * 运行一次评估：逐题调 ai-service /ai/retrieve/debug 取 kept，
   * 计算指标并落库。retrieveSec 用 server 侧计时（debugRetrieve 不返回耗时），
   * answerSec 记为 0（评估只跑检索、不生成答案，符合文档"省钱、秒级"）。
   */
  async runEval(userId: number, setId: number, configOverride?: EvalRunConfig): Promise<EvalRunViewResult> {
    const set = await this.requireOwnedSet(userId, setId);
    const cases = await this.evalCasesRepository.find({
      where: { evalSetId: setId },
      order: { id: 'ASC' },
    });
    if (cases.length === 0) {
      throw new BadRequestException('评估集还没有用例');
    }
    if (cases.length > EVAL_MAX_CASES) {
      throw new BadRequestException(`用例数超过上限（${EVAL_MAX_CASES}）`);
    }

    const config = configOverride ?? (await this.loadRunConfig(userId));
    const run = await this.evalRunsRepository.save(
      this.evalRunsRepository.create({
        evalSetId: setId,
        config,
        caseCount: cases.length,
        recallAtK: 0,
        mrr: 0,
        emptyRate: 0,
        citationAccuracy: 0,
        avgRetrieveSec: 0,
        avgAnswerSec: 0,
      }),
    );

    const results = [];
    let hitCount = 0;
    let mrrSum = 0;
    let emptyCount = 0;
    let citationCount = 0;
    let retrieveSecSum = 0;

    for (const evalCase of cases) {
      const { view, retrieveSec } = await this.retrieveForCase(userId, evalCase.question, config);
      const kept = view.kept ?? [];
      const result = this.computeCaseResult(evalCase, kept, retrieveSec);
      results.push(result);
      if (result.hitExpectedFile) hitCount += 1;
      mrrSum += result.mrrContribution;
      if (result.empty) emptyCount += 1;
      if (result.citationHit) citationCount += 1;
      retrieveSecSum += result.retrieveSec;
      await this.evalResultsRepository.save(
        this.evalResultsRepository.create({
          runId: run.id,
          caseId: evalCase.id,
          question: evalCase.question,
          expectedFileId: evalCase.expectedFileId,
          expectedKeywords: evalCase.expectedKeywords ?? [],
          hitExpectedFile: result.hitExpectedFile,
          expectedFileRank: result.expectedFileRank,
          mrrContribution: result.mrrContribution,
          empty: result.empty,
          citationHit: result.citationHit,
          retrieveSec: result.retrieveSec,
          answerSec: result.answerSec,
          kept,
        }),
      );
    }

    const n = cases.length;
    run.recallAtK = round(hitCount / n);
    run.mrr = round(mrrSum / n);
    run.emptyRate = round(emptyCount / n);
    run.citationAccuracy = round(citationCount / n);
    run.avgRetrieveSec = round(retrieveSecSum / n);
    run.avgAnswerSec = 0;
    await this.evalRunsRepository.save(run);

    return { run: this.toRunView(run), results };
  }

  async compareEval(
    userId: number,
    setId: number,
    configA: EvalRunConfig,
    configB: EvalRunConfig,
  ): Promise<{ a: EvalRunViewResult; b: EvalRunViewResult }> {
    const a = await this.runEval(userId, setId, configA);
    const b = await this.runEval(userId, setId, configB);
    return { a, b };
  }

  /** 历史运行列表（按时间倒序） */
  async listRuns(userId: number, setId: number): Promise<EvalRunRecord[]> {
    await this.requireOwnedSet(userId, setId);
    const runs = await this.evalRunsRepository.find({
      where: { evalSetId: setId },
      order: { createdAt: 'DESC' },
    });
    return runs.map((run) => this.toRunView(run));
  }

  /** 运行明细（聚合指标 + 逐题结果） */
  async getRun(userId: number, runId: number): Promise<EvalRunViewResult> {
    const run = await this.evalRunsRepository.findOneBy({ id: runId });
    if (!run) {
      throw new NotFoundException('评估运行不存在');
    }
    await this.requireOwnedSet(userId, run.evalSetId);
    const rows = await this.evalResultsRepository.find({
      where: { runId },
      order: { id: 'ASC' },
    });
    return {
      run: this.toRunView(run),
      results: rows.map((row) => ({
        caseId: row.caseId,
        question: row.question,
        expectedFileId: row.expectedFileId,
        expectedKeywords: row.expectedKeywords ?? [],
        hitExpectedFile: row.hitExpectedFile,
        expectedFileRank: row.expectedFileRank,
        mrrContribution: row.mrrContribution,
        empty: row.empty,
        citationHit: row.citationHit,
        retrieveSec: row.retrieveSec,
        answerSec: row.answerSec,
        kept: row.kept ?? [],
      })),
    };
  }

  // ---- 内部方法 ----

  /** 取用户当前检索参数作为运行快照（与 ai-service 生效值一致） */
  private async loadRunConfig(userId: number): Promise<EvalRunConfig> {
    // 直接读 ai_settings 表（server 与 ai-service 同库）：字段为空时回退默认值
    const rows = (await this.evalRunsRepository.query(
      'SELECT "topK", "keywordTopK", "minScore", "rerankTopN" FROM ai_settings WHERE "userId" = $1',
      [userId],
    )) as Array<{ topK: number | null; keywordTopK: number | null; minScore: number | null; rerankTopN: number | null }>;
    const row = rows[0] ?? {};
    return {
      topK: row.topK ?? 8,
      keywordTopK: row.keywordTopK ?? 8,
      minScore: row.minScore ?? 0.3,
      rerankTopN: row.rerankTopN ?? 5,
    };
  }

  /** 调 ai-service 检索调试，server 侧计时 */
  private async retrieveForCase(
    userId: number,
    question: string,
    config: EvalRunConfig,
  ): Promise<{ view: RetrieveDebugView; retrieveSec: number }> {
    const aiServiceUrl = this.configService.get<string>('aiService.url', 'http://localhost:3001');
    const startedAt = Date.now();
    const response = await fetch(`${aiServiceUrl}/ai/retrieve/debug`, {
      method: 'POST',
      headers: aiServiceHeaders(this.configService),
      body: JSON.stringify({ question, userId, config }),
    });
    if (!response.ok) {
      let message = `AI service responded with ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body?.message) message = body.message;
      } catch {
        // 忽略
      }
      throw new BadRequestException(`检索失败：${message}`);
    }
    const view = (await response.json()) as RetrieveDebugView;
    return { view, retrieveSec: round((Date.now() - startedAt) / 1000) };
  }

  /** 单题指标计算 */
  private computeCaseResult(
    evalCase: EvalCase,
    kept: (RetrieveLegItem & { similarity: number })[],
    retrieveSec: number,
  ): EvalCaseResultLike {
    const empty = kept.length === 0;
    // 期望文件命中的名次（kept 中第一个 uploadFileId 匹配的，1 起）
    let expectedFileRank: number | null = null;
    if (evalCase.expectedFileId != null) {
      const index = kept.findIndex((item) => item.uploadFileId === evalCase.expectedFileId);
      if (index >= 0) expectedFileRank = index + 1;
    }
    const hitExpectedFile = expectedFileRank !== null;
    // 引用准确率：kept 内容命中任一期望关键词
    const keywords = (evalCase.expectedKeywords ?? []).filter((k) => k.trim());
    const citationHit =
      keywords.length > 0
        ? kept.some((item) => keywords.some((keyword) => item.content.includes(keyword)))
        : hitExpectedFile;
    return {
      caseId: evalCase.id,
      question: evalCase.question,
      expectedFileId: evalCase.expectedFileId,
      expectedKeywords: evalCase.expectedKeywords ?? [],
      hitExpectedFile,
      expectedFileRank,
      mrrContribution: expectedFileRank ? 1 / expectedFileRank : 0,
      empty,
      citationHit,
      retrieveSec,
      answerSec: 0,
      kept,
    };
  }

  private async requireOwnedSet(userId: number, setId: number): Promise<EvalSetEntity> {
    const set = await this.evalSetsRepository.findOneBy({ id: setId });
    if (!set) {
      throw new NotFoundException('评估集不存在');
    }
    if (set.userId !== userId) {
      throw new ForbiddenException('只能访问自己的评估集');
    }
    return set;
  }

  private toSetView(set: EvalSetEntity): EvalSetView {
    return {
      id: set.id,
      userId: set.userId,
      name: set.name,
      description: set.description,
      createdAt: set.createdAt.toISOString(),
    };
  }

  private toCaseView(c: EvalCase): EvalCaseView {
    return {
      id: c.id,
      evalSetId: c.evalSetId,
      question: c.question,
      expectedFileId: c.expectedFileId,
      expectedKeywords: c.expectedKeywords ?? [],
      note: c.note,
    };
  }

  private toRunView(run: EvalRunEntity): EvalRunRecord {
    return {
      id: run.id,
      evalSetId: run.evalSetId,
      config: run.config,
      caseCount: run.caseCount,
      recallAtK: run.recallAtK,
      mrr: run.mrr,
      emptyRate: run.emptyRate,
      citationAccuracy: run.citationAccuracy,
      avgRetrieveSec: run.avgRetrieveSec,
      avgAnswerSec: run.avgAnswerSec,
      createdAt: run.createdAt.toISOString(),
    };
  }
}

/** 单题结果结构（返回前不落库的中间形态） */
interface EvalCaseResultLike {
  caseId: number;
  question: string;
  expectedFileId: number | null;
  expectedKeywords: string[];
  hitExpectedFile: boolean;
  expectedFileRank: number | null;
  mrrContribution: number;
  empty: boolean;
  citationHit: boolean;
  retrieveSec: number;
  answerSec: number;
  kept: (RetrieveLegItem & { similarity: number })[];
}

/** 保留 4 位小数 */
function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

