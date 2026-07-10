/**
 * Word-count and read-time estimation for scripts.
 * Cue tags ("[pause]", "[look left]") are v1-passive: they are excluded from the
 * word count and the duration math, and trigger no behavior.
 */

const CUE_TAG_RE = /\[[^\]]*\]/g;

export function countWords(body: string): number {
  const stripped = body.replace(CUE_TAG_RE, ' ');
  const words = stripped.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function estimateDurationMs(wordCount: number, wpm: number): number {
  if (wpm <= 0 || wordCount <= 0) return 0;
  return Math.round((wordCount / wpm) * 60_000);
}

/** "1:24" style. */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
