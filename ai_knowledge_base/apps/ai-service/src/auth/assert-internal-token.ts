const WEAK_TOKENS = new Set(['', 'your_secret_key', 'changeme', 'secret']);

export function assertInternalToken(token: string | undefined): string {
  const value = token?.trim() ?? '';
  if (WEAK_TOKENS.has(value) || value.length < 32) {
    throw new Error(
      'INTERNAL_AI_TOKEN 必须设置、不能使用默认值，且长度至少 32 个字符。请在根目录 .env 中配置后重启。',
    );
  }
  return value;
}
