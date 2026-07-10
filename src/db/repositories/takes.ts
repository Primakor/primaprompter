import { getDb } from '../client';
import { newId } from '../../lib/id';
import type { ID, Take } from '../../types';

function mapTake(r: Record<string, any>): Take {
  return {
    id: r.id,
    scriptId: r.scriptId ?? null,
    fileUri: r.fileUri,
    thumbnailUri: r.thumbnailUri ?? null,
    durationMs: r.durationMs,
    width: r.width,
    height: r.height,
    fps: r.fps,
    codec: r.codec,
    cameraPosition: r.cameraPosition,
    fileSizeBytes: r.fileSizeBytes,
    isKeeper: !!r.isKeeper,
    trimmedFromTakeId: r.trimmedFromTakeId ?? null,
    createdAt: r.createdAt,
  };
}

export async function listTakes(scriptId?: ID | null): Promise<Take[]> {
  const db = getDb();
  const res =
    scriptId === undefined
      ? await db.execute('SELECT * FROM takes ORDER BY createdAt DESC')
      : await db.execute(
          'SELECT * FROM takes WHERE scriptId IS ? ORDER BY createdAt DESC',
          [scriptId]
        );
  return res.rows.map(mapTake);
}

export interface TakeGroup {
  scriptId: ID | null;
  scriptTitle: string;
  takes: Take[];
}

export async function listTakesGroupedByScript(): Promise<TakeGroup[]> {
  const res = await getDb().execute(
    `SELECT t.*, s.title AS scriptTitle
       FROM takes t
       LEFT JOIN scripts s ON s.id = t.scriptId
      ORDER BY t.createdAt DESC`
  );
  const order: (ID | null)[] = [];
  const groups = new Map<ID | null, TakeGroup>();
  for (const r of res.rows) {
    const scriptId = (r.scriptId ?? null) as ID | null;
    let group = groups.get(scriptId);
    if (!group) {
      group = {
        scriptId,
        scriptTitle: (r.scriptTitle as string | null) ?? 'Unlinked takes',
        takes: [],
      };
      groups.set(scriptId, group);
      order.push(scriptId);
    }
    group.takes.push(mapTake(r));
  }
  return order.map((id) => groups.get(id)!);
}

export async function getTake(id: ID): Promise<Take | null> {
  const res = await getDb().execute('SELECT * FROM takes WHERE id = ?', [id]);
  return res.rows.length ? mapTake(res.rows[0]) : null;
}

export async function createTake(
  input: Omit<Take, 'id' | 'createdAt' | 'isKeeper' | 'trimmedFromTakeId'> & {
    isKeeper?: boolean;
    trimmedFromTakeId?: ID | null;
  }
): Promise<Take> {
  const now = Date.now();
  const take: Take = {
    id: newId(),
    scriptId: input.scriptId ?? null,
    fileUri: input.fileUri,
    thumbnailUri: input.thumbnailUri ?? null,
    durationMs: input.durationMs,
    width: input.width,
    height: input.height,
    fps: input.fps,
    codec: input.codec,
    cameraPosition: input.cameraPosition,
    fileSizeBytes: input.fileSizeBytes,
    isKeeper: input.isKeeper ?? false,
    trimmedFromTakeId: input.trimmedFromTakeId ?? null,
    createdAt: now,
  };
  await getDb().execute(
    `INSERT INTO takes (id, scriptId, fileUri, thumbnailUri, durationMs, width, height, fps, codec, cameraPosition, fileSizeBytes, isKeeper, trimmedFromTakeId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      take.id,
      take.scriptId,
      take.fileUri,
      take.thumbnailUri,
      take.durationMs,
      take.width,
      take.height,
      take.fps,
      take.codec,
      take.cameraPosition,
      take.fileSizeBytes,
      take.isKeeper ? 1 : 0,
      take.trimmedFromTakeId,
      take.createdAt,
    ]
  );
  return take;
}

export async function setKeeper(id: ID, isKeeper: boolean): Promise<void> {
  await getDb().execute('UPDATE takes SET isKeeper = ? WHERE id = ?', [
    isKeeper ? 1 : 0,
    id,
  ]);
}

export async function deleteTake(id: ID): Promise<void> {
  await getDb().execute('DELETE FROM takes WHERE id = ?', [id]);
}

export async function countTakes(): Promise<number> {
  const res = await getDb().execute('SELECT COUNT(*) AS n FROM takes');
  return (res.rows[0]?.n as number) ?? 0;
}
