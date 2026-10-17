/**
 * 上传服务：头像落库、文档落库与异步建索引、文档列表/下载/删除（含归属与路径穿越防护），
 * 并在删除文档后通知 ai-service 清理向量分块。
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import type { ReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, sep, join, extname } from 'node:path';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service.js';
import { ShareService } from '../share/share.service.js';
import type { SharePermission } from '../share/share.entity.js';
import { UploadFile } from './upload-file.entity.js';
import { DOCUMENTS_DIRECTORY, UPLOAD_ROOT } from './upload.storage.js';
import { aiServiceHeaders } from '../ai/ai-service-headers.js';
import type { IndexErrorKind } from '@ai-knowledge-base/shared';
import { Buffer } from 'node:buffer';

/** 索引自愈：失败后指数退避最多重试次数（超过则标记 failed，由用户手动重试） */
const INDEX_MAX_ATTEMPTS = 3;
/** 指数退避基准间隔（秒）：第 n 次重试等待 base * 2^(n-1)（10s → 30s → 60s） */
const INDEX_RETRY_BASE_SECONDS = 10;
/** 同时索引的文档数，兼顾批量处理速度与向量服务负载 */
const INDEX_CONCURRENCY = 4;

/**
 * 兼容多种编码的原始文件名解码：
 * multer 拿到的 originalname 可能是百分号编码，也可能被按 Latin1 误读；
 * 依次尝试 percent-decode 与 Latin1→UTF-8 还原，哪种结果包含中文就用哪种，都不行返回最后结果。
 */
