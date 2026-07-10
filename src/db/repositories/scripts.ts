import { getDb } from '../client';
import { newId } from '../../lib/id';
import { countWords } from '../../lib/estimateDuration';
import type { ID, Script } from '../../types';

function mapScript(r: Record<string, any>): Script {
  return {
    id: r.id,
    folderId: r.folderId ?? null,
    title: r.title,
    body: r.body,
    wordCount: r.wordCount,
    wpmOverride: r.wpmOverride ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastUsedAt: r.lastUsedAt ?? null,
  };
}

export async function listScripts(folderId?: ID | null): Promise<Script[]> {
  const db = getDb();
  const res =
    folderId === undefined
      ? await db.execute('SELECT * FROM scripts ORDER BY updatedAt DESC')
      : await db.execute(
          'SELECT * FROM scripts WHERE folderId IS ? ORDER BY updatedAt DESC',
          [folderId]
        );
  return res.rows.map(mapScript);
}

export async function searchScripts(query: string): Promise<Script[]> {
  const like = `%${query.trim()}%`;
  const res = await getDb().execute(
    'SELECT * FROM scripts WHERE title LIKE ? OR body LIKE ? ORDER BY updatedAt DESC',
    [like, like]
  );
  return res.rows.map(mapScript);
}

export async function getScript(id: ID): Promise<Script | null> {
  const res = await getDb().execute('SELECT * FROM scripts WHERE id = ?', [id]);
  return res.rows.length ? mapScript(res.rows[0]) : null;
}

export async function createScript(input: {
  title: string;
  body: string;
  folderId?: ID | null;
}): Promise<Script> {
  const now = Date.now();
  const script: Script = {
    id: newId(),
    folderId: input.folderId ?? null,
    title: input.title.trim() || 'Untitled script',
    body: input.body,
    wordCount: countWords(input.body),
    wpmOverride: null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };
  await getDb().execute(
    `INSERT INTO scripts (id, folderId, title, body, wordCount, wpmOverride, createdAt, updatedAt, lastUsedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      script.id,
      script.folderId,
      script.title,
      script.body,
      script.wordCount,
      script.wpmOverride,
      script.createdAt,
      script.updatedAt,
      script.lastUsedAt,
    ]
  );
  return script;
}

type ScriptPatch = Partial<
  Pick<Script, 'title' | 'body' | 'folderId' | 'wpmOverride' | 'lastUsedAt'>
>;

export async function updateScript(id: ID, patch: ScriptPatch): Promise<Script | null> {
  const existing = await getScript(id);
  if (!existing) return null;
  const body = patch.body ?? existing.body;
  const merged: Script = {
    ...existing,
    ...patch,
    body,
    wordCount: patch.body !== undefined ? countWords(body) : existing.wordCount,
    updatedAt: Date.now(),
  };
  await getDb().execute(
    `UPDATE scripts SET folderId = ?, title = ?, body = ?, wordCount = ?, wpmOverride = ?, updatedAt = ?, lastUsedAt = ? WHERE id = ?`,
    [
      merged.folderId,
      merged.title,
      merged.body,
      merged.wordCount,
      merged.wpmOverride,
      merged.updatedAt,
      merged.lastUsedAt,
      id,
    ]
  );
  return merged;
}

export async function deleteScript(id: ID): Promise<void> {
  await getDb().execute('DELETE FROM scripts WHERE id = ?', [id]);
}

export async function countScripts(): Promise<number> {
  const res = await getDb().execute('SELECT COUNT(*) AS n FROM scripts');
  return (res.rows[0]?.n as number) ?? 0;
}
