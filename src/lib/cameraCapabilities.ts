import type { CameraDevice, CameraDeviceFormat } from 'react-native-vision-camera';
import type { Fps, Resolution } from '../types';

// Minimum long-side (px) a device format must reach to satisfy a resolution.
const RES_LONG_SIDE: Record<Resolution, number> = { '1080p': 1920, '4k': 3840 };

const longSide = (f: CameraDeviceFormat) => Math.max(f.videoWidth, f.videoHeight);

export interface CameraSupport {
  /** Capability-key -> supported. Consumed by CaptureSettingsSheet's `supported` map. */
  supported: Partial<Record<string, boolean>>;
  /** Whether HDR video is available for the CURRENT resolution + fps selection. */
  hdrAvailable: boolean;
}

/**
 * Derive the real capability matrix from the device's actual formats, replacing the
 * "everything supported" default so the Capture sheet gates on what the camera can
 * truly do — and computing HDR availability for the current resolution+fps combo
 * (HDR at 4K·60 is often unavailable even when HDR at 1080p·30 is).
 */
export function computeSupport(
  device: CameraDevice | undefined,
  resolution: Resolution,
  fps: Fps
): CameraSupport {
  if (!device?.formats?.length) return { supported: {}, hdrAvailable: false };
  const F = device.formats;
  const some = (p: (f: CameraDeviceFormat) => boolean) => F.some(p);
  return {
    supported: {
      '4k': some((f) => longSide(f) >= RES_LONG_SIDE['4k']),
      '60': some((f) => f.maxFps >= 60),
      cinematic: some((f) => f.videoStabilizationModes.includes('cinematic')),
      // 'hevc' is chosen at record time (videoCodec), not per-format, and is broadly
      // supported on both platforms — leave ungated (undefined = allowed).
    },
    hdrAvailable: some(
      (f) =>
        longSide(f) >= RES_LONG_SIDE[resolution] &&
        f.maxFps >= fps &&
        f.supportsVideoHdr
    ),
  };
}
