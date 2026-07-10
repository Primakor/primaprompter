import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Camera, CameraDevice } from 'react-native-vision-camera';
import { colors, fonts } from '../../theme/tokens';

type Props = {
  device: CameraDevice;
  /** useRef<Camera>(null) resolves to RefObject<Camera | null> under React 19. */
  cameraRef: React.RefObject<Camera | null>;
  /** Shared zoom the pinch drives; the Camera reads it via animatedProps. */
  zoom: SharedValue<number>;
  exposure: number;
  onExposureChange: (v: number) => void;
  torch: boolean;
  onToggleTorch: () => void;
  showTorch: boolean;
  recording: boolean;
};

const RETICLE = 74;
const SLIDER_W = 36;
const SLIDER_H = 148;
const THUMB = 26;
const GAP = 14;

const clampJS = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * On-canvas pro camera controls, mounted directly above the <Camera> at a LOW
 * zIndex so ONLY bare-preview touches reach it — the teleprompter band, chrome,
 * WPM rail, bottom controls and sheets all sit higher and capture their own
 * touches. Standard camera grammar: pinch-zoom, tap-focus (one-shot), an
 * exposure-compensation "brightness" slider beside the reticle, and a rear-lens
 * torch chip. No lock/hold semantics — vision-camera 4.7.3 has no AE/AF lock.
 */
