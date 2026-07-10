import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
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
import { VideoTransport } from '../../components/VideoTransport';
import { Toast } from '../../components/Toast';
import { saveTakeToPhotos } from '../../lib/saveToPhotos';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Review'>;
type Rt = RouteProp<RootStackParamList, 'Review'>;

/** Prefix a bare filesystem path with file:// so native APIs get a URI. */
function toFileUri(path: string): string {
  return /^\w+:\/\//.test(path) ? path : `file://${path}`;
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
  const offerDeleteOriginalId = route.params.offerDeleteOriginalId;

  const [take, setTake] = useState<Take | null>(null);
  const [loading, setLoading] = useState(true);
  // One-time "delete the original?" banner shown after a trim produced this take.
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Local, self-dismissing toast (Save-to-Photos feedback). No global state.
  const [toast, setToast] = useState<{
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Clear any pending toast timer on unmount.
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (next: {
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

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

  const handleSave = async () => {
    if (!take) return;
    const result = await saveTakeToPhotos(take.fileUri);
    if (result === 'saved') {
      showToast({ message: 'Saved to Photos' });
    } else if (result === 'denied') {
      showToast({
        message: 'Photos access needed',
        actionLabel: 'Settings',
        onAction: () => Linking.openSettings(),
      });
    } else {
      showToast({ message: "Couldn't save" });
    }
  };

  const handleDeleteOriginal = async () => {
    if (offerDeleteOriginalId) await deleteTake(offerDeleteOriginalId);
    setBannerDismissed(true);
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
  const showDeleteBanner = !!offerDeleteOriginalId && !bannerDismissed;

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

      {/* Delete-original banner (offered after a Trim produced this take) */}
      {showDeleteBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Delete the original take?</Text>
          <View style={styles.bannerBtns}>
            <Pressable
              style={styles.bannerDismiss}
              onPress={() => setBannerDismissed(true)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Text style={styles.bannerDismissText}>Dismiss</Text>
            </Pressable>
            <Pressable
              style={styles.bannerDelete}
              onPress={handleDeleteOriginal}
              accessibilityRole="button"
              accessibilityLabel="Delete original take"
            >
              <Text style={styles.bannerDeleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Video stage — custom transport (playback + scrubber) */}
      <View style={styles.stage}>
        <VideoTransport uri={toFileUri(take.fileUri)} />
      </View>

      {/* Save to Photos — export a raw copy, separate from the Keep decision */}
      <Pressable
        style={styles.saveBtn}
        onPress={handleSave}
        accessibilityRole="button"
        accessibilityLabel="Save to Photos"
      >
        <Text style={styles.saveGlyph}>↓</Text>
        <Text style={styles.saveText}>Save to Photos</Text>
      </Pressable>

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

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        actionLabel={toast?.actionLabel}
        onAction={toast?.onAction}
      />
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

  banner: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#EDEBE6' },
  bannerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerDismiss: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: colors.stage,
    borderWidth: 1,
    borderColor: colors.camLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDismissText: { fontSize: 12, fontWeight: '700', color: 'rgba(237,235,230,0.75)' },
  bannerDelete: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDeleteText: { fontSize: 12, fontWeight: '700', color: colors.rec },

  saveBtn: {
    marginHorizontal: 16,
    marginTop: 2,
    height: 46,
    borderRadius: radius.card,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveGlyph: { fontSize: 17, fontWeight: '700', color: colors.tally },
  saveText: { fontSize: 13, fontWeight: '700', color: '#EDEBE6' },

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
