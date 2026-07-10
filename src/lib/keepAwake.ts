/**
 * Keep-awake wrapper. No-op for now — the standalone expo-keep-awake package
 * ships a broken "exports" map (points at a non-existent src/index.ts) so it
 * won't resolve top-level. Real activation lands in the native batch.
 */
export function useKeepAwake(_active: boolean): void {
  // TODO(native-batch): keep the screen awake while _active during record.
}
