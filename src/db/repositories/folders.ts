import { getDb } from '../client';
import { newId } from '../../lib/id';
import type { ID, Folder } from '../../types';

function mapFolder(r: Record<string, any>): Folder {
  return {
    id: r.id,
    name: r.name,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listFolders(): Promise<Folder[]> {
  const res = await getDb().execute('SELECT * FROM folders ORDER BY sortOrder, name');
  return res.rows.map(mapFolder);
}

export async function createFolder(name: string): Promise<Folder> {
  const now = Date.now();
  const folder: Folder = {
    id: newId(),
    name: name.trim() || 'New folder',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().execute(
    `INSERT INTO folders (id, name, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [folder.id, folder.name, folder.sortOrder, folder.createdAt, folder.updatedAt]
  );
  return folder;
}

export async function renameFolder(id: ID, name: string): Promise<Folder | null> {
  const res = await getDb().execute('SELECT * FROM folders WHERE id = ?', [id]);
  if (!res.rows.length) return null;
  const existing = mapFolder(res.rows[0]);
  const merged: Folder = {
    ...existing,
    name: name.trim() || existing.name,
    updatedAt: Date.now(),
  };
  await getDb().execute('UPDATE folders SET name = ?, updatedAt = ? WHERE id = ?', [
    merged.name,
    merged.updatedAt,
    id,
  ]);
  return merged;
}

export async function deleteFolder(id: ID): Promise<void> {
  await getDb().execute('DELETE FROM folders WHERE id = ?', [id]);
}

export async function countFolders(): Promise<number> {
  const res = await getDb().execute('SELECT COUNT(*) AS n FROM folders');
  return (res.rows[0]?.n as number) ?? 0;
}
