/**
 * multer 磁盘上传配置：统一上传根目录 uploads/（avatars、documents 两个子目录），
 * 落盘文件名用 UUID + 原扩展名（避免重名与路径问题），并分别限制扩展名与大小：
 * 头像仅图片且 ≤5MB；知识文档为白名单格式且 ≤20MB。
 */
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';

/**
 * 上传文件根目录：优先使用 UPLOAD_ROOT 环境变量（Docker 部署时由 compose 统一
 * 指定为共享卷 /app/uploads，与 ai-service 保持一致）；未设置时保持开发模式
 * 默认值（运行目录下 uploads/）。
 */
export const UPLOAD_ROOT = process.env.UPLOAD_ROOT?.trim() || join(process.cwd(), 'uploads');
export const AVATARS_DIRECTORY = join(UPLOAD_ROOT, 'avatars');
export const DOCUMENTS_DIRECTORY = join(UPLOAD_ROOT, 'documents');

/** 允许的头像图片扩展名 */
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
/** 允许入库的知识文档扩展名（含图片 OCR 与常见办公/文本格式） */
const documentExtensions = new Set([
  '.pdf',
  '.txt',
  '.xls',
  '.xlsx',
  '.csv',
  '.md',
  '.docx',
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

/**
 * 读取文件开头的少量字节，用于按内容探测真实格式（magic bytes）。
 * multer 落盘完成后回调里读取已写入的磁盘文件，避免依赖可伪造的 mimetype。
 */
export function readFileHead(path: string, length = 16): Buffer | null {
  try {
    const fd = openSync(path, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const bytes = readSync(fd, buffer, 0, length, 0);
      return buffer.subarray(0, bytes);
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

/**
 * 按文件头判断真实格式：PDF %PDF-、PNG \x89PNG、JPEG FFD8FF、
 * GIF GIF8、BMP BM、WebP RIFF....WEBP、TIFF II* / MM*、ZIP 头（docx/xlsx）。
 * 纯文本（txt/md/csv）无固定头，走扩展名 + 不可执行字节过滤。
 */
export function sniffType(head: Buffer | null, ext: string): boolean {
  if (!head || head.length < 4) return false;
  switch (ext) {
    case '.pdf':
      return head.toString('latin1').startsWith('%PDF');
    case '.png':
      return head.readUInt32BE(0) === 0x89504e47;
    case '.jpg':
    case '.jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case '.gif':
      return head.toString('latin1').startsWith('GIF8');
    case '.bmp':
      return head.toString('latin1', 0, 2) === 'BM';
    case '.webp':
      return head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP';
    case '.tif':
    case '.tiff':
      return head.toString('latin1', 0, 2) === 'II' || head.toString('latin1', 0, 2) === 'MM';
    case '.docx':
    case '.xlsx':
      return head.toString('latin1', 0, 2) === 'PK';
    case '.txt':
    case '.md':
    case '.csv':
      // 文本文件不允许二进制/可执行内容（NUL、脚本解释器标记等）
      return !head.includes(0);
    case '.xls':
      // 老版 .xls 是 OLE 复合文档（D0 CF 11 E0），或纯文本 CSV 误命名
      return head.readUInt32LE(0) === 0xe011cfd0;
    default:
      return false;
  }
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
