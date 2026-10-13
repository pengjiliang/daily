import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const prefix = 'enc:v1:';

function key(): Buffer {
  const secret = process.env.ENV_ENCRYPTION_KEY;
  if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) throw new Error('ENV_ENCRYPTION_KEY must be 64 hexadecimal characters');
  return Buffer.from(secret, 'hex');
}

function encrypt(value: string | null): string | null {
  if (!value || value.startsWith(prefix)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${prefix}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

function decrypt(value: string | null): string | null {
  if (!value || !value.startsWith(prefix)) return value;
  const [, , iv, tag, ciphertext] = value.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

export const secretTransformer = { to: encrypt, from: decrypt };

export async function encryptLegacyApiKeys(query: (sql: string, parameters?: unknown[]) => Promise<unknown>): Promise<void> {
  const rows = (await query('SELECT id, "openaiApiKey", "anthropicApiKey", "embeddingApiKey" FROM ai_settings')) as Array<{
    id: number;
    openaiApiKey: string | null;
    anthropicApiKey: string | null;
    embeddingApiKey: string | null;
  }>;
  for (const row of rows) {
    const values = [row.openaiApiKey, row.anthropicApiKey, row.embeddingApiKey];
    const encrypted = values.map(encrypt);
    if (encrypted.some((value, index) => value !== values[index])) {
      await query(
        'UPDATE ai_settings SET "openaiApiKey" = $2, "anthropicApiKey" = $3, "embeddingApiKey" = $4 WHERE id = $1',
        [row.id, ...encrypted],
      );
    }
  }
}
