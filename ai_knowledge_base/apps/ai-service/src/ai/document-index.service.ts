import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Repository } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import { OpenAIModelProvider } from './openai-model.provider.js';
import * as iconv from 'iconv-lite';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;
export const BATCH_SIZE = 10; // doubao-embedding limit per request

export interface IndexDocumentRequest {
  uploadFileId: number;
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
    private readonly models: OpenAIModelProvider,
  ) {}

  async indexDocument(request: IndexDocumentRequest): Promise<IndexDocumentResult> {
    let text = await this.extractText(request.filePath, request.originalName);
    // Prepend document filename once before splitting so it gets indexed
    // This enables searching by filename/title, but doesn't repeat filename in every chunk
    text = `文档名称：${request.originalName}\n\n${text}`;
    const chunks = await this.splitter.splitText(text);
    if (chunks.length === 0) {
      throw new BadRequestException('文档不包含可索引内容');
    }

    // Batch embeddings to respect doubao-embedding limit per request
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await this.models.embeddings.embedDocuments(batch);
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
          },
        }),
      ),
    );

    this.logger.log(`Indexed ${chunks.length} chunks for upload file ${request.uploadFileId}`);
    return { uploadFileId: request.uploadFileId, chunks: chunks.length };
  }

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

  // Check if text contains lots of replacement characters which indicates wrong encoding
  private hasGarbled(text: string): boolean {
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    // If more than 5% are replacement characters, it's probably garbled
    return replacementCount > text.length * 0.05;
  }

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

  private async extractDocxText(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

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
