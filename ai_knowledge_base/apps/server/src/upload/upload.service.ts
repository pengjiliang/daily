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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import type { ReadStream } from 'node:fs';
import { resolve, sep } from 'node:path';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service.js';
import { UploadFile } from './upload-file.entity.js';
import { UPLOAD_ROOT } from './upload.storage.js';
import { Buffer } from 'node:buffer';

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
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectRepository(UploadFile)
    private readonly uploadFilesRepository: Repository<UploadFile>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

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
      }),
    );

    // 异步后台处理，不阻塞响应
    setImmediate(() => {
      this.requestDocumentIndexing(uploadFile, file.path);
    });
    return uploadFile;
  }

  /** 当前用户上传的文档列表（按上传时间倒序） */
  async listDocuments(userId: number): Promise<UploadFile[]> {
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
    const uploadFile = await this.findOwnedDocument(id, userId);
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

  /**
   * 重命名文档：仅更新展示名 originalName。
   * 磁盘文件用独立 uuid 文件名存储，向量索引 metadata 保留索引时的旧名，
   * 因此重命名不影响磁盘与检索，只影响列表/下载展示。
   */
  async renameDocument(id: number, userId: number, originalName: string): Promise<UploadFile> {
    const uploadFile = await this.findOwnedDocument(id, userId);
    const name = originalName.trim();
    if (!name) {
      throw new BadRequestException('文件名不能为空');
    }
    if (name.length > 255) {
      throw new BadRequestException('文件名过长（最多 255 字符）');
    }
    uploadFile.originalName = name;
    return this.uploadFilesRepository.save(uploadFile);
  }

  /** 删除文档：本地文件（ENOENT 容忍）+ 库记录 + ai-service 向量分块清理 */
  async deleteDocument(id: number, userId: number): Promise<void> {
    const uploadFile = await this.findOwnedDocument(id, userId);
    const filePath = this.resolveSafeDocumentPath(uploadFile.path);

    try {
      await unlink(filePath);
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
    await this.uploadFilesRepository.remove(uploadFile);

    // 同步清理 ai-service 中该文件的分块：否则孤儿分块会继续被检索命中（同一文件名出现多条来源）
    await this.requestChunkPurge(uploadFile.id);
  }

  /** 通知 ai-service 删除某上传文件的全部向量分块；失败仅告警，不影响文档删除本身 */
  private async requestChunkPurge(uploadFileId: number): Promise<void> {
    const aiServiceUrl = this.configService.get<string>('aiService.url', 'http://localhost:3001');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(`${aiServiceUrl}/ai/document/${uploadFileId}`, {
        method: 'DELETE',
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

  /** 通知 ai-service 对新文档解析切片并建向量索引；失败仅告警（不回滚上传，120s 超时） */
  private async requestDocumentIndexing(uploadFile: UploadFile, absolutePath: string): Promise<void> {
    const aiServiceUrl = this.configService.get<string>('aiService.url', 'http://localhost:3001');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

      const response = await fetch(`${aiServiceUrl}/ai/index-document`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
        this.logger.warn(`AI indexing request for document ${uploadFile.id} failed with ${response.status}`);
      } else {
        this.logger.log(`AI indexing complete for document ${uploadFile.id}`);
      }
    } catch (error) {
      this.logger.warn(`AI indexing request for document ${uploadFile.id} could not be delivered: ${String(error)}`);
    }
  }

  /**
   * 供设置页“重建索引”任务复用：按库中相对路径解析绝对路径后，
   * 请求 ai-service 以该用户当前向量模型重新建索引（等待本次索引完成）。
   */
  async reindexDocument(uploadFile: UploadFile): Promise<void> {
    const filePath = this.resolveSafeDocumentPath(uploadFile.path);
    await this.requestDocumentIndexing(uploadFile, filePath);
  }
}