export function CameraCanvasControls({
  device,
  cameraRef,
  zoom,
  exposure,
  onExposureChange,
  torch,
  onToggleTorch,
  showTorch,
  recording,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  // Hoist the device ranges to primitives so gesture worklets close over plain
  // numbers rather than capturing the whole (formats-heavy) device object.
  const minZoom = device.minZoom;
  const maxZoom = device.maxZoom;
  const minExp = device.minExposure;
  const maxExp = device.maxExposure;
  const expRange = Math.max(0.0001, maxExp - minExp);

  // --- zoom scale indicator ("2.0x"), auto-fades ~1s after the pinch ends ---
  const [zoomText, setZoomText] = useState('1.0x');
  const zoomUi = useSharedValue(0);
  const startZoom = useSharedValue(0);
  const setZoomLabel = useCallback((z: number) => setZoomText(`${z.toFixed(1)}x`), []);

  // --- focus reticle + brightness slider (share one fade) ---
  const [focusVisible, setFocusVisible] = useState(false);
  const [reticle, setReticle] = useState({ x: winW / 2, y: winH / 2 });
  const focusOpacity = useSharedValue(0);
  const focusScale = useSharedValue(1);
  const expFrac = useSharedValue((exposure - minExp) / expRange);
  const startFrac = useSharedValue(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    []
  );

  const armFade = useCallback(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      focusOpacity.value = withTiming(0, { duration: 420 });
      setFocusVisible(false);
    }, 1500);
  }, [focusOpacity]);

  // Adjusting the slider is a mid-take tool — keep the UI alive while dragging.
  const keepFocusAlive = useCallback(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    focusOpacity.value = withTiming(1, { duration: 120 });
  }, [focusOpacity]);

  const focusAt = useCallback(
    (x: number, y: number) => {
      // One-shot focus. vision-camera throws on devices without focus support
      // (and rejects transiently) — swallow both, never surface to the UI.
      try {
        cameraRef.current?.focus({ x, y })?.catch(() => {});
      } catch {
        // focus unsupported on this device — ignore
      }
      setReticle({ x, y });
      setFocusVisible(true);
      focusScale.value = 1.2;
      focusScale.value = withTiming(1, { duration: 200 });
      focusOpacity.value = withTiming(1, { duration: 140 });
      armFade();
    },
    [cameraRef, focusScale, focusOpacity, armFade]
  );

  // --- gestures owned by the bare-preview layer ---
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoom.value;
      zoomUi.value = withTiming(1, { duration: 120 });
    })
    .onUpdate((e) => {
      const z = Math.min(maxZoom, Math.max(minZoom, startZoom.value * e.scale));
      zoom.value = z;
      runOnJS(setZoomLabel)(z);
    })
    .onEnd(() => {
      zoomUi.value = withDelay(900, withTiming(0, { duration: 450 }));
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      runOnJS(focusAt)(e.x, e.y);
    });

  const canvasGesture = Gesture.Race(pinch, tap);

  // Vertical exposure-comp slider: drag up = brighter. Own detector, on top of
  // the canvas layer, so it never fights the tap/pinch below it.
  const sliderPan = Gesture.Pan()
    .onStart(() => {
      startFrac.value = expFrac.value;
      runOnJS(keepFocusAlive)();
    })
    .onUpdate((e) => {
      const f = Math.min(1, Math.max(0, startFrac.value - e.translationY / SLIDER_H));
      expFrac.value = f;
      runOnJS(onExposureChange)(minExp + f * expRange);
    })
    .onEnd(() => {
      runOnJS(armFade)();
    });

  const zoomUiStyle = useAnimatedStyle(() => ({ opacity: zoomUi.value }));
  const focusStyle = useAnimatedStyle(() => ({
    opacity: focusOpacity.value,
    transform: [{ scale: focusScale.value }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: focusOpacity.value }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - expFrac.value) * (SLIDER_H - THUMB) }],
  }));

  // Place the slider beside the reticle, flipping to the near side + clamping so
  // it never runs off the frame.
  const flipLeft = reticle.x + RETICLE / 2 + GAP + SLIDER_W > winW - 12;
  const sliderLeft = flipLeft
    ? reticle.x - RETICLE / 2 - GAP - SLIDER_W
    : reticle.x + RETICLE / 2 + GAP;
  const sliderTop = clampJS(
    reticle.y - SLIDER_H / 2,
    insets.top + 12,
    winH - insets.bottom - SLIDER_H - 12
  );
  const hintTop = clampJS(
    reticle.y + RETICLE / 2 + 14,
    insets.top + 44,
    winH - insets.bottom - 64
  );

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* bare-preview gesture layer — low z, only bare-camera touches reach it */}
      <GestureDetector gesture={canvasGesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false} />
      </GestureDetector>

      {/* tap-focus reticle */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.reticle,
          { left: reticle.x - RETICLE / 2, top: reticle.y - RETICLE / 2 },
          focusStyle,
        ]}
      >
        <View style={styles.reticleBox} />
      </Animated.View>

      {/* brightness (exposure-comp) slider, beside the reticle, fades with it */}
      <Animated.View
        pointerEvents={focusVisible ? 'box-none' : 'none'}
        style={[styles.sliderWrap, { left: sliderLeft, top: sliderTop }, fadeStyle]}
      >
        <GestureDetector gesture={sliderPan}>
          <View style={styles.sliderTrack}>
            <View style={styles.sliderSpine} pointerEvents="none" />
            <Animated.View style={[styles.sliderThumb, thumbStyle]} pointerEvents="none">
              <View style={styles.sliderThumbCore} />
            </Animated.View>
          </View>
        </GestureDetector>
      </Animated.View>

      {/* discoverability hint — mandated copy, never "lock" */}
      <Animated.View pointerEvents="none" style={[styles.hintWrap, { top: hintTop }, fadeStyle]}>
        <Text style={styles.hintText}>Tap to focus · slider adjusts brightness</Text>
      </Animated.View>

      {/* zoom scale indicator */}
      <Animated.View
        pointerEvents="none"
        style={[styles.zoomWrap, { bottom: insets.bottom + 118 }, zoomUiStyle]}
      >
        <Text style={styles.zoomPill}>{zoomText}</Text>
      </Animated.View>

      {/* torch chip — rear lens only, collapses while recording */}
      {showTorch && !recording && (
        <Pressable
          onPress={onToggleTorch}
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          accessibilityLabel="Torch"
          hitSlop={8}
          style={[styles.torchChip, { top: insets.top + 52 }, torch && styles.torchChipOn]}
        >
          <View style={[styles.torchDot, torch && styles.torchDotOn]} />
          <Text style={[styles.torchText, torch && styles.torchTextOn]}>TORCH</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },

  reticle: {
    position: 'absolute',
    width: RETICLE,
    height: RETICLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: RETICLE,
    height: RETICLE,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.tally,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },

  sliderWrap: {
    position: 'absolute',
    width: SLIDER_W,
    height: SLIDER_H,
  },
  sliderTrack: {
    width: SLIDER_W,
    height: SLIDER_H,
    borderRadius: SLIDER_W / 2,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  sliderSpine: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: SLIDER_W / 2 - 1,
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  sliderThumb: {
    position: 'absolute',
    top: 0,
    left: SLIDER_W / 2 - THUMB / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.tally,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderThumbCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tallyInk,
  },

  hintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hintText: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  zoomWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  zoomPill: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },

  torchChip: {
    position: 'absolute',
    left: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  torchChipOn: { backgroundColor: colors.tally },
  torchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  torchDotOn: { backgroundColor: colors.tallyInk },
  torchText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.6,
  },
  torchTextOn: { color: colors.tallyInk },
});
