import { ForbiddenException } from '@nestjs/common';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** 校验 filePath 解析后必须落在 uploads 根目录内，防止任意本地文件被索引 */
export function assertPathInsideUploadRoot(filePath: string, uploadRoot: string): string {
  const root = resolve(uploadRoot);
  const candidate = existsSync(filePath) ? realpathSync(filePath) : resolve(filePath);
  const rel = relative(root, candidate);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new ForbiddenException('filePath must be inside the uploads directory');
  }
  return candidate;
}
