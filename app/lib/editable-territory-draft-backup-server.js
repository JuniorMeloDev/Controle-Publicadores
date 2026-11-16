import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fieldId } from './field-service.js';

// Preserve the raw draft before validation; invalid labels must not cost edits.
export async function backupEditableTerritoryDraft(body, userId) {
  const id = fieldId(body.territorio);
  if (!body.layout || typeof body.layout !== 'object') return;
  const folder = join(tmpdir(), 'controle-publicadores-drafts');
  await mkdir(folder, { recursive: true });
  const file = join(folder, `territorio-${id}-${Date.now()}-${randomUUID()}.json`);
  await writeFile(file, JSON.stringify({ savedAt: new Date().toISOString(), userId, ...body }, null, 2), { encoding: 'utf8', flag: 'wx' });
  return file;
}
