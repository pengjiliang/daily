import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const AVATARS_DIRECTORY = join(UPLOAD_ROOT, 'avatars');
export const DOCUMENTS_DIRECTORY = join(UPLOAD_ROOT, 'documents');

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
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

function ensureDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true });
}

function generatedFilename(originalname: string): string {
  return `${randomUUID()}${extname(originalname).toLowerCase()}`;
}

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

export const avatarUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, callback) => {
      ensureDirectory(AVATARS_DIRECTORY);
      callback(null, AVATARS_DIRECTORY);
    },
    filename: (_request, file, callback) =>
      callback(null, generatedFilename(file.originalname)),
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

export const documentUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, callback) => {
      ensureDirectory(DOCUMENTS_DIRECTORY);
      callback(null, DOCUMENTS_DIRECTORY);
    },
    filename: (_request, file, callback) =>
      callback(null, generatedFilename(file.originalname)),
  }),
  fileFilter: allowExtension(documentExtensions),
  limits: { fileSize: 20 * 1024 * 1024 },
};
