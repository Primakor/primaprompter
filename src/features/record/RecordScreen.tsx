import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
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
import { colors, fonts } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { CameraPosition, Script, TeleprompterPrefs } from '../../types';
import { getScript } from '../../db/repositories/scripts';
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

function tc(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function RecordScreen() {
  const insets = useSafeAreaInsets();
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

  const cameraRef = useRef<Camera>(null);
  const startTs = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const hasCamera = !!device && camera.hasPermission;
  const canCapture = hasCamera && cameraReady;

  const beginRecording = useCallback(() => {
    setMode('recording');
    setPlaying(true);
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
  }, [canCapture, capture, scriptId, nav]);

  const startCapture = useCallback(() => {
    setResetKey((k) => k + 1);
    const n = prefs.countdownSeconds;
    if (n > 0) {
      setMode('countdown');
      setCountdown(n);
      let c = n;
      const iv = setInterval(() => {
        c -= 1;
        if (c <= 0) {
          clearInterval(iv);
          setCountdown(0);
          beginRecording();
        } else {
          setCountdown(c);
        }
      }, 1000);
    } else {
      beginRecording();
    }
  }, [prefs.countdownSeconds, beginRecording]);

  const stopCapture = useCallback(async () => {
    if (timer.current) clearInterval(timer.current);
    setPlaying(false);
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

  const bumpWpm = (d: number) =>
    setPrefs((p) => {
      const next = { ...p, defaultWpm: Math.max(60, Math.min(260, p.defaultWpm + d)) };
      setTeleprompterPrefs(next);
      return next;
    });

  const applyPrefs = (p: TeleprompterPrefs) => {
    setPrefs(p);
    setTeleprompterPrefs(p);
  };
  const applyCapture = (c: typeof capture) => {
    setCapture(c);
    setCaptureSettings(c);
  };

  const recording = mode === 'recording';
  const bandHeight = 148;
  const body = script?.body ?? 'Open a script from the Library to read it here.';

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

      {/* teleprompter band pinned high near the lens */}
      <View style={{ marginTop: insets.top + 52 }}>
        <Teleprompter
          body={body}
          wpm={prefs.defaultWpm}
          playing={playing}
          prefs={prefs}
          height={bandHeight}
          resetKey={resetKey}
          onTogglePlay={() => setPlaying((p) => !p)}
        />
      </View>

      {/* WPM rail (prompter control — persists while recording) */}
      {!recording && (
        <View style={[styles.wpm, { top: insets.top + 220 }]}>
          <Pressable onPress={() => bumpWpm(5)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Faster">
            <Text style={styles.wpmBtn}>＋</Text>
          </Pressable>
          <Text style={styles.wpmVal}>{prefs.defaultWpm}</Text>
          <Text style={styles.wpmUnit}>WPM</Text>
          <Pressable onPress={() => bumpWpm(-5)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Slower">
            <Text style={styles.wpmBtn}>−</Text>
          </Pressable>
        </View>
      )}

      {countdown > 0 && (
        <View style={styles.countdown} pointerEvents="none">
          <Text style={styles.countdownNum}>{countdown}</Text>
        </View>
      )}

      {recording && (
        <Text style={styles.hint} pointerEvents="none">
          Tap the script to pause · Stop to finish
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
        ) : (
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

      {sheet === 'capture' && (
        <CaptureSettingsSheet settings={capture} onChange={applyCapture} onClose={() => setSheet(null)} />
      )}
      {sheet === 'prompter' && (
        <PrompterAppearanceSheet prefs={prefs} onChange={applyPrefs} onClose={() => setSheet(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stage },
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