function decodeFileName(filename: string): string {
  // Try multiple methods to decode Chinese filename
  // Method 1: percent-decode
  try {
    const decoded = decodeURIComponent(filename);
    if (decoded.match(/[\u4e00-\u9fa5]/)) {
      return decoded;
    }
  } catch {}

  // Method 2: convert from ISO-8859-1 to UTF-8 (fixes most garbling)
  const buffer = Buffer.from(filename, 'latin1');
  let result = buffer.toString('utf8');
  if (result.match(/[\u4e00-\u9fa5]/)) {
    return result;
  }

  // Method 3: try GBK/GB2312
  try {
    // If still garbled, iconv-lite would help but we can try buffer.toString('utf16le')
    // Fallback to original
  } catch {}

  return result;
}

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private readonly indexQueue: Array<{ uploadFile: UploadFile; absolutePath: string }> = [];
  private activeIndexJobs = 0;

  constructor(
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly shareService: ShareService,
    private readonly dataSource: DataSource,
  ) {}

  /** 服务重启后修复遗留的索引状态，避免旧文档永久显示为等待索引。 */
  async onModuleInit(): Promise<void> {
    let staleDocuments: Array<{ id: number; chunkCount: number }>;
    try {
      staleDocuments = await this.dataSource.query(
        `SELECT file.id, COUNT(chunk.id)::int AS "chunkCount"
         FROM upload_files file
         LEFT JOIN document_chunks chunk ON chunk."uploadFileId" = file.id
         WHERE file."indexStatus" IN ('pending', 'running')
         GROUP BY file.id`,
      );
    } catch (error) {
      this.logger.warn(`Could not recover pending document indexes: ${String(error)}`);
      return;
    }

    for (const stale of staleDocuments) {
      const document = await this.uploadFilesRepository.findOneBy({ id: stale.id });
      if (!document) continue;

      if (stale.chunkCount > 0) {
        await this.uploadFilesRepository.update(document.id, {
          indexStatus: 'done',
          chunkCount: stale.chunkCount,
          indexedAt: document.indexedAt ?? new Date(),
          indexError: null,
          errorKind: null,
        });
        continue;
      }

      this.queueIndexing(document, this.resolveSafeDocumentPath(document.path));
    }
  }

  /** 保存头像：把静态访问 URL 更新到用户资料，返回 URL 与脱敏后的用户信息 */
  async saveAvatar(userId: number, file: Express.Multer.File) {
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const user = await this.usersService.update(userId, { avatarUrl });
    const { password: _password, ...publicUser } = user;
    return { avatarUrl, user: publicUser };
  }

  /** 保存文档元数据并立即返回；向量索引在 setImmediate 后台异步进行，不阻塞上传响应 */
  async saveDocument(
    userId: number,
    file: Express.Multer.File,
    folderName?: string,
  ): Promise<UploadFile> {
    const originalName = decodeFileName(file.originalname);
    // 前置拦截必然失败的输入（亮点 1）：.doc 无法解析，直接提示用户另存为 .docx，避免落入索引流水线
    if (extname(originalName).toLowerCase() === '.doc') {
      throw new BadRequestException('.doc 格式不支持，请将文件另存为 .docx 格式后重新上传');
    }
    const uploadFile = await this.uploadFilesRepository.save(
      this.uploadFilesRepository.create({
        filename: file.filename,
        originalName,
        // 文件夹上传时前端显式传入文件夹相对路径（如 `2026/文档`）；单文件上传为 NULL
        folderName: folderName?.trim() || null,
        mimeType: file.mimetype,
        path: `documents/${file.filename}`,
        size: file.size,
        uploaderId: userId,
        indexStatus: 'pending',
      }),
    );

    // 异步排队处理，不阻塞响应
    this.queueIndexing(uploadFile, file.path);
    return uploadFile;
  }

  /**
   * 粘贴文本导入（多源导入·文本源）：把文本写入 uploads/documents 下的 .txt 文件并落库，
   * 随后异步触发 ai-service 建索引（与文件上传共用同一索引链路）。
   */
  async saveTextDocument(
    userId: number,
    title: string | undefined,
    content: string,
  ): Promise<UploadFile> {
    const originalName = (title?.trim() || '粘贴文本').slice(0, 255);
    const filename = `${randomUUID()}.txt`;
    const absolutePath = join(DOCUMENTS_DIRECTORY, filename);
    mkdirSync(DOCUMENTS_DIRECTORY, { recursive: true });
    await writeFile(absolutePath, content, 'utf8');

    const uploadFile = await this.uploadFilesRepository.save(
      this.uploadFilesRepository.create({
        filename,
        originalName,
        folderName: null,
        mimeType: 'text/plain',
        path: `documents/${filename}`,
        size: Buffer.byteLength(content, 'utf8'),
        uploaderId: userId,
        indexStatus: 'pending',
      }),
    );

    // 异步排队索引，不阻塞响应
    this.queueIndexing(uploadFile, absolutePath);
    return uploadFile;
  }

  /**
   * 当前用户可见的文档列表（按上传时间倒序）：自己上传的 + 共享给我的。
   * 自己上传的 sharedByUsername/sharedPermission 为 null；共享来的带来源用户名与权限，
   * 前端据此区分「我的文档 / 共享给我的」并控制可执行操作。
   */
  async listDocuments(userId: number): Promise<DocumentListItem[]> {
    const own = await this.uploadFilesRepository.find({
      where: { uploaderId: userId },
      order: { createdAt: 'DESC' },
    });
    const shared = await this.shareService.listSharedUploadFiles(userId);
    return [
      ...own.map((file) => ({ ...file, sharedByUsername: null, sharedPermission: null })),
      ...shared,
    ];
  }

  /** 仅当前用户自己上传的文档（重建索引用，不含共享给我的） */
  listOwnedDocuments(userId: number): Promise<UploadFile[]> {
    return this.uploadFilesRepository.find({
      where: { uploaderId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** 取下载所需的文件流与元信息：校验归属、防路径穿越、文件缺失抛 404 */
  async getDocumentDownload(
    id: number,
    userId: number,
  ): Promise<{
    stream: ReadStream;
    mimeType: string;
    originalName: string;
    size: number;
  }> {
    const uploadFile = await this.findAccessibleDocument(id, userId);
    const filePath = this.resolveSafeDocumentPath(uploadFile.path);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Document file is missing');
    }

    return {
      stream: createReadStream(filePath),
      mimeType: uploadFile.mimeType || 'application/octet-stream',
      originalName: uploadFile.originalName,
      size: Number(uploadFile.size),
    };
  }

  /** 重命名文档并同步更新检索引用中的展示名。 */
  async renameDocument(id: number, userId: number, originalName: string): Promise<UploadFile> {
    const uploadFile = await this.uploadFilesRepository.findOneBy({ id });
    if (!uploadFile) {
      throw new NotFoundException('Document not found');
    }
    if (uploadFile.uploaderId !== userId && !(await this.shareService.hasEditAccess(id, userId))) {
      throw new ForbiddenException('You can only rename documents you own or have edit permission on');
    }
    const name = originalName.trim();
    if (!name) {
      throw new BadRequestException('文件名不能为空');
    }
    if (name.length > 255) {
      throw new BadRequestException('文件名过长（最多 255 字符）');
    }
    uploadFile.originalName = name;
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(uploadFile);
      await manager.query(
        `UPDATE document_chunks
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('originalName', $2)
          WHERE "uploadFileId" = $1`,
        [id, name],
      );
      return saved;
    });
  }

  /** 删除文档：本地文件（ENOENT 容忍）+ 库记录 + ai-service 向量分块清理 */
  async deleteDocument(id: number, userId: number): Promise<void> {
    const uploadFile = await this.findOwnedDocument(id, userId);
    const filePath = this.resolveSafeDocumentPath(uploadFile.path);
    // remove() 会清空实体的主键，先保存 id 与 uploaderId 供后续清理调用使用
    const uploadFileId = uploadFile.id;
    const uploaderId = uploadFile.uploaderId;

    try {
      await unlink(filePath);
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
    await this.uploadFilesRepository.remove(uploadFile);

    // 清理该文档的全部共享记录（文档已删除，共享随之失效）
    await this.shareService.removeSharesForDocument(uploadFileId);

    // 同步清理 ai-service 中该文件的分块：否则孤儿分块会继续被检索命中（同一文件名出现多条来源）
    await this.requestChunkPurge(uploadFileId);
    // 知识库内容变化：清掉该用户语义缓存，避免同类问题命中过期答案
    await this.requestCacheInvalidate(uploaderId);
  }

  /** 通知 ai-service 删除某上传文件的全部向量分块；失败仅告警，不影响文档删除本身 */
  private async requestChunkPurge(uploadFileId: number): Promise<void> {
    const aiServiceUrl = this.configService.get<string>('aiService.url', 'http://localhost:3001');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(`${aiServiceUrl}/ai/document/${uploadFileId}`, {
        method: 'DELETE',
        headers: aiServiceHeaders(this.configService),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(`AI chunk purge for document ${uploadFileId} failed with ${response.status}`);
      } else {
        this.logger.log(`AI chunk purge complete for document ${uploadFileId}`);
      }
    } catch (error) {
      this.logger.warn(`AI chunk purge for document ${uploadFileId} could not be delivered: ${String(error)}`);
    }
  }

  /** 通知 ai-service 清空某用户语义缓存（文档索引完成/删除后调用，保证缓存不返回过期答案） */
  private async requestCacheInvalidate(userId: number): Promise<void> {
    const aiServiceUrl = this.configService.get<string>('aiService.url', 'http://localhost:3001');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${aiServiceUrl}/ai/cache/invalidate`, {
        method: 'POST',
        headers: aiServiceHeaders(this.configService),
        body: JSON.stringify({ userId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        this.logger.warn(`Semantic cache invalidate for user ${userId} failed with ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Semantic cache invalidate for user ${userId} could not be delivered: ${String(error)}`);
    }
  }

  /**
   * 按 id 取文档并校验可读：所有者或共享给我的均可（用于预览/下载）。
   * 不存在 404；既非所有者也无共享则 403。
   */
  private async findAccessibleDocument(id: number, userId: number): Promise<UploadFile> {
    const uploadFile = await this.uploadFilesRepository.findOneBy({ id });
    if (!uploadFile) {
      throw new NotFoundException('Document not found');
    }
    if (uploadFile.uploaderId !== userId && !(await this.shareService.hasReadAccess(id, userId))) {
      throw new ForbiddenException('You can only access your own or shared documents');
    }
    return uploadFile;
  }

  /** 按 id 取文档并校验归属：不存在 404，属于他人 403 */
  private async findOwnedDocument(id: number, userId: number): Promise<UploadFile> {
    const uploadFile = await this.uploadFilesRepository.findOneBy({ id });
    if (!uploadFile) {
      throw new NotFoundException('Document not found');
    }
    if (uploadFile.uploaderId !== userId) {
      throw new ForbiddenException('You can only access your own documents');
    }
    return uploadFile;
  }

  /** 把库中相对路径解析为绝对路径，并限制其必须位于上传根目录内，防止 ../ 路径穿越 */
  private resolveSafeDocumentPath(relativePath: string): string {
    const filePath = resolve(UPLOAD_ROOT, relativePath);
    const uploadRoot = `${resolve(UPLOAD_ROOT)}${sep}`;
    if (!filePath.startsWith(uploadRoot)) {
      throw new ForbiddenException('Invalid document path');
    }
    return filePath;
  }

  /** 上传、启动恢复与手动重试共用有并发上限的索引队列 */
  private queueIndexing(uploadFile: UploadFile, absolutePath: string): void {
    this.indexQueue.push({ uploadFile, absolutePath });
    this.processIndexQueue();
  }

  private processIndexQueue(): void {
    while (this.activeIndexJobs < INDEX_CONCURRENCY && this.indexQueue.length > 0) {
      const job = this.indexQueue.shift()!;
      this.activeIndexJobs += 1;
      void this.runIndexPipeline(job.uploadFile, job.absolutePath)
        .catch((error) => {
          this.logger.error(`Indexing document ${job.uploadFile.id} failed unexpectedly: ${String(error)}`);
        })
        .finally(() => {
          this.activeIndexJobs -= 1;
          this.processIndexQueue();
        });
    }
  }

  /**
   * 索引流水线入口（亮点 1 自愈）：置 running → 请求 ai-service 建索引 →
   * 成功写回 done（chunkCount/embeddingModel/embeddingDim）；
   * 失败按指数退避自动重试（上限 INDEX_MAX_ATTEMPTS），仍失败标记 failed 并分类错误原因。
   */
  private async runIndexPipeline(uploadFile: UploadFile, absolutePath: string): Promise<void> {
    for (let attempt = 0; attempt < INDEX_MAX_ATTEMPTS; attempt += 1) {
      // 每次尝试前检查文档是否仍存在（期间可能已被删除）
      const exists = await this.uploadFilesRepository.findOneBy({ id: uploadFile.id });
      if (!exists) {
        this.logger.log(`Document ${uploadFile.id} was deleted, skip indexing`);
        return;
      }
      await this.uploadFilesRepository.update(uploadFile.id, {
        indexStatus: 'running',
        indexAttempts: attempt + 1,
        indexError: null,
        errorKind: null,
      });

      const result = await this.requestDocumentIndexing(uploadFile, absolutePath);
      if (result.ok) {
        await this.uploadFilesRepository.update(uploadFile.id, {
          indexStatus: 'done',
          chunkCount: result.chunks,
          indexedAt: new Date(),
          embeddingModel: result.embeddingModel ?? null,
          embeddingDim: result.embeddingDim ?? null,
          indexError: null,
          errorKind: null,
        });
        this.logger.log(`Indexing complete for document ${uploadFile.id} (${result.chunks} chunks)`);
      // 知识库内容变化：清掉该用户语义缓存，避免同类问题命中过期答案
      await this.requestCacheInvalidate(uploadFile.uploaderId);
        return;
      }

      this.logger.warn(`Indexing attempt ${attempt + 1} for document ${uploadFile.id} failed: ${result.error}`);
      // 未达重试上限：指数退避（10s/30s/60s）后重试
      if (attempt < INDEX_MAX_ATTEMPTS - 1) {
        await new Promise((resolveDelay) => {
          setTimeout(resolveDelay, INDEX_RETRY_BASE_SECONDS * 1000 * 2 ** attempt);
        });
        continue;
      }
      // 重试耗尽：标记 failed 并分类错误原因
      await this.uploadFilesRepository.update(uploadFile.id, {
        indexStatus: 'failed',
        indexError: result.error ?? 'unknown error',
        errorKind: classifyIndexError(result.error ?? '', absolutePath),
        indexedAt: new Date(),
      });
    }
  }

  /** 调用 ai-service 建索引一次，返回成功与否及信息 */
  private async requestDocumentIndexing(
    uploadFile: UploadFile,
    absolutePath: string,
  ): Promise<{ ok: boolean; chunks: number; embeddingModel?: string; embeddingDim?: number; error?: string }> {
    const aiServiceUrl = this.configService.get<string>('aiService.url', 'http://localhost:3001');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout
      const response = await fetch(`${aiServiceUrl}/ai/index-document`, {
        method: 'POST',
        headers: aiServiceHeaders(this.configService),
        body: JSON.stringify({
          uploadFileId: uploadFile.id,
          filePath: absolutePath,
          originalName: uploadFile.originalName,
          mimeType: uploadFile.mimeType,
          // 索引时按用户隔离：ai-service 用该用户的向量模型配置并写入 uploaderId
          uploaderId: uploadFile.uploaderId,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Nest 错误响应体含 message 字段（如 .doc 不支持 / 空内容）
        let message = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { message?: string | string[] };
          if (body?.message) {
            message = Array.isArray(body.message) ? body.message.join('；') : body.message;
          }
        } catch {
          // 忽略解析失败
        }
        return { ok: false, chunks: 0, error: message };
      }
      const data = (await response.json()) as {
        uploadFileId: number;
        chunks: number;
        embeddingModel?: string;
        embeddingDim?: number;
      };
      return {
        ok: true,
        chunks: data.chunks,
        embeddingModel: data.embeddingModel,
        embeddingDim: data.embeddingDim,
      };
    } catch (error) {
      return { ok: false, chunks: 0, error: String(error) };
    }
  }

  /**
   * 供设置页“重建索引”任务复用：按库中相对路径解析绝对路径后，
   * 请求 ai-service 以该用户当前向量模型重新建索引（等待本次索引完成）。
   */
  async reindexDocument(uploadFile: UploadFile): Promise<void> {
    const filePath = this.resolveSafeDocumentPath(uploadFile.path);
    await this.runIndexPipeline(uploadFile, filePath);
  }

  /**
   * 手动重试失败文档的索引（亮点 1 自愈）：重置为 pending 后走完整流水线。
   * 仅允许文档所有者重试（共享给我的文档由所有者负责）。
   */
  async retryIndexDocument(id: number, userId: number): Promise<UploadFile> {
    const uploadFile = await this.findOwnedDocument(id, userId);
    if (uploadFile.indexStatus === 'running' || uploadFile.indexStatus === 'pending') {
      throw new BadRequestException('文档正在索引中，请稍后再试');
    }
    // 重置计数并置 pending：索引流水线会再次置 running 并执行
    uploadFile.indexStatus = 'pending';
    uploadFile.indexAttempts = 0;
    uploadFile.indexError = null;
    uploadFile.errorKind = null;
    const reset = await this.uploadFilesRepository.save(uploadFile);
    this.queueIndexing(reset, this.resolveSafeDocumentPath(reset.path));
    return reset;
  }
}

/**
 * 把索引失败原因分类为前端可提示的错误类型：
 * .doc 不支持 → unsupported_format；空内容 → empty_content；
 * 网络/超时/其它未知 → unknown。
 */
function classifyIndexError(error: string, filePath: string): IndexErrorKind {
  if (extname(filePath).toLowerCase() === '.doc') {
    return 'unsupported_format';
  }
  if (error.includes('不包含可索引内容') || error.includes('empty')) {
    return 'empty_content';
  }
  return 'unknown';
}

/** 文档列表返回项：自己上传（shared 字段为 null）或共享给我的（带来源用户名与权限） */
export type DocumentListItem = UploadFile & {
  sharedByUsername: string | null;
  sharedPermission: SharePermission | null;
};
