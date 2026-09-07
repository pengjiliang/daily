import { BadRequestException } from '@nestjs/common';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Repository } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity.js';
import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  DocumentIndexService,
} from './document-index.service.js';
import type { OpenAIModelProvider } from './openai-model.provider.js';

function createHarness() {
  const saved: DocumentChunk[] = [];
  const deleted: unknown[] = [];
  const repository = {
    create: (chunk: Partial<DocumentChunk>) => chunk as DocumentChunk,
    save: async (chunks: DocumentChunk[]) => {
      saved.push(...chunks);
      return chunks;
    },
    delete: async (criteria: unknown) => {
      deleted.push(criteria);
      return { affected: 0 };
    },
  } as unknown as Repository<DocumentChunk>;

  const embedded: string[][] = [];
  const models = {
    embeddings: {
      embedDocuments: async (texts: string[]) => {
        embedded.push(texts);
        return texts.map((_, index) => [index, 0, 1]);
      },
    },
  } as unknown as OpenAIModelProvider;

  return {
    saved,
    deleted,
    embedded,
    service: new DocumentIndexService(repository, models),
  };
}

describe('DocumentIndexService', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ai-index-'));
  });

  it('chunks text with the configured size and overlap, then stores embeddings', async () => {
    const filePath = join(directory, 'doc.txt');
    const paragraph = `${'sentence about knowledge bases. '.repeat(40)}\n\n`;
    await writeFile(filePath, paragraph.repeat(6), 'utf8');

    const harness = createHarness();
    const result = await harness.service.indexDocument({
      uploadFileId: 7,
      filePath,
      originalName: 'doc.txt',
      mimeType: 'text/plain',
    });

    expect(result.chunks).toBeGreaterThan(1);
    expect(harness.saved).toHaveLength(result.chunks);
    for (const chunk of harness.saved) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_SIZE);
      expect(chunk.uploadFileId).toBe(7);
      expect(chunk.embedding).toHaveLength(3);
    }
    expect(harness.saved.map((chunk) => chunk.metadata.chunkIndex)).toEqual(
      harness.saved.map((_, index) => index),
    );
    expect(harness.deleted).toEqual([{ uploadFileId: 7 }]);
    expect(CHUNK_OVERLAP).toBe(200);
  });

  it('replaces previously indexed chunks before saving new ones', async () => {
    const filePath = join(directory, 'small.md');
    await writeFile(filePath, '# Title\n\nShort body.', 'utf8');

    const harness = createHarness();
    await harness.service.indexDocument({
      uploadFileId: 42,
      filePath,
      originalName: 'small.md',
      mimeType: 'text/markdown',
    });

    expect(harness.deleted).toEqual([{ uploadFileId: 42 }]);
    expect(harness.saved).toHaveLength(1);
    expect(harness.saved[0].content).toContain('Short body.');
  });

  it('rejects documents without indexable text', async () => {
    const filePath = join(directory, 'empty.txt');
    await writeFile(filePath, '   \n  ', 'utf8');

    const harness = createHarness();
    await expect(
      harness.service.indexDocument({
        uploadFileId: 1,
        filePath,
        originalName: 'empty.txt',
        mimeType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.saved).toHaveLength(0);
  });
});
