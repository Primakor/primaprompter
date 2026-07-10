import { Platform } from 'react-native';
// SDK 57 split the API: the top-level `saveToLibraryAsync`/`requestPermissionsAsync`
// now THROW a deprecation error. The `/legacy` subpath keeps the stable functional
// API. (v1.1 debt: migrate to the new class-based Asset API.)
import * as MediaLibrary from 'expo-media-library/legacy';

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
    // iOS requires an add-only permission (NSPhotoLibraryAddUsageDescription →
    // the writeOnly system dialog). Android 11+ contributes to MediaStore with NO
    // runtime permission, and we still never read the library — so the add-only
    // privacy stance holds on both platforms. (writeOnly is an iOS concept; on
    // Android requesting it returns not-granted and would wrongly block the save.)
    if (Platform.OS === 'ios') {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) return 'denied';
    }

    // Take paths can be bare filesystem paths; saveToLibraryAsync wants a URI.
    const localUri = /^\w+:\/\//.test(fileUri) ? fileUri : `file://${fileUri}`;
    await MediaLibrary.saveToLibraryAsync(localUri);
    return 'saved';
  } catch {
    return 'error';
  }
}
