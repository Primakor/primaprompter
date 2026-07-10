import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  type VideoFile,
} from 'react-native-vision-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, fonts } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { CameraPosition, Script, TeleprompterPrefs } from '../../types';
import { getScript, updateScript } from '../../db/repositories/scripts';
import { createTake } from '../../db/repositories/takes';
import {
  getTeleprompterPrefs,
  setTeleprompterPrefs,
  getCaptureSettings,
  setCaptureSettings,
} from '../../store/prefs';
import { useKeepAwake } from '../../lib/keepAwake';
import { Teleprompter } from './Teleprompter';
import { CaptureSettingsSheet } from './CaptureSettingsSheet';
import { PrompterAppearanceSheet } from './PrompterAppearanceSheet';
import { PermissionPrime } from './PermissionPrime';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Record'>;
type Rt = RouteProp<RootStackParamList, 'Record'>;
type Mode = 'idle' | 'countdown' | 'recording' | 'finalizing';

// Eyeline calibration clamps: keep the reading line in a comfortable band near
// the lens — never up into the top chrome, never past the frame's middle.
const EYELINE_MIN = 0.08;
const EYELINE_MAX = 0.35;
// The band-top caret sits this many px below the band container's top edge
// (see Teleprompter styles.caret). Offsetting the container up by it makes the
// caret land exactly on the readingLinePosition fraction of the screen height.
const CARET_OFFSET = 14;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function tc(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function RecordScreen() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const scriptId = route.params?.scriptId;

  const camera = useCameraPermission();
  const mic = useMicrophonePermission();
  const [prefs, setPrefs] = useState<TeleprompterPrefs>(() => getTeleprompterPrefs());
  const [capture, setCapture] = useState(() => getCaptureSettings());
  const device = useCameraDevice(capture.cameraPosition);

  const [script, setScript] = useState<Script | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [countdown, setCountdown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [sheet, setSheet] = useState<null | 'capture' | 'prompter'>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const cameraRef = useRef<Camera>(null);
  const startTs = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useKeepAwake(mode === 'recording' || mode === 'countdown');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (scriptId) {
        const s = await getScript(scriptId);
        if (alive) setScript(s);
      } else if (alive) {
        setScript(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [scriptId]);

  // Clear any live intervals if the screen unmounts mid-countdown/recording.
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // Track the OS Reduce Motion setting so recording can begin paused when it's on.
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => sub.remove();
  }, []);

  const hasCamera = !!device && camera.hasPermission;
  const canCapture = hasCamera && cameraReady;

  // Per-script speed: the open script's override wins, else the global default.
  const effectiveWpm = script?.wpmOverride ?? prefs.defaultWpm;

  const beginRecording = useCallback(() => {
    setMode('recording');
    // Respect Reduce Motion: under 'system' the prompter begins paused so the
    // take doesn't open with motion the user didn't ask for. 'always' overrides.
    const autoStart = prefs.autoScrollMode === 'always' || !reduceMotion;
    setPlaying(autoStart);
    AccessibilityInfo.announceForAccessibility('Recording started');
    startTs.current = Date.now();
    setElapsed(0);
    timer.current = setInterval(() => setElapsed(Date.now() - startTs.current), 200);

    if (canCapture && cameraRef.current) {
      cameraRef.current.startRecording({
        onRecordingFinished: async (video: VideoFile) => {
          const dur = Date.now() - startTs.current;
          const take = await createTake({
            scriptId: scriptId ?? null,
            fileUri: video.path,
            thumbnailUri: null,
            durationMs: Math.round((video.duration ?? dur / 1000) * 1000),
            width: video.width ?? 1080,
            height: video.height ?? 1920,
            fps: capture.fps,
            codec: capture.codec,
            cameraPosition: capture.cameraPosition,
            fileSizeBytes: 0,
          });
          nav.replace('Review', { takeId: take.id });
        },
        onRecordingError: (e) => {
          console.warn('[record] error', e);
          setMode('idle');
          setPlaying(false);
        },
      });
    }
  }, [canCapture, capture, scriptId, nav, prefs.autoScrollMode, reduceMotion]);

  const startCapture = useCallback(() => {
    setResetKey((k) => k + 1);
    // countdownSeconds lives on capture settings (the prompter pref is retired).
    const n = capture.countdownSeconds;
    if (n > 0) {
      setMode('countdown');
      setCountdown(n);
      AccessibilityInfo.announceForAccessibility(String(n));
      let c = n;
      countdownTimer.current = setInterval(() => {
        c -= 1;
        if (c <= 0) {
          if (countdownTimer.current) clearInterval(countdownTimer.current);
          countdownTimer.current = null;
          setCountdown(0);
          beginRecording();
        } else {
          setCountdown(c);
          AccessibilityInfo.announceForAccessibility(String(c));
        }
      }, 1000);
    } else {
      beginRecording();
    }
  }, [capture.countdownSeconds, beginRecording]);

  const cancelCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setMode('idle');
    setPlaying(false);
    setCountdown(0);
  }, []);

  const stopCapture = useCallback(async () => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    if (timer.current) clearInterval(timer.current);
    setPlaying(false);
    AccessibilityInfo.announceForAccessibility('Recording stopped');
    if (canCapture && cameraRef.current) {
      setMode('finalizing');
      try {
        await cameraRef.current.stopRecording(); // triggers onRecordingFinished
      } catch (e) {
        console.warn('[record] stop failed', e);
        setMode('idle');
      }
    } else {
      // Rehearsal (no camera, e.g. simulator): no take produced.
      setMode('idle');
    }
  }, [canCapture]);

  const bumpWpm = (d: number) => {
    const next = clamp(effectiveWpm + d, 60, 260);
    if (script) {
      // Optimistic: reflect immediately, persist the override in the background.
      setScript((s) => (s ? { ...s, wpmOverride: next } : s));
      updateScript(script.id, { wpmOverride: next }).catch((e) =>
        console.warn('[record] wpm persist failed', e)
      );
    } else {
      setPrefs((p) => {
        const np = { ...p, defaultWpm: next };
        setTeleprompterPrefs(np);
        return np;
      });
    }
  };

  const applyPrefs = (p: TeleprompterPrefs) => {
    setPrefs(p);
    setTeleprompterPrefs(p);
  };
  const applyCapture = (c: typeof capture) => {
    setCapture(c);
    setCaptureSettings(c);
  };

  // Eyeline calibration: drag the reading line; the band + WPM rail follow it.
  // Live in-memory during drag, persisted on release (setPrefs + store write).
  const moveReadingLine = useCallback(
    (absoluteY: number, persist: boolean) => {
      setPrefs((p) => {
        const next = {
          ...p,
          readingLinePosition: clamp(absoluteY / winH, EYELINE_MIN, EYELINE_MAX),
        };
        if (persist) setTeleprompterPrefs(next);
        return next;
      });
    },
    [winH]
  );

  const readingLinePan = Gesture.Pan()
    .onUpdate((e) => {
      runOnJS(moveReadingLine)(e.absoluteY, false);
    })
    .onEnd((e) => {
      runOnJS(moveReadingLine)(e.absoluteY, true);
    });

  const recording = mode === 'recording';
  const bandHeight = 148;
  const body = script?.body ?? 'Open a script from the Library to read it here.';

  const readingFrac = clamp(prefs.readingLinePosition, EYELINE_MIN, EYELINE_MAX);
  const bandTop = readingFrac * winH - CARET_OFFSET;
  const caretY = bandTop + CARET_OFFSET; // == readingFrac * winH
  const railTop = bandTop + bandHeight + 16;

  // Permission gate (real devices). Sim has no device, so we skip straight to rehearsal.
  if (device && !camera.hasPermission) {
    return (
      <View style={styles.root}>
        <PermissionPrime
          onContinue={async () => {
            await camera.requestPermission();
            await mic.requestPermission();
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Preview: real camera on device, graceful backdrop in the simulator */}
      {hasCamera ? (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device!}
          isActive={mode !== 'finalizing'}
          video={true}
          audio={mic.hasPermission}
          onInitialized={() => setCameraReady(true)}
          onError={(e) => {
            console.warn('[camera]', e.message);
            setCameraReady(false);
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noCam]}>
          <Text style={styles.noCamText}>
            {device ? 'Camera off' : 'No camera on this device — rehearsal mode'}
          </Text>
        </View>
      )}

      {/* top chrome */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        {recording || mode === 'countdown' ? (
          <View style={styles.recPill}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC {tc(elapsed)}</Text>
          </View>
        ) : (
          <>
            <Pressable style={styles.cbtn} onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.cbtnGlyph}>✕</Text>
            </Pressable>
            <View style={styles.badges}>
              <Text style={styles.tcode}>{tc(0)}</Text>
              <Pressable style={styles.badge} onPress={() => setSheet('capture')} accessibilityRole="button" accessibilityLabel="Capture settings">
                <Text style={styles.badgeText}>
                  <Text style={styles.badgeAccent}>{capture.resolution === '4k' ? '4K' : '1080'}</Text>·{capture.fps}
                </Text>
              </Pressable>
            </View>
            <Pressable style={styles.cbtn} onPress={() => setSheet('capture')} accessibilityRole="button" accessibilityLabel="Settings">
              <Text style={styles.cbtnGlyph}>⚙</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* silent-mic warning — camera on, but no audio will be captured */}
      {hasCamera && !mic.hasPermission && (
        <View style={[styles.micChipWrap, { top: insets.top + 52 }]} pointerEvents="box-none">
          <Pressable
            style={styles.micChip}
            onPress={() => mic.requestPermission()}
            accessibilityRole="button"
            accessibilityLabel="Microphone is off — no sound will be recorded. Tap to enable."
          >
            <Text style={styles.micChipText}>⚠ No sound — mic off</Text>
          </Pressable>
        </View>
      )}

      {/* teleprompter band, pinned to the calibrated eyeline */}
      <View style={[styles.bandWrap, { top: bandTop }]}>
        <Teleprompter
          body={body}
          wpm={effectiveWpm}
          playing={playing}
          prefs={prefs}
          height={bandHeight}
          resetKey={resetKey}
          onTogglePlay={() => {
            const next = !playing;
            setPlaying(next);
            AccessibilityInfo.announceForAccessibility(
              next ? 'Teleprompter playing' : 'Teleprompter paused'
            );
          }}
        />
      </View>

      {/* eyeline drag handle — idle only, its own gesture (never touches the band's) */}
      {mode === 'idle' && (
        <GestureDetector gesture={readingLinePan}>
          <View
            style={[styles.eyelineHandle, { top: caretY - 12 }]}
            hitSlop={12}
            accessibilityRole="adjustable"
            accessibilityLabel="Reading line position"
            accessibilityValue={{
              now: Math.round(readingFrac * 100),
              min: Math.round(EYELINE_MIN * 100),
              max: Math.round(EYELINE_MAX * 100),
            }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => {
              const d = e.nativeEvent.actionName === 'increment' ? 0.02 : -0.02;
              moveReadingLine(clamp(readingFrac + d, EYELINE_MIN, EYELINE_MAX) * winH, true);
            }}
          >
            <View style={styles.eyelineGrip} />
          </View>
        </GestureDetector>
      )}

      {/* WPM rail (prompter control — always visible; dimmed while recording) */}
      <View style={[styles.wpm, { top: railTop }, recording && styles.wpmRecording]}>
        <Pressable onPress={() => bumpWpm(5)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Faster">
          <Text style={styles.wpmBtn}>＋</Text>
        </Pressable>
        <Text style={styles.wpmVal}>{effectiveWpm}</Text>
        <Text style={styles.wpmUnit}>WPM</Text>
        <Pressable onPress={() => bumpWpm(-5)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Slower">
          <Text style={styles.wpmBtn}>−</Text>
        </Pressable>
      </View>

      {/* countdown — tap anywhere to cancel and disarm */}
      {countdown > 0 && (
        <Pressable
          style={styles.countdown}
          onPress={cancelCountdown}
          accessibilityRole="button"
          accessibilityLabel="Cancel countdown"
        >
          <Text style={styles.countdownNum}>{countdown}</Text>
          <Text style={styles.countdownCancel}>Tap to cancel</Text>
        </Pressable>
      )}

      {recording && (
        <Text style={styles.hint} pointerEvents="none">
          {playing
            ? 'Tap the script to pause · Stop to finish'
            : 'Auto-scroll off — tap the script to start'}
        </Text>
      )}

      {/* bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 22 }]}>
        {recording ? (
          <Pressable style={styles.shutterStop} onPress={stopCapture} accessibilityRole="button" accessibilityLabel="Stop recording">
            <View style={styles.stopSquare} />
          </Pressable>
        ) : mode === 'finalizing' ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : mode === 'countdown' ? null : (
          <>
            <Pressable style={styles.round} onPress={() => setSheet('prompter')} accessibilityRole="button" accessibilityLabel="Prompter appearance">
              <Text style={styles.roundGlyph}>Aa</Text>
            </Pressable>
            <Pressable style={styles.shutter} onPress={startCapture} accessibilityRole="button" accessibilityLabel="Start recording">
              <View style={styles.shutterInner} />
            </Pressable>
            <Pressable
              style={styles.round}
              onPress={() => applyCapture({ ...capture, cameraPosition: (capture.cameraPosition === 'front' ? 'back' : 'front') as CameraPosition })}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <Text style={styles.roundGlyph}>⟲</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Sheets are modal: a full-screen backdrop captures touches so the Record
          controls behind can't be tapped (this let recording arm underneath an open
          sheet), and tapping outside closes. Backdrop is transparent — no visual
          change; a dimmed variant is a product-brain call. */}
      {sheet && (
        <View style={styles.sheetModal}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSheet(null)}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
          />
          {sheet === 'capture' && (
            <CaptureSettingsSheet settings={capture} onChange={applyCapture} onClose={() => setSheet(null)} />
          )}
          {sheet === 'prompter' && (
            <PrompterAppearanceSheet prefs={prefs} onChange={applyPrefs} onClose={() => setSheet(null)} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stage },
  sheetModal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 },
  noCam: { backgroundColor: '#101216', alignItems: 'center', justifyContent: 'center' },
  noCamText: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.mono, fontSize: 12 },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 8,
  },
  cbtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbtnGlyph: { color: '#fff', fontSize: 16 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tcode: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: 'hidden',
  },
  badge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  badgeText: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '600', color: '#fff' },
  badgeAccent: { color: colors.tally, fontWeight: '700' },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.rec },
  recText: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  micChipWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 21,
    alignItems: 'center',
  },
  micChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tally,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  micChipText: { color: colors.tallyInk, fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  bandWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  eyelineHandle: {
    position: 'absolute',
    left: 2,
    zIndex: 15,
    width: 44,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyelineGrip: {
    width: 30,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.tally,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  wpm: {
    position: 'absolute',
    right: 12,
    zIndex: 20,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  wpmRecording: { opacity: 0.5 },
  wpmBtn: { color: '#fff', fontSize: 20, fontWeight: '700' },
  wpmVal: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', color: colors.tally },
  wpmUnit: { color: 'rgba(255,255,255,0.5)', fontSize: 8, letterSpacing: 1 },
  countdown: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 30 },
  countdownNum: {
    color: '#fff',
    fontSize: 120,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 2 },
  },
  countdownCancel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  hint: {
    position: 'absolute',
    bottom: 128,
    alignSelf: 'center',
    zIndex: 20,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11.5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 22,
  },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundGlyph: { color: '#fff', fontSize: 16, fontWeight: '600' },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.rec },
  shutterStop: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  stopSquare: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.rec },
});
