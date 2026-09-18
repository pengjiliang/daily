/**
 * 文档索引服务：把 server 上传的文件解析为纯文本 → 递归切片 → 批量调用 Embedding
 * → 覆盖式写入 document_chunks（先删后插，支持重复索引同一文件）。
 * 支持格式：PDF / DOCX / XLSX / XLS / CSV / MD / TXT（含 GBK 编码自动探测）/ 常见图片（OCR）。
 * .doc 不支持，需用户另存为 .docx。
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Repository } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import { UserSettingsService } from '../settings/user-settings.service.js';
import { ModelProvider } from './openai-model.provider.js';
import * as iconv from 'iconv-lite';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

/** 每个切片的目标字符数 */
export const CHUNK_SIZE = 1000;
/** 相邻切片的重叠字符数，保留跨块上下文连续性 */
export const CHUNK_OVERLAP = 200;
/** Embedding 单次请求的最大文本数（豆包 embedding 接口限制） */
export const BATCH_SIZE = 10; // doubao-embedding limit per request

export interface IndexDocumentRequest {
  uploadFileId: number;
  /** 上传者用户 ID：使用该用户配置的向量模型建索引，检索也按用户隔离 */
  uploaderId: number;
  filePath: string;
  originalName: string;
  mimeType: string;
}

export interface IndexDocumentResult {
  uploadFileId: number;
  chunks: number;
}

@Injectable()
export class DocumentIndexService {
  private readonly logger = new Logger(DocumentIndexService.name);
  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  constructor(
    @InjectRepository(DocumentChunk)
    private readonly documentChunksRepository: Repository<DocumentChunk>,
    private readonly models: ModelProvider,
    private readonly userSettings: UserSettingsService,
  ) {}

  /** 索引主流程：抽取文本 → 文件名前置一次（支持按文件名检索）→ 切片 → 批量 Embedding → 先删后插覆盖入库 */
  async indexDocument(request: IndexDocumentRequest): Promise<IndexDocumentResult> {
    let text = await this.extractText(request.filePath, request.originalName);
    // Prepend document filename once before splitting so it gets indexed
    // This enables searching by filename/title, but doesn't repeat filename in every chunk
    text = `文档名称：${request.originalName}\n\n${text}`;
    const chunks = await this.splitter.splitText(text);
    if (chunks.length === 0) {
      throw new BadRequestException('文档不包含可索引内容');
    }

    // 使用该用户配置的向量模型（设置页可改，改后触发重建索引）
    const embeddingsModel = await this.models.getEmbeddings(request.uploaderId);
    const settings = await this.userSettings.getEffectiveSettings(request.uploaderId);

    // Batch embeddings to respect doubao-embedding limit per request
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await embeddingsModel.embedDocuments(batch);
      embeddings.push(...batchEmbeddings);
    }

    await this.documentChunksRepository.delete({ uploadFileId: request.uploadFileId });
    await this.documentChunksRepository.save(
      chunks.map((content, index) =>
        this.documentChunksRepository.create({
          uploadFileId: request.uploadFileId,
          content,
          embedding: embeddings[index],
          metadata: {
            originalName: request.originalName,
            mimeType: request.mimeType,
            chunkIndex: index,
            // 记录向量模型标识：切换向量模型重建后可区分新旧分块
            embeddingModel: settings.embedding.model,
          },
        }),
      ),
    );

