/**
 * Storage guard — rough disk-budget math for a recording session.
 *
 * These are deliberately approximate: they model H.264/HEVC bitrates well
 * enough to warn a user before they run out of space, not to predict exact
 * file sizes. All functions except getFreeDiskBytes are pure and TDD-friendly.
 */

import type { Fps, Resolution, VideoCodec } from '../types';

/** Bitrate ceilings in Mbps for H.264; HEVC is derived via HEVC_FACTOR. */
const H264_MBPS: Record<Resolution, Record<Fps, number>> = {
  '1080p': { 24: 7, 30: 8, 60: 14 },
  '4k': { 24: 38, 30: 45, 60: 90 },
};

/** HEVC encodes the same footage at roughly 55% of the H.264 bitrate. */
const HEVC_FACTOR = 0.55;

const BYTES_PER_MB = 1_000_000;
const BYTES_PER_GB = 1_000_000_000;

/** Estimated recording bitrate in megabits per second. */
export function bitrateMbps(
  resolution: Resolution,
  fps: Fps,
  codec: VideoCodec,
): number {
  const base = H264_MBPS[resolution][fps];
  return codec === 'hevc' ? base * HEVC_FACTOR : base;
}

/** Estimated on-disk size of a take of the given duration, in bytes. */
export function estimateTakeBytes(
  durationMs: number,
  resolution: Resolution,
  fps: Fps,
  codec: VideoCodec,
): number {
  if (durationMs <= 0) return 0;
  const seconds = durationMs / 1000;
  const megabits = bitrateMbps(resolution, fps, codec) * seconds;
  // Mbps → bytes: megabits * 1e6 bits / 8 bits-per-byte.
  return Math.round((megabits * 1_000_000) / 8);
}

/** Human-readable size, e.g. "128 MB" or "1.2 GB". */
export function formatBytes(n: number): string {
  const bytes = Math.max(0, n);
  if (bytes >= BYTES_PER_GB) {
    return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
  }
  if (bytes >= BYTES_PER_MB) {
    return `${Math.round(bytes / BYTES_PER_MB)} MB`;
  }
  const kb = Math.round(bytes / 1000);
  return `${kb} KB`;
}

/** Whether an estimated take of this duration fits in the free space given. */
export function willFit(
  durationMs: number,
  freeBytes: number,
  resolution: Resolution,
  fps: Fps,
  codec: VideoCodec,
): boolean {
  return estimateTakeBytes(durationMs, resolution, fps, codec) <= freeBytes;
}

/**
 * Free space on the app-writable volume, in bytes.
 * TODO(native-batch): back this with expo-file-system
 * (FileSystem.getFreeDiskStorageAsync). Placeholder returns ~12 GB.
 */
export async function getFreeDiskBytes(): Promise<number> {
  return 12_000_000_000;
}
