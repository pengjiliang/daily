/**
 * 启动期密钥校验：弱默认值直接拒绝启动，避免带着公开 JWT 密钥上线。
 * 只检查密钥强度，不改动 users 表——现有账号密码哈希不受影响。
 */
const WEAK_SECRETS = new Set(['', 'your_secret_key', 'changeme', 'secret']);

export function assertJwtSecret(secret: string | undefined): string {
  const value = secret?.trim() ?? '';
  if (WEAK_SECRETS.has(value) || value.length < 32) {
    throw new Error(
      'JWT_SECRET 必须设置、不能使用默认值，且长度至少 32 个字符。请在根目录 .env 中配置后重启。现有用户名/密码无需修改，重新登录即可。',
    );
  }
  return value;
}

export function assertInternalToken(token: string | undefined): string {
  const value = token?.trim() ?? '';
  if (WEAK_SECRETS.has(value) || value.length < 32) {
    throw new Error(
      'INTERNAL_AI_TOKEN 必须设置、不能使用默认值，且长度至少 32 个字符。请在根目录 .env 中配置后重启。',
    );
  }
  return value;
}