    this.logger.log(`Indexed ${chunks.length} chunks for upload file ${request.uploadFileId}`);
    return { uploadFileId: request.uploadFileId, chunks: chunks.length };
  }

  /** 删除某上传文件的全部向量分块（文档删除时由 server 调用，避免孤儿分块残留被检索命中） */
  async deleteChunksByUploadFileId(uploadFileId: number): Promise<{ uploadFileId: number; deleted: number }> {
    const result = await this.documentChunksRepository.delete({ uploadFileId });
    this.logger.log(`Deleted ${result.affected ?? 0} chunks for upload file ${uploadFileId}`);
    return { uploadFileId, deleted: result.affected ?? 0 };
  }

  /** 按扩展名分派到对应解析器，统一去 BOM、换行归一化，并对空内容抛错 */
  private async extractText(filePath: string, originalName: string): Promise<string> {
    const extension = extname(originalName).toLowerCase();
    let text: string;

    if (extension === '.pdf') {
      text = await this.extractPdfText(filePath);
    } else if (extension === '.docx') {
      text = await this.extractDocxText(filePath);
    } else if (extension === '.doc') {
      throw new BadRequestException('.doc 格式不支持，请将文件另存为 .docx 格式后重新上传');
    } else if (extension === '.xlsx' || extension === '.xls') {
      text = await this.extractXlsxText(filePath);
    } else if (extension === '.csv' || extension === '.md' || extension === '.txt') {
      // Plain text formats - same encoding detection logic
      const buffer = await readFile(filePath);
      text = this.tryDecode(buffer);
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif'].includes(extension)) {
      text = await this.extractImageText(filePath);
    } else {
      // Fallback to plain text detection for unknown text-based formats
      const buffer = await readFile(filePath);
      text = this.tryDecode(buffer);
    }

    // Remove BOM if present
    text = text.replace(/^\uFEFF/, '');

    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (normalized.length === 0) {
      throw new BadRequestException('文档不包含可索引内容');
    }
    return normalized;
  }

  /** 依次尝试 UTF-8 / GBK / GB2312 / UTF-16LE，用替换字符比例判断乱码；全部失败则回退 latin1 */
  private tryDecode(buffer: Buffer): string {
    // Try UTF-8 first
    try {
      const text = buffer.toString('utf8');
      if (!this.hasGarbled(text)) {
        return text;
      }
    } catch (e) {}

    // Try GBK / GB2312
    try {
      const text = iconv.decode(buffer, 'gbk');
      if (!this.hasGarbled(text)) {
        return text;
      }
    } catch (e) {}

    // Try GB2312
    try {
      const text = iconv.decode(buffer, 'gb2312');
      if (!this.hasGarbled(text)) {
        return text;
      }
    } catch (e) {}

    // Try UTF-16LE
    try {
      const text = buffer.toString('utf16le');
      if (!this.hasGarbled(text)) {
        return text;
      }
    } catch (e) {}

    // Fallback to latin1
    return buffer.toString('latin1');
  }

  /** 乱码探测：U+FFFD 替换字符超过文本 5% 即认为当前编码不正确 */
  // Check if text contains lots of replacement characters which indicates wrong encoding
  private hasGarbled(text: string): boolean {
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    // If more than 5% are replacement characters, it's probably garbled
    return replacementCount > text.length * 0.05;
  }

  /** 解析 PDF 文本（动态加载 pdf-parse，避免影响其他格式的启动开销） */
  private async extractPdfText(filePath: string): Promise<string> {
    const { PDFParse } = await import('pdf-parse');
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  /** 解析 .docx：mammoth 抽取纯文本（丢弃样式与图片） */
  private async extractDocxText(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  /** 解析 Excel：遍历所有工作表，单元格用制表符拼接、行用换行拼接，并标注工作表名 */
  private async extractXlsxText(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const texts: string[] = [];

    // Iterate all sheets
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      // Convert sheet to 2D array of cells
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
      // Join cell values with tabs, rows with newlines
      const sheetText = json.map((row) => row.map((cell) => String(cell ?? '')).join('\t')).join('\n');
      texts.push(`工作表：${sheetName}\n${sheetText}`);
    });

    return texts.join('\n\n');
  }

  /** OCR 解析图片：tesseract 中英文模型识别，用完即销毁 worker 释放资源 */
  private async extractImageText(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const worker = await createWorker('chi_sim+eng');
    try {
      const {
        data: { text },
      } = await worker.recognize(buffer);
      return text;
    } finally {
      await worker.terminate();
    }
  }
}