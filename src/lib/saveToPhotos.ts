import * as MediaLibrary from 'expo-media-library';

/**
 * Save a raw take to the system Photos library (add-only).
 *
 * Requests ADD-ONLY (write-only) Photos permission — we never read the user's
 * library, we only contribute the take. Returns a small result union so callers
 * can drive their own toast without catching:
 *   - "saved"  → written to Photos
 *   - "denied" → permission not granted (offer a Settings deep-link)
 *   - "error"  → anything threw (missing file, disk, native failure)
 *
 * Signature is depended on by both Review and Gallery — keep it exact.
 */
export async function saveTakeToPhotos(
  fileUri: string
): Promise<'saved' | 'denied' | 'error'> {
  try {
    // writeOnly = true → add-only access, no read of existing assets.
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return 'denied';

    // Take paths can be bare filesystem paths; saveToLibraryAsync wants a URI.
    const localUri = /^\w+:\/\//.test(fileUri) ? fileUri : `file://${fileUri}`;
    await MediaLibrary.saveToLibraryAsync(localUri);
    return 'saved';
  } catch {
    return 'error';
  }
}
