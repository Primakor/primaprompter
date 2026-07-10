/**
 * Bring outside text into PrimaPrompter — a picked `.txt` / `.md` file or the
 * system clipboard — normalized into a `{ title, body }` pair ready for
 * `createScript`. Cue tags like "[pause]" stay literal here; the editor and
 * prompter interpret them, this layer never parses them.
 *
 * No file handles are retained: the picked file is read once via `fetch` and
 * then forgotten.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';

/** Hard cap on imported text, in UTF-8 bytes (~64 KB). */
const MAX_BYTES = 65536;

/** UTF-8 byte length without depending on TextEncoder/Blob (unavailable on some engines). */
function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      // High surrogate of a pair → one 4-byte code point; consume the low half.
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** Drop a single leading BOM if present. */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** CRLF and lone CR → LF. */
function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n');
}

function normalizeText(s: string): string {
  return normalizeNewlines(stripBom(s));
}

/** Filename minus its extension; keeps dotfiles ("*.gitignore") intact. */
function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.trim() || 'Imported script';
}

export async function importTextFile(): Promise<
  | { ok: true; title: string; body: string }
  | { ok: false; reason: 'canceled' | 'too-large' | 'error' }
> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'public.plain-text'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return { ok: false, reason: 'canceled' };

    const asset = res.assets?.[0];
    if (!asset) return { ok: false, reason: 'canceled' };

    const raw = await fetch(asset.uri).then((r) => r.text());
    const body = normalizeText(raw);
    if (utf8ByteLength(body) > MAX_BYTES) return { ok: false, reason: 'too-large' };

    return { ok: true, title: titleFromFilename(asset.name), body };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function pasteText(): Promise<
  | { ok: true; title: string; body: string }
  | { ok: false; reason: 'empty' | 'too-large' | 'error' }
> {
  try {
    const raw = await Clipboard.getStringAsync();
    const body = normalizeText(raw ?? '');
    if (body.trim().length === 0) return { ok: false, reason: 'empty' };
    if (utf8ByteLength(body) > MAX_BYTES) return { ok: false, reason: 'too-large' };

    const firstLine = body.split('\n').find((l) => l.trim().length > 0) ?? '';
    const title = firstLine.trim().slice(0, 60).trim() || 'Pasted script';

    return { ok: true, title, body };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
