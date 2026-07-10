/**
 * PrimaPrompter shared domain types. This module is the interface base that
 * the db repositories, prefs store, and every feature screen consume — keep it
 * stable (Phase 2 freezes it).
 */

export type ID = string;

export interface Folder {
  id: ID;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface Script {
  id: ID;
  folderId: ID | null;
  /** Plain text with inline cue markup, e.g. "[pause]", "[look left]". */
  body: string;
  title: string;
  /** Excludes cue tags — see lib/estimateDuration. */
  wordCount: number;
  /** null → fall back to TeleprompterPrefs.defaultWpm. */
  wpmOverride: number | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

export type CameraPosition = 'front' | 'back';
export type VideoCodec = 'h264' | 'hevc';

export interface Take {
  id: ID;
  scriptId: ID | null;
  /** App-sandbox filesystem path (video files never live in the DB). */
  fileUri: string;
  thumbnailUri: string | null;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  codec: VideoCodec;
  cameraPosition: CameraPosition;
  fileSizeBytes: number;
  isKeeper: boolean;
  /** Set when this take was produced by a non-destructive Trim-Lite. */
  trimmedFromTakeId: ID | null;
  createdAt: number;
}

export type StabilizationMode =
  | 'off'
  | 'standard'
  | 'cinematic'
  | 'cinematic-extended'
  | 'auto';

export type Resolution = '1080p' | '4k';
export type Fps = 24 | 30 | 60;
export type CountdownSeconds = 0 | 3 | 10;

export interface CaptureSettings {
  resolution: Resolution;
  fps: Fps;
  codec: VideoCodec;
  stabilizationMode: StabilizationMode;
  hdrEnabled: boolean;
  cameraPosition: CameraPosition;
  gridEnabled: boolean;
  countdownSeconds: CountdownSeconds;
}

export type PrompterFont = 'system' | 'lexend' | 'dyslexic';

export interface TeleprompterPrefs {
  defaultWpm: number;
  fontSize: number;
  lineHeight: number;
  /** 0..1 opacity of the scrim band behind the reading text. */
  bandOpacity: number;
  fontFamily: PrompterFont;
  highContrast: boolean;
  /** 0..1 fraction from the top of the frame where the reading line sits. */
  readingLinePosition: number;
  /** Height (px) of the teleprompter band; user-resizable, clamped to available area. */
  bandHeight: number;
  mirrorText: boolean;
  /**
   * Auto-scroll start behavior when recording begins. 'system' respects the OS
   * Reduce Motion setting (the prompter starts paused when Reduce Motion is on);
   * 'always' auto-starts scrolling regardless — the user's informed override.
   */
  autoScrollMode: 'system' | 'always';
}
