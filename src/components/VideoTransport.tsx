import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  PanResponder,
  type AccessibilityActionEvent,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { colors, fonts, radius } from '../theme/tokens';

/**
 * Custom video transport for take review.
 *
 * Native controls are hidden — we render our own play/pause + scrubber so the
 * playback UX matches the studio design. Product decisions: tap-to-play,
 * NO autoplay, NO loop. The scrubber advances by polling player.currentTime on
 * an interval (expo-video's timeUpdate event fires coarsely); the poll is torn
 * down on unmount / source change.
 */

const POLL_MS = 150;
/** a11y increment/decrement step, in seconds. */
const STEP_SEC = 5;

/** Guard against NaN/Infinity that expo-video can surface before load. */
function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** "0:07" style timecode from a seconds value. */
function fmt(seconds: number): string {
  const total = Math.max(0, Math.floor(safe(seconds)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoTransport({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    // No autoplay, no loop (product-brain).
    p.loop = false;
  });

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // True while the user is dragging the scrubber — suppress the poll's
  // currentTime writes so the knob doesn't fight the finger.
  const scrubbingRef = useRef(false);
  // Track geometry in window coords, captured on layout for pageX → fraction.
  const trackRef = useRef<View>(null);
  const trackGeo = useRef({ x: 0, w: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      if (!scrubbingRef.current) setCurrentTime(safe(player.currentTime));
      setDuration(safe(player.duration));
      setPlaying(!!player.playing);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [player]);

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
      return;
    }
    // Replay from the top if we're parked at the end (loop is off).
    const d = safe(player.duration);
    if (d > 0 && safe(player.currentTime) >= d - 0.05) {
      player.currentTime = 0;
      setCurrentTime(0);
    }
    player.play();
  };

  const seekToFraction = (frac: number) => {
    const d = safe(player.duration);
    if (d <= 0) return;
    const t = Math.max(0, Math.min(1, frac)) * d;
    player.currentTime = t;
    setCurrentTime(t);
  };

  const seekBy = (delta: number) => {
    const d = safe(player.duration);
    const t = Math.max(0, Math.min(d, safe(player.currentTime) + delta));
    player.currentTime = t;
    setCurrentTime(t);
  };

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      trackGeo.current = { x, w };
    });
  };

  const seekToPageX = (pageX: number) => {
    const { x, w } = trackGeo.current;
    if (w <= 0) return;
    seekToFraction((pageX - x) / w);
  };

  // PanResponder (plain JS, no worklets) drives drag-scrubbing. Created once;
  // it closes over the stable player instance and refs.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        scrubbingRef.current = true;
        seekToPageX(e.nativeEvent.pageX);
      },
      onPanResponderMove: (e) => seekToPageX(e.nativeEvent.pageX),
      onPanResponderRelease: () => {
        scrubbingRef.current = false;
      },
      onPanResponderTerminate: () => {
        scrubbingRef.current = false;
      },
    })
  ).current;

  const onA11yAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') seekBy(STEP_SEC);
    else if (e.nativeEvent.actionName === 'decrement') seekBy(-STEP_SEC);
  };

  const frac = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const fillPct = `${frac * 100}%` as const;

  return (
    <View style={styles.container}>
      <View style={styles.videoBox}>
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
        />
        {/* Tap anywhere on the video toggles playback. Hidden from a11y so the
            center button is the single announced play/pause control. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={togglePlay}
          accessible={false}
        >
          <View style={styles.centerOverlay} pointerEvents="box-none">
            <Pressable
              style={styles.playBtn}
              onPress={togglePlay}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <Text style={styles.playGlyph}>▶</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </View>

      <View style={styles.scrubWrap}>
        <Text style={styles.tc}>{fmt(currentTime)}</Text>
        <View
          ref={trackRef}
          onLayout={measureTrack}
          style={styles.trackHit}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Playback position"
          accessibilityValue={{
            min: 0,
            max: Math.round(duration),
            now: Math.round(currentTime),
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onA11yAction}
          {...pan.panHandlers}
        >
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: fillPct }]} />
            <View style={[styles.knob, { left: fillPct }]} />
          </View>
        </View>
        <Text style={styles.tc}>{fmt(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  videoBox: {
    flex: 1,
    borderRadius: radius.card,
    backgroundColor: '#0B0C0F',
    borderWidth: 1,
    borderColor: colors.camLine,
    overflow: 'hidden',
  },
  centerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(20,22,26,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(237,235,230,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { fontSize: 34, color: '#EDEBE6', marginLeft: 5 },
  pauseIcon: { flexDirection: 'row', gap: 7 },
  pauseBar: { width: 6, height: 28, borderRadius: 2, backgroundColor: '#EDEBE6' },

  scrubWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 16,
  },
  tc: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted, minWidth: 34 },
  trackHit: { flex: 1, height: 28, justifyContent: 'center' },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.camLine,
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.tally,
  },
  knob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    backgroundColor: colors.tally,
  },
});
