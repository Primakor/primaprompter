import { open, type DB } from '@op-engineering/op-sqlite';
import { repairTakeFileSizes } from './repositories/takes';

let _db: DB | null = null;

/** Lazily open the on-device database and ensure the schema exists. */
export function getDb(): DB {
  if (!_db) {
    _db = open({ name: 'primaprompter.db' });
    initSchema(_db);
  }
  return _db;
}

/**
 * Shape-gated schema init (house rule): create-if-absent, never version-gated.
 * Data-correctness migrations, when needed, go in repair*() called from here —
 * NOT behind a PRAGMA user_version bump (which would strand fresh installs).
 */
function initSchema(db: DB) {
  db.executeSync(`CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );`);

  db.executeSync(`CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY NOT NULL,
    folderId TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    wordCount INTEGER NOT NULL DEFAULT 0,
    wpmOverride INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    lastUsedAt INTEGER
  );`);

  db.executeSync(`CREATE TABLE IF NOT EXISTS takes (
    id TEXT PRIMARY KEY NOT NULL,
    scriptId TEXT,
    fileUri TEXT NOT NULL,
    thumbnailUri TEXT,
    durationMs INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    fps INTEGER NOT NULL DEFAULT 30,
    codec TEXT NOT NULL DEFAULT 'h264',
    cameraPosition TEXT NOT NULL DEFAULT 'front',
    fileSizeBytes INTEGER NOT NULL DEFAULT 0,
    isKeeper INTEGER NOT NULL DEFAULT 0,
    trimmedFromTakeId TEXT,
    createdAt INTEGER NOT NULL
  );`);

  db.executeSync(`CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );`);

  db.executeSync(`CREATE INDEX IF NOT EXISTS idx_scripts_folder ON scripts(folderId);`);
  db.executeSync(`CREATE INDEX IF NOT EXISTS idx_takes_script ON takes(scriptId);`);

  // Shape-gated data repairs (house rule): run after the tables exist.
  repairTakeFileSizes(db);
}
