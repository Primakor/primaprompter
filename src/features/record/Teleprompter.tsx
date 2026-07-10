import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors, fonts } from '../../theme/tokens';
import { countWords } from '../../lib/estimateDuration';
import type { TeleprompterPrefs } from '../../types';

const CUE_SPLIT = /(\[[^\]]*\])/g;
const isCue = (s: string) => /^\[[^\]]*\]$/.test(s);

type Props = {
  body: string;
  wpm: number;
  playing: boolean;
  prefs: TeleprompterPrefs;
  height: number;
  /** Tap on the band toggles play/pause. */
  onTogglePlay: () => void;
  /** Reset signal — bump to scroll back to the top. */
  resetKey?: number;
};

/**
 * Pinned-band teleprompter: text scrolls upward through a fixed band on the UI
 * thread (Reanimated). Tap to pause/resume, drag to scrub. Camera-independent —
 * renders over anything (real camera on device, a plain backdrop in the sim).
 */
export function Teleprompter({
  body,
  wpm,
  playing,
  prefs,
  height,
  onTogglePlay,
  resetKey = 0,
}: Props) {
  const scrollY = useSharedValue(0);
  const [contentH, setContentH] = useState(0);

  const wordCount = useMemo(() => countWords(body), [body]);
  const totalDurationMs = wordCount > 0 && wpm > 0 ? (wordCount / wpm) * 60000 : 0;
  const scrollDist = Math.max(1, contentH);

  useEffect(() => {
    cancelAnimation(scrollY);
    scrollY.value = 0;
  }, [resetKey, body]);

  useEffect(() => {
    if (contentH <= 0) return;
    if (playing && totalDurationMs > 0) {
      const remainingFraction = 1 - -scrollY.value / scrollDist;
      const ms = totalDurationMs * Math.max(0, Math.min(1, remainingFraction));
      scrollY.value = withTiming(-scrollDist, { duration: ms, easing: Easing.linear });
    } else {
      cancelAnimation(scrollY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, wpm, contentH]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value }],
  }));

  const pan = Gesture.Pan()
    .onChange((e) => {
      cancelAnimation(scrollY);
      const next = scrollY.value + e.changeY;
      scrollY.value = Math.min(0, Math.max(-scrollDist, next));
    });
  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    onTogglePlay();
  });
  const gesture = Gesture.Exclusive(pan, tap);

  const textStyle = [
    styles.text,
    { fontSize: prefs.fontSize, lineHeight: prefs.fontSize * prefs.lineHeight },
    prefs.fontFamily === 'dyslexic' && { fontFamily: fonts.mono },
  ];
  const cueStyle = [textStyle, styles.cue];
  const parts = body.length ? body.split(CUE_SPLIT).filter((p) => p !== '') : ['Nothing to read.'];

  return (
    <View style={[styles.band, { height }]}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(8,9,11,${prefs.bandOpacity})` }]}
        pointerEvents="none"
      />
      <GestureDetector gesture={gesture}>
        <View style={styles.clip}>
          <Animated.View
            style={[styles.content, contentStyle, prefs.mirrorText && styles.mirrored]}
            onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
          >
            <Text style={textStyle}>
              {parts.map((p, i) =>
                isCue(p) ? (
                  <Text key={i} style={cueStyle}>
                    {p}
                  </Text>
                ) : (
                  <Text key={i}>{p}</Text>
                )
              )}
            </Text>
          </Animated.View>
        </View>
      </GestureDetector>
      {/* fixed reading-line caret near the top of the band */}
      <View pointerEvents="none" style={styles.caret} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    marginHorizontal: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  clip: { flex: 1, overflow: 'hidden' },
  content: { paddingHorizontal: 18, paddingLeft: 24 },
  mirrored: { transform: [{ scaleX: -1 }] },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cue: { color: colors.cue, fontFamily: fonts.mono, fontWeight: '500' },
  caret: {
    position: 'absolute',
    left: 11,
    top: 14,
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.tally,
  },
});
