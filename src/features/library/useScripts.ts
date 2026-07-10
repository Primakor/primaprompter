import { useCallback, useEffect, useState } from 'react';
import type { Script } from '../../types';
import { listScripts, searchScripts } from '../../db/repositories/scripts';
import { seedIfEmpty } from '../../db/seed';

/**
 * Loads scripts for the Library. `null` while loading; array once ready.
 * Seeds the dev demo data on first mount.
 */
export function useScripts(query: string) {
  const [scripts, setScripts] = useState<Script[] | null>(null);

  const load = useCallback(async () => {
    const data = query.trim() ? await searchScripts(query) : await listScripts();
    setScripts(data);
  }, [query]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await seedIfEmpty();
        const data = query.trim() ? await searchScripts(query) : await listScripts();
        if (alive) setScripts(data);
      } catch (e) {
        if (alive) setScripts([]);
        console.warn('[useScripts] load failed', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [query]);

  return { scripts, refresh: load };
}
