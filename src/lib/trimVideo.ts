import { File, Paths } from 'expo-file-system';
import { newId } from './id';

/** Add the file:// scheme when a bare recording path is passed in. */
function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** Preserve the source container extension (default mov) for the copied clip. */
function extensionOf(path: string): string {
  const clean = path.split('?')[0];
  const dot = clean.lastIndexOf('.');
  const slash = clean.lastIndexOf('/');
  if (dot === -1 || dot < slash) return 'mov';
  const ext = clean.slice(dot + 1).toLowerCase();
  return ext.length > 0 && ext.length <= 5 ? ext : 'mov';
}

/**
 * Produce a NEW, non-destructive video file for the requested [startSec, endSec]
 * range and return its file:// uri. The original take is never mutated, so the
 * caller can persist a distinct trimmed Take.
 *
 * TODO(trim-native): frame-accurate passthrough trim needs a native module not
 * yet added — react-native-vision-camera and the installed Expo SDK ship no
 * trim/mux primitive, and we deliberately avoid pulling in a heavy native AV
 * dependency in this batch. This currently COPIES the full clip instead of
 * cutting to [startSec, endSec]; the real cut is a follow-up. The value of this
 * flow now is that it yields a genuinely separate take (own DB row + own file),
 * so the true cut can drop in later without changing any caller.
 */
export async function trimVideo(
  srcUri: string,
  startSec: number,
  endSec: number
): Promise<string> {
  const src = new File(toFileUri(srcUri));
  const dest = new File(Paths.document, `trim-${newId()}.${extensionOf(srcUri)}`);
  // copy() is async and returns void; the destination is a fresh unique path.
  await src.copy(dest);
  return dest.uri;
}
