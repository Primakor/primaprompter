import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors, fonts, radius } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Take } from '../../types';
import { getTake } from '../../db/repositories/takes';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Trim'>;
type Rt = RouteProp<RootStackParamList, 'Trim'>;

const HANDLE_W = 26; // px — touch target padded to >=44 via hitSlop
const FRAME_COUNT = 8;
const MIN_GAP = 0.06; // keep at least ~6% of the clip selected
const FALLBACK_DURATION_MS = 12_000;

// Filmstrip stand-in: 8 tonal frames that read as footage without a real
// thumbnail decoder. TODO(native-batch): replace with sampled poster frames.
const FRAME_TINTS = ['#20242B', '#2A2F37', '#242A32', '#31373F', '#272D35', '#2D333B', '#22272E', '#2E343D'];

function formatTimecode(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSec = clamped / 1000;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const cs = Math.floor((clamped % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function TrimScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const takeId = route.params.takeId;

  const [take, setTake] = useState<Take | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackW, setTrackW] = useState(0);

  // Selection as 0..1 fractions of the clip. Shared values drive the handle /
  // mask animations on the UI thread; the mirrored React state feeds the
  // timecode readouts.
  const inSV = useSharedValue(0);
  const outSV = useSharedValue(1);
  const [inFrac, setInFrac] = useState(0);
  const [outFrac, setOutFrac] = useState(1);

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await getTake(takeId);
      if (!alive) return;
      setTake(t);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [takeId]);

  const durationMs = take?.durationMs ?? FALLBACK_DURATION_MS;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackW(e.nativeEvent.layout.width);
  };

  const inPan = Gesture.Pan()
    .onChange((e) => {
      'worklet';
      if (trackW <= 0) return;
      const next = inSV.value + e.changeX / trackW;
      inSV.value = Math.max(0, Math.min(outSV.value - MIN_GAP, next));
      runOnJS(setInFrac)(inSV.value);
    });

  const outPan = Gesture.Pan()
    .onChange((e) => {
      'worklet';
      if (trackW <= 0) return;
      const next = outSV.value + e.changeX / trackW;
      outSV.value = Math.min(1, Math.max(inSV.value + MIN_GAP, next));
      runOnJS(setOutFrac)(outSV.value);
    });

  const leftMaskStyle = useAnimatedStyle(() => ({
    width: `${inSV.value * 100}%`,
  }));
  const rightMaskStyle = useAnimatedStyle(() => ({
    width: `${(1 - outSV.value) * 100}%`,
  }));
  const selectionStyle = useAnimatedStyle(() => ({
    left: `${inSV.value * 100}%`,
    right: `${(1 - outSV.value) * 100}%`,
  }));
  const inHandleStyle = useAnimatedStyle(() => ({
    left: `${inSV.value * 100}%`,
  }));
  const outHandleStyle = useAnimatedStyle(() => ({
    left: `${outSV.value * 100}%`,
  }));

  const inMs = inFrac * durationMs;
  const outMs = outFrac * durationMs;
  const selectedMs = Math.max(0, outMs - inMs);

  const handleSave = () => {
    // TODO(native-batch): create a non-destructive trimmed take from
    // [inFrac, outFrac] via passthrough (no re-encode), link trimmedFromTakeId,
    // then navigate to Review. For now just dismiss.
    nav.goBack();
  };

  const handleSaveToPhotos = () => {
    // TODO(native-batch): export the trimmed passthrough clip to the Photos
    // library (requires add-only Photos permission). No-op stub for now.
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.tally} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.appbar}>
        <Pressable
          onPress={() => nav.goBack()}
          hitSlop={12}
          style={styles.appbarBtn}
          accessibilityRole="button"
          accessibilityLabel="Close trim"
        >
          <Text style={styles.appbarClose}>✕</Text>
        </Pressable>
        <Text style={styles.appbarTitle}>Trim</Text>
        <Pressable
          onPress={handleSave}
          hitSlop={12}
          style={[styles.appbarBtn, styles.saveBtn]}
          accessibilityRole="button"
          accessibilityLabel="Save trim"
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      {/* Video placeholder */}
      <View style={styles.stageWrap}>
        <View style={styles.video} accessibilityRole="image" accessibilityLabel="Video preview">
          <View style={styles.playGlyphWrap}>
            <Text style={styles.playGlyph}>▶</Text>
          </View>
          <View style={styles.oneClipTag}>
            <Text style={styles.oneClipText}>ONE CLIP</Text>
          </View>
        </View>

        {/* Timecode readout */}
        <View style={styles.readoutRow}>
          <Text style={styles.readoutTime}>{formatTimecode(inMs)}</Text>
          <Text style={styles.readoutSelected}>
            ▸ {formatTimecode(selectedMs)} selected
          </Text>
          <Text style={styles.readoutTime}>{formatTimecode(outMs)}</Text>
        </View>
      </View>

      {/* Filmstrip + handles */}
      <View style={styles.trackOuter}>
        <View style={styles.track} onLayout={onTrackLayout}>
          <View style={styles.filmstrip} pointerEvents="none">
            {FRAME_TINTS.slice(0, FRAME_COUNT).map((tint, i) => (
              <View key={i} style={[styles.frame, { backgroundColor: tint }]}>
                <View style={styles.frameSheen} />
              </View>
            ))}
          </View>

          {/* Dimmed masks outside the selection */}
          <Animated.View style={[styles.mask, styles.maskLeft, leftMaskStyle]} pointerEvents="none" />
          <Animated.View style={[styles.mask, styles.maskRight, rightMaskStyle]} pointerEvents="none" />

          {/* Selection frame */}
          <Animated.View style={[styles.selection, selectionStyle]} pointerEvents="none" />

          {/* In handle */}
          <GestureDetector gesture={inPan}>
            <Animated.View
              style={[styles.handle, styles.handleIn, inHandleStyle]}
              hitSlop={{ left: 14, right: 14, top: 14, bottom: 14 }}
              accessibilityRole="adjustable"
              accessibilityLabel="Trim start handle"
              accessibilityValue={{ text: formatTimecode(inMs) }}
            >
              <View style={styles.handleGrip} />
            </Animated.View>
          </GestureDetector>

          {/* Out handle */}
          <GestureDetector gesture={outPan}>
            <Animated.View
              style={[styles.handle, styles.handleOut, outHandleStyle]}
              hitSlop={{ left: 14, right: 14, top: 14, bottom: 14 }}
              accessibilityRole="adjustable"
              accessibilityLabel="Trim end handle"
              accessibilityValue={{ text: formatTimecode(outMs) }}
            >
              <View style={styles.handleGrip} />
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Passthrough note */}
        <View style={styles.noteRow}>
          <Text style={styles.note}>
            ◇ Passthrough trim — no re-encode, no quality loss
          </Text>
        </View>
      </View>

      <View style={styles.spacer} />

      {/* Bottom primary */}
      <View style={[styles.footer, { paddingBottom: insets.bottom || 14 }]}>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={handleSaveToPhotos}
          accessibilityRole="button"
          accessibilityLabel="Save trimmed clip to Photos"
        >
          <Text style={styles.primaryText}>Save to Photos</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stage },
  center: { alignItems: 'center', justifyContent: 'center' },

  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  appbarBtn: {
    minWidth: 56,
    height: 44,
    justifyContent: 'center',
  },
  appbarClose: { fontSize: 20, color: '#FFFFFF' },
  appbarTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  saveBtn: { alignItems: 'flex-end' },
  saveText: { fontSize: 15, fontWeight: '700', color: colors.tally },

  stageWrap: { paddingHorizontal: 16 },
  video: {
    aspectRatio: 9 / 16,
    maxHeight: 380,
    borderRadius: radius.card,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playGlyphWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { fontSize: 26, color: '#FFFFFF', marginLeft: 4 },
  oneClipTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.chip,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  oneClipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
  },

  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 2,
  },
  readoutTime: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted },
  readoutSelected: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '600', color: colors.tally },

  trackOuter: { paddingHorizontal: 16, marginTop: 20 },
  track: {
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  filmstrip: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
  },
  frame: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  frameSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,11,13,0.66)',
  },
  maskLeft: { left: 0 },
  maskRight: { right: 0 },
  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.tally,
  },
  handle: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: HANDLE_W,
    marginLeft: -HANDLE_W / 2,
    backgroundColor: colors.tally,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleIn: {},
  handleOut: {},
  handleGrip: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.tallyInk,
    opacity: 0.65,
  },

  noteRow: { marginTop: 14, alignItems: 'center' },
  note: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.go,
    textAlign: 'center',
  },

  spacer: { flex: 1 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.camLine,
    backgroundColor: colors.stage,
  },
  primary: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.tally,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { opacity: 0.85 },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.tallyInk },
});
