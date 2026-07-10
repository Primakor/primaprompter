import { useEffect } from 'react';
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';

/** Stable tag scoping this app's keep-awake lock (e.g. while recording). */
export const KEEP_AWAKE_TAG = 'primaprompter-record';

/**
 * Keeps the screen awake while `active === true` and releases the lock
 * otherwise. The lock is always released on unmount.
 *
 * @param active Whether the screen should be kept awake.
 */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return undefined;
    }

    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {
      // Keeping the screen awake is best-effort (e.g. unsupported on web);
      // failing to acquire the lock must never crash the caller.
    });

    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {
        // Best-effort release; ignore if the lock was never acquired.
      });
    };
  }, [active]);
}
