import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radius } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Take } from '../../types';
import { getTake, deleteTake, setKeeper } from '../../db/repositories/takes';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Review'>;
type Rt = RouteProp<RootStackParamList, 'Review'>;

// TODO(native-batch): real video playback (expo-video / react-native-video).
// Review currently shows a static poster + a non-functional transport.

/** "0:07" style timecode for the scrubber ends. */
function formatTimecode(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

function resolutionLabel(width: number, height: number): string {
  const shortSide = Math.min(width, height);
  if (shortSide >= 2000) return '4K';
  if (shortSide >= 1000) return '1080p';
  if (shortSide >= 700) return '720p';
  return `${width}×${height}`;
}

export function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const takeId = route.params.takeId;

  const [take, setTake] = useState<Take | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await getTake(takeId);
      if (alive) {
        setTake(t);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [takeId]);

  const handleTrim = () => nav.navigate('Trim', { takeId });

  const handleDiscard = async () => {
    await deleteTake(takeId);
    nav.goBack();
  };

  const handleRetake = () => {
    nav.navigate('Record', { scriptId: take?.scriptId ?? undefined });
  };

  const handleKeep = async () => {
    await setKeeper(takeId, true);
    nav.goBack();
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.tally} />
      </View>
    );
  }

  if (!take) {
    return (
      <View style={[styles.root, styles.center, { padding: 24 }]}>
        <Text style={styles.missingTitle}>Take not found</Text>
        <Text style={styles.missingBody}>
          This clip may have been discarded already.
        </Text>
        <Pressable
          style={styles.missingBtn}
          onPress={() => nav.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.missingBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const badge = `${resolutionLabel(take.width, take.height)} · ${take.fps}fps · ${formatSize(
    take.fileSizeBytes
  )}`;

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.topLeft}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Take</Text>
          </View>
          <View style={styles.badge} accessibilityRole="text" accessibilityLabel={`Format: ${badge}`}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        </View>
        <Pressable
          style={styles.scissor}
          onPress={handleTrim}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Trim this take"
        >
          <Text style={styles.scissorGlyph}>✂</Text>
        </Pressable>
      </View>

      {/* Video stage */}
      <View style={styles.stage}>
        <View style={styles.videoPlaceholder}>
          <Pressable
            style={styles.playBtn}
            onPress={() => {
              /* TODO(native-batch): toggle playback */
            }}
            accessibilityRole="button"
            accessibilityLabel="Play take"
          >
            <Text style={styles.playGlyph}>▶</Text>
          </Pressable>
        </View>
      </View>

      {/* Scrubber */}
      <View style={styles.scrubWrap}>
        <Text style={styles.tc}>{formatTimecode(0)}</Text>
        <View style={styles.track} accessibilityRole="adjustable" accessibilityLabel="Playback position">
          <View style={styles.trackFill} />
          <View style={styles.knob} />
        </View>
        <Text style={styles.tc}>{formatTimecode(take.durationMs)}</Text>
      </View>

      {/* Bottom action row */}
      <View style={[styles.actions, { paddingBottom: insets.bottom || 14 }]}>
        <Pressable
          style={[styles.action, styles.actionDiscard]}
          onPress={handleDiscard}
          accessibilityRole="button"
          accessibilityLabel="Discard take"
        >
          <Text style={[styles.actionGlyph, styles.discardTint]}>✕</Text>
          <Text style={[styles.actionText, styles.discardTint]}>Discard</Text>
        </Pressable>

        <Pressable
          style={[styles.action, styles.actionRetake]}
          onPress={handleRetake}
          accessibilityRole="button"
          accessibilityLabel="Retake"
        >
          <Text style={[styles.actionGlyph, styles.retakeTint]}>↺</Text>
          <Text style={[styles.actionText, styles.retakeTint]}>Retake</Text>
        </Pressable>

        <Pressable
          style={[styles.action, styles.actionKeep]}
          onPress={handleKeep}
          accessibilityRole="button"
          accessibilityLabel="Keep take"
        >
          <Text style={[styles.actionGlyph, styles.keepTint]}>✓</Text>
          <Text style={[styles.actionText, styles.keepTint]}>Keep</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stage },
  center: { alignItems: 'center', justifyContent: 'center' },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pill: {
    paddingHorizontal: 12,
    height: 26,
    borderRadius: radius.chip,
    backgroundColor: colors.tally,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.tallyInk,
  },
  badge: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.camLine,
    backgroundColor: colors.stage2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkMuted },
  scissor: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scissorGlyph: { fontSize: 18, color: '#EDEBE6' },

  stage: { flex: 1, paddingHorizontal: 16, paddingBottom: 8 },
  videoPlaceholder: {
    flex: 1,
    borderRadius: radius.card,
    backgroundColor: '#0B0C0F',
    borderWidth: 1,
    borderColor: colors.camLine,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
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

  scrubWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  tc: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted, minWidth: 34 },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.camLine,
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    width: '0%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.tally,
  },
  knob: {
    position: 'absolute',
    left: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -1,
    backgroundColor: colors.tally,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  action: {
    flex: 1,
    minHeight: 60,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderWidth: 1,
  },
  actionGlyph: { fontSize: 20, fontWeight: '700' },
  actionText: { fontSize: 13, fontWeight: '700' },
  actionDiscard: { backgroundColor: 'rgba(255,59,48,0.12)', borderColor: 'rgba(255,59,48,0.35)' },
  discardTint: { color: colors.rec },
  actionRetake: { backgroundColor: colors.stage2, borderColor: colors.camLine },
  retakeTint: { color: '#EDEBE6' },
  actionKeep: { backgroundColor: colors.tally, borderColor: colors.tally },
  keepTint: { color: colors.tallyInk },

  missingTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: '#EDEBE6', marginBottom: 8 },
  missingBody: { fontSize: 13, lineHeight: 20, color: colors.inkMuted, textAlign: 'center', marginBottom: 20 },
  missingBtn: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingBtnText: { fontSize: 14, fontWeight: '700', color: '#EDEBE6' },
});
