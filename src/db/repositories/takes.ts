import { File } from 'expo-file-system';
import type { DB } from '@op-engineering/op-sqlite';
import { getDb } from '../client';
import { newId } from '../../lib/id';
import type { ID, Take } from '../../types';

/** Add the file:// scheme when a bare recording path was stored on the row. */
function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

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
  input: Omit<
    Take,
    'id' | 'createdAt' | 'isKeeper' | 'trimmedFromTakeId' | 'fileSizeBytes'
  > & {
    isKeeper?: boolean;
    trimmedFromTakeId?: ID | null;
    /** Optional — when falsy (0/undefined) the real size is read from disk. */
    fileSizeBytes?: number;
  }
): Promise<Take> {
  const now = Date.now();
  // Prefer the caller-supplied size; otherwise measure the file on disk.
  // new File(...).size is a synchronous getter that returns 0 if missing.
  const fileSizeBytes =
    input.fileSizeBytes || new File(toFileUri(input.fileUri)).size || 0;
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
    fileSizeBytes,
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
  // Reclaim storage on explicit delete: best-effort remove the video file
  // BEFORE the row goes away, so a deleted take doesn't strand its bytes.
  const take = await getTake(id);
  if (take?.fileUri) {
    try {
      new File(toFileUri(take.fileUri)).delete();
    } catch {
      // File may already be gone or unreadable — dropping the row still wins.
    }
  }
  await getDb().execute('DELETE FROM takes WHERE id = ?', [id]);
}

/**
 * Shape-gated data repair (house rule): backfill the real byte size for any
 * take row still at fileSizeBytes = 0 — e.g. rows written before size capture,
 * or created without a size hint. Missing files stay 0. Runs from initSchema()
 * each open; it is idempotent and only touches rows it can measure.
 */
export function repairTakeFileSizes(db: DB): void {
  const res = db.executeSync(
    'SELECT id, fileUri FROM takes WHERE fileSizeBytes = 0'
  );
  for (const r of res.rows) {
    const fileUri = r.fileUri as string | null;
    if (!fileUri) continue;
    const size = new File(toFileUri(fileUri)).size || 0;
    if (size > 0) {
      db.executeSync('UPDATE takes SET fileSizeBytes = ? WHERE id = ?', [
        size,
        r.id,
      ]);
    }
  }
}

export async function countTakes(): Promise<number> {
  const res = await getDb().execute('SELECT COUNT(*) AS n FROM takes');
  return (res.rows[0]?.n as number) ?? 0;
}
