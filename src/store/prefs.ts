import { getDb } from '../db/client';
import type { CaptureSettings, TeleprompterPrefs } from '../types';

// Prefs live in the same op-sqlite database as the content (one storage engine,
// no separate native key-value dep). Values are small JSON blobs.

export const DEFAULT_TELEPROMPTER_PREFS: TeleprompterPrefs = {
  defaultWpm: 130,
  fontSize: 40,
  lineHeight: 1.6,
  bandOpacity: 0.7,
  fontFamily: 'system',
  highContrast: false,
  readingLinePosition: 0.18,
  mirrorText: false,
  autoScrollMode: 'system',
};

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  resolution: '1080p',
  fps: 30,
  codec: 'h264',
  stabilizationMode: 'standard',
  hdrEnabled: false,
  cameraPosition: 'front',
  gridEnabled: false,
  countdownSeconds: 3,
};

function getKv(key: string): string | null {
  const res = getDb().executeSync('SELECT value FROM prefs WHERE key = ?', [key]);
  return res.rows.length ? (res.rows[0].value as string) : null;
}

function setKv(key: string, value: string): void {
  getDb().executeSync(
    'INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export function getTeleprompterPrefs(): TeleprompterPrefs {
  const raw = getKv('teleprompterPrefs');
  return raw
    ? { ...DEFAULT_TELEPROMPTER_PREFS, ...JSON.parse(raw) }
    : DEFAULT_TELEPROMPTER_PREFS;
}

export function setTeleprompterPrefs(prefs: TeleprompterPrefs): void {
  setKv('teleprompterPrefs', JSON.stringify(prefs));
}

export function getCaptureSettings(): CaptureSettings {
  const raw = getKv('captureSettings');
  return raw
    ? { ...DEFAULT_CAPTURE_SETTINGS, ...JSON.parse(raw) }
    : DEFAULT_CAPTURE_SETTINGS;
}

export function setCaptureSettings(settings: CaptureSettings): void {
  setKv('captureSettings', JSON.stringify(settings));
}

/** Opt-in only. Nothing leaves the device unless the user shares the log. */
export function getDiagnosticsOptIn(): boolean {
  return getKv('diagnosticsOptIn') === 'true';
}

export function setDiagnosticsOptIn(value: boolean): void {
  setKv('diagnosticsOptIn', value ? 'true' : 'false');
}
