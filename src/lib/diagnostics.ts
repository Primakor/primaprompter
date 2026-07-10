import { getDiagnosticsOptIn } from '../store/prefs';

/**
 * On-device, opt-in diagnostics log.
 *
 * A capped in-memory ring buffer. Nothing is persisted and nothing leaves the
 * device — the only egress path is a future, explicit user-initiated share of
 * the serialized text. When the user has not opted in (getDiagnosticsOptIn()
 * === false), log() is a no-op and no data is retained.
 */

export type DiagnosticsLevel = 'info' | 'warn' | 'error';

export interface DiagnosticsEntry {
  t: number;
  level: string;
  message: string;
}

const MAX_ENTRIES = 500;

class Diagnostics {
  private buffer: DiagnosticsEntry[] = [];

  /**
   * Append a line to the ring buffer. No-op unless the user has opted in.
   * Oldest entries are dropped once the buffer exceeds MAX_ENTRIES.
   */
  log(level: DiagnosticsLevel, message: string): void {
    if (!getDiagnosticsOptIn()) return;
    this.buffer.push({ t: Date.now(), level, message });
    if (this.buffer.length > MAX_ENTRIES) {
      this.buffer.splice(0, this.buffer.length - MAX_ENTRIES);
    }
  }

  /** Snapshot of retained entries, oldest first. */
  getEntries(): DiagnosticsEntry[] {
    return this.buffer.slice();
  }

  /** Human-readable, shareable text dump (one entry per line). */
  serialize(): string {
    return this.buffer
      .map((e) => `${new Date(e.t).toISOString()} [${e.level.toUpperCase()}] ${e.message}`)
      .join('\n');
  }

  /** Drop all retained entries. */
  clear(): void {
    this.buffer.length = 0;
  }
}

export const diagnostics = new Diagnostics();
