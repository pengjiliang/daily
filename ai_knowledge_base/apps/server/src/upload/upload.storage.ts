/**
 * multer 磁盘上传配置：统一上传根目录 uploads/（avatars、documents 两个子目录），
 * 落盘文件名用 UUID + 原扩展名（避免重名与路径问题），并分别限制扩展名与大小：
 * 头像仅图片且 ≤5MB；知识文档为白名单格式且 ≤20MB。
 */
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';

/** 上传文件根目录（运行目录下 uploads/） */
export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const AVATARS_DIRECTORY = join(UPLOAD_ROOT, 'avatars');
export const DOCUMENTS_DIRECTORY = join(UPLOAD_ROOT, 'documents');

/** 允许的头像图片扩展名 */
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
/** 允许入库的知识文档扩展名（含图片 OCR 与常见办公/文本格式） */
const documentExtensions = new Set([
  '.pdf',
  '.txt',
  '.xls',
  '.xlx',
  '.xlsx',
  '.csv',
  '.md',
  '.docx',
  '.doc',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
]);

/** 确保目标目录存在（不存在则递归创建） */
function ensureDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true });
}

/** 生成磁盘文件名：UUID + 小写扩展名 */
function generatedFilename(originalname: string): string {
  return `${randomUUID()}${extname(originalname).toLowerCase()}`;
}

/** multer fileFilter 工厂：扩展名不在白名单内则拒绝上传 */
function allowExtension(extensions: Set<string>) {
  return (
    _request: unknown,
    file: { originalname: string },
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!extensions.has(extname(file.originalname).toLowerCase())) {
      callback(new BadRequestException('Unsupported file type'), false);
      return;
    }
    callback(null, true);
  };
}

/** 头像上传配置：仅图片 MIME + 图片扩展名双校验，上限 5MB */
export const avatarUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, callback) => {
      ensureDirectory(AVATARS_DIRECTORY);
      callback(null, AVATARS_DIRECTORY);
    },
    filename: (_request, file, callback) => callback(null, generatedFilename(file.originalname)),
  }),
  fileFilter: (request, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new BadRequestException('Avatar must be an image'), false);
      return;
    }
    allowExtension(imageExtensions)(request, file, callback);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};

/** 文档上传配置：扩展名白名单校验，上限 20MB */
export const documentUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, callback) => {
      ensureDirectory(DOCUMENTS_DIRECTORY);
      callback(null, DOCUMENTS_DIRECTORY);
    },
    filename: (_request, file, callback) => callback(null, generatedFilename(file.originalname)),
  }),
  fileFilter: allowExtension(documentExtensions),
  limits: { fileSize: 20 * 1024 * 1024 },
};
