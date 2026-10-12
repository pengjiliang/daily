import type { ConfigService } from '@nestjs/config';

/** server → ai-service 内部调用的公共请求头（含共享密钥） */
export function aiServiceHeaders(configService: ConfigService): Record<string, string> {
  return {
    'content-type': 'application/json',
    'X-Internal-Token': configService.get<string>('aiService.internalToken', ''),
  };
}
