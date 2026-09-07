import {
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

  async saveAvatar(userId: number, file: Express.Multer.File) {
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const user = await this.usersService.update(userId, { avatarUrl });
    const { password: _password, ...publicUser } = user;
    return { avatarUrl, user: publicUser };
  }

  async saveDocument(userId: number, file: Express.Multer.File): Promise<UploadFile> {
    const originalName = decodeFileName(file.originalname);
    const uploadFile = await this.uploadFilesRepository.save(
      this.uploadFilesRepository.create({
        filename: file.filename,
        originalName,
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

  async listDocuments(userId: number): Promise<UploadFile[]> {
    return this.uploadFilesRepository.find({
      where: { uploaderId: userId },
      order: { createdAt: 'DESC' },
    });
  }

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
  }

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

  private resolveSafeDocumentPath(relativePath: string): string {
    const filePath = resolve(UPLOAD_ROOT, relativePath);
    const uploadRoot = `${resolve(UPLOAD_ROOT)}${sep}`;
    if (!filePath.startsWith(uploadRoot)) {
      throw new ForbiddenException('Invalid document path');
    }
    return filePath;
  }

  private async requestDocumentIndexing(
    uploadFile: UploadFile,
    absolutePath: string,
  ): Promise<void> {
    const aiServiceUrl = this.configService.get<string>(
      'aiService.url',
      'http://localhost:3001',
    );

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
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(
          `AI indexing request for document ${uploadFile.id} failed with ${response.status}`,
        );
      } else {
        this.logger.log(
          `AI indexing complete for document ${uploadFile.id}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `AI indexing request for document ${uploadFile.id} could not be delivered: ${String(error)}`,
      );
    }
  }
}