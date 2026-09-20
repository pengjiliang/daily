/**
 * 实体级知识图谱抽取服务：文档索引完成后，调用该用户的 LLM 从文档文本中抽取
 * 「实体A —关系— 实体B」三元组，写入 graph_entities / graph_relations 两表。
 * - 先删后插（按 uploadFileId），支持重复索引同一文件、向量模型切换后的重建；
 * - 全程容错：任何异常仅告警，绝不影响文档索引主流程；
 * - 抽取是后台任务（调用方 fire-and-forget），不阻塞上传/重建索引响应。
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphEntity } from '../entities/graph-entity.entity.js';
import { GraphRelation } from '../entities/graph-relation.entity.js';
import { ModelProvider } from './openai-model.provider.js';

/** 抽取文本采样上限：超过只取开头一段（控制单次 LLM 调用成本） */
const EXTRACT_TEXT_LIMIT = 6000;
/** 单文档抽取三元组条数上限（防模型输出爆炸） */
const TRIPLE_LIMIT = 24;
/** 实体名最长长度（防模型输出超长实体名） */
const NAME_LIMIT = 40;
/** 允许的实体类型白名单 */
const ALLOWED_TYPES = ['人物', '组织', '地点', '概念', '项目', '产品', '事件', '其他'];

interface EntityTriple {
  entityA: string;
  typeA: string;
  relation: string;
  entityB: string;
  typeB: string;
}

@Injectable()
export class EntityExtractionService {
  private readonly logger = new Logger(EntityExtractionService.name);

  constructor(
    @InjectRepository(GraphEntity)
    private readonly entityRepository: Repository<GraphEntity>,
    @InjectRepository(GraphRelation)
    private readonly relationRepository: Repository<GraphRelation>,
    private readonly models: ModelProvider,
  ) {}

  /** 重建某文档的实体图谱：删除旧数据 → LLM 抽取 → 入库。任何失败仅告警 */
  async rebuildForDocument(request: { uploadFileId: number; userId: number; text: string }): Promise<void> {
    try {
      const triples = await this.extractTriples(request.text, request.userId);
      await this.entityRepository.delete({ uploadFileId: request.uploadFileId });
      await this.relationRepository.delete({ uploadFileId: request.uploadFileId });
      if (triples.length === 0) {
        this.logger.log(`No entities extracted for upload file ${request.uploadFileId}`);
        return;
      }
      await this.saveTriples(request.uploadFileId, request.userId, triples);
      this.logger.log(`Extracted ${triples.length} triples for upload file ${request.uploadFileId}`);
    } catch (error) {
      this.logger.warn(`Entity extraction failed for upload file ${request.uploadFileId}: ${String(error)}`);
    }
  }

  /** 调用 LLM 抽取三元组，解析失败返回空数组 */
  private async extractTriples(text: string, userId: number): Promise<EntityTriple[]> {
    const chatModel = await this.models.getChatModel(userId);
    const sample = text.slice(0, EXTRACT_TEXT_LIMIT);
    const systemPrompt = [
      '你是知识图谱实体抽取助手。从用户提供的文档文本中抽取关键实体以及它们之间的关系。',
      `实体类型仅限：${ALLOWED_TYPES.join('、')}。`,
      '输出必须只包含一个合法 JSON 数组，不要 Markdown 代码块，不要任何解释文字：',
      '[{"entityA":"实体名","typeA":"人物","relation":"关系动词短语","entityB":"实体名","typeB":"组织"}]',
      `要求：实体名精简完整、不带多余修饰；关系用动词短语；只抽取文档中明确出现的关系；至少 3 条、最多 ${TRIPLE_LIMIT} 条，宁缺毋滥。`,
    ].join('\n');
    const response = await chatModel.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `文档内容：\n\n${sample}` },
    ]);
    return this.parseTriples(response.text);
  }

  /** 解析模型返回的 JSON 数组，逐条清洗过滤（空名/自环/超长/非法类型） */
  private parseTriples(raw: string): EntityTriple[] {
    const jsonText = this.extractJson(raw);
    if (!jsonText) {
      return [];
    }
    try {
      const data = JSON.parse(jsonText) as unknown;
      if (!Array.isArray(data)) {
        return [];
      }
      const triples: EntityTriple[] = [];
      for (const item of data) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const record = item as Record<string, unknown>;
        const entityA = this.cleanName(record.entityA);
        const entityB = this.cleanName(record.entityB);
        const relation = this.cleanName(record.relation);
        if (!entityA || !entityB || !relation || entityA === entityB) {
          continue;
        }
        triples.push({
          entityA,
          typeA: this.normalizeType(record.typeA),
          relation,
          entityB,
          typeB: this.normalizeType(record.typeB),
        });
        if (triples.length >= TRIPLE_LIMIT) {
          break;
        }
      }
      return triples;
    } catch (error) {
      this.logger.warn(`Failed to parse entity triples: ${String(error)}`);
      return [];
    }
  }

  /** 清洗实体/关系文本：去首尾空白、压缩空白、截断超长 */
  private cleanName(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    const name = value.trim().replace(/\s+/g, ' ');
    return name.length > NAME_LIMIT ? name.slice(0, NAME_LIMIT) : name;
  }

  /** 实体类型归一到白名单，未知类型一律归为"其他" */
  private normalizeType(value: unknown): string {
    if (typeof value !== 'string') {
      return '其他';
    }
    const type = value.trim();
    return ALLOWED_TYPES.includes(type) ? type : '其他';
  }

  /** 从模型文本中截取最外层 [ ... ] JSON（兼容代码围栏与前后多余文字） */
  private extractJson(raw: string): string {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1);
    }
    return '';
  }

  /** 实体去重（同类型同名只存一条）+ 关系去重（同源同目标同关系只存一条）后入库 */
  private async saveTriples(uploadFileId: number, userId: number, triples: EntityTriple[]): Promise<void> {
    const entityByName = new Map<string, GraphEntity>();
    for (const triple of triples) {
      const keyA = `${triple.typeA}::${triple.entityA}`;
      const keyB = `${triple.typeB}::${triple.entityB}`;
      if (!entityByName.has(keyA)) {
        entityByName.set(keyA, this.entityRepository.create({ uploadFileId, userId, name: triple.entityA, entityType: triple.typeA }));
      }
      if (!entityByName.has(keyB)) {
        entityByName.set(keyB, this.entityRepository.create({ uploadFileId, userId, name: triple.entityB, entityType: triple.typeB }));
      }
    }
    const savedEntities = await this.entityRepository.save(Array.from(entityByName.values()));
    const idByName = new Map<string, number>();
    for (const entity of savedEntities) {
      idByName.set(`${entity.entityType}::${entity.name}`, entity.id);
    }

    const relationKey = new Set<string>();
    const relations: GraphRelation[] = [];
    for (const triple of triples) {
      const sourceId = idByName.get(`${triple.typeA}::${triple.entityA}`);
      const targetId = idByName.get(`${triple.typeB}::${triple.entityB}`);
      if (sourceId === undefined || targetId === undefined || sourceId === targetId) {
        continue;
      }
      const key = `${sourceId}|${targetId}|${triple.relation}`;
      if (relationKey.has(key)) {
        continue;
      }
      relationKey.add(key);
      relations.push(
        this.relationRepository.create({
          uploadFileId,
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          relation: triple.relation,
        }),
      );
    }
    if (relations.length > 0) {
      await this.relationRepository.save(relations);
    }
  }
}
