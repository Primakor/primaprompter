import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radius, space } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Take } from '../../types';
import {
  listTakesGroupedByScript,
  type TakeGroup,
} from '../../db/repositories/takes';
import { formatDuration } from '../../lib/estimateDuration';
import { formatBytes, getFreeDiskBytes } from '../../lib/storage';
import { saveTakeToPhotos } from '../../lib/saveToPhotos';
import { Toast } from '../../components/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Gallery'>;

const GRID_GAP = space(3); // 12
const H_PADDING = 16;
const COLS = 2;
const CARD_W =
  (Dimensions.get('window').width - H_PADDING * 2 - GRID_GAP * (COLS - 1)) / COLS;
const CARD_H = (CARD_W * 16) / 9;

/**
 * TODO(native-batch): back this with a real share sheet
 * (expo-sharing / Share.share over the keeper take file URIs).
 */
function shareTakes(takes: Take[]): void {
  // Placeholder: no-op until the native share batch lands.
  void takes;
}

/** Short-side resolution label, e.g. 1080 for a 1080×1920 portrait take. */
function resLabel(take: Take): string {
  return `${Math.min(take.width, take.height)}·${take.fps}`;
}

function TakeCard({
  take,
  onOpen,
  onSave,
  saving,
}: {
  take: Take;
  onOpen: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Take, ${resLabel(take)}, ${formatDuration(
        take.durationMs
      )}${take.isKeeper ? ', keeper' : ''}`}
    >
      {/* Dark gradient placeholder thumbnail (faked with stacked bands — no gradient dep). */}
      <View style={styles.thumb}>
        <View style={styles.thumbBandTop} />
        <View style={styles.thumbBandBottom} />

        <View style={styles.resBadge}>
          <Text style={styles.resBadgeText}>{resLabel(take)}</Text>
        </View>

        <View
          style={styles.star}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <Text style={[styles.starGlyph, take.isKeeper && styles.starOn]}>
            {take.isKeeper ? '★' : '☆'}
          </Text>
        </View>

        <View style={styles.durBadge}>
          <Text style={styles.durText}>{formatDuration(take.durationMs)}</Text>
        </View>

        <Pressable
          onPress={onSave}
          disabled={saving}
          hitSlop={8}
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Save to Photos"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#F3F1EB" />
          ) : (
            <Text style={styles.saveGlyph}>⤓</Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

function Group({
  group,
  onOpenTake,
  onSaveTake,
  savingId,
}: {
  group: TakeGroup;
  onOpenTake: (take: Take) => void;
  onSaveTake: (take: Take) => void;
  savingId: string | null;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader} numberOfLines={1}>
        {group.scriptTitle}
        <Text style={styles.groupDot}>{'  ·  '}</Text>
        <Text style={styles.groupCount}>
          {group.takes.length} take{group.takes.length === 1 ? '' : 's'}
        </Text>
      </Text>
      <View style={styles.grid}>
        {group.takes.map((t) => (
          <TakeCard
            key={t.id}
            take={t}
            onOpen={() => onOpenTake(t)}
            onSave={() => onSaveTake(t)}
            saving={savingId === t.id}
          />
        ))}
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.glyph}>
        <Text style={styles.glyphMark}>▤</Text>
      </View>
      <Text style={styles.emptyTitle}>No takes yet</Text>
      <Text style={styles.emptyBody}>Record one from a script.</Text>
    </View>
  );
}

export function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [groups, setGroups] = useState<TakeGroup[] | null>(null);
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastAction, setToastAction] = useState<{
    label: string;
    onAction: () => void;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const showToast = useCallback(
    (message: string, action?: { label: string; onAction: () => void }) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToastMsg(message);
      setToastAction(action ?? null);
      setToastVisible(true);
      toastTimer.current = setTimeout(() => setToastVisible(false), 3200);
    },
    []
  );

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const handleSaveTake = useCallback(
    async (take: Take) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSavingId(take.id);
      try {
        const result = await saveTakeToPhotos(take.fileUri);
        if (result === 'saved') {
          showToast('Saved to Photos');
        } else if (result === 'denied') {
          showToast('Photos access needed', {
            label: 'Settings',
            onAction: () => Linking.openSettings().catch(() => {}),
          });
        } else {
          showToast("Couldn't save");
        }
      } finally {
        savingRef.current = false;
        setSavingId(null);
      }
    },
    [showToast]
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [g, free] = await Promise.all([
          listTakesGroupedByScript(),
          getFreeDiskBytes(),
        ]);
        if (!alive) return;
        setGroups(g);
        setFreeBytes(free);
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const allTakes = groups ? groups.flatMap((g) => g.takes) : [];
  const totalBytes = allTakes.reduce((sum, t) => sum + t.fileSizeBytes, 0);
  const hasTakes = allTakes.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable
          onPress={() => nav.goBack()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.heading}>Takes</Text>
        <Pressable
          onPress={() => shareTakes(allTakes)}
          hitSlop={12}
          disabled={!hasTakes}
          style={styles.shareBtn}
          accessibilityRole="button"
          accessibilityLabel="Share takes"
        >
          <Text style={[styles.share, !hasTakes && styles.shareOff]}>↑</Text>
        </Pressable>
      </View>

      {groups === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tally} />
        </View>
      ) : !hasTakes ? (
        <EmptyState />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {groups.map((g) => (
            <Group
              key={g.scriptId ?? '__unlinked__'}
              group={g}
              onOpenTake={(t) => nav.navigate('Review', { takeId: t.id })}
              onSaveTake={handleSaveTake}
              savingId={savingId}
            />
          ))}
        </ScrollView>
      )}

      {hasTakes && (
        <View style={[styles.footer, { paddingBottom: insets.bottom || 12 }]}>
          <Text style={styles.footerText}>
            {allTakes.length} take{allTakes.length === 1 ? '' : 's'} ·{' '}
            {formatBytes(totalBytes)}
          </Text>
          {freeBytes !== null && (
            <Text style={styles.footerText}>{formatBytes(freeBytes)} free</Text>
          )}
        </View>
      )}

      <Toast
        visible={toastVisible}
        message={toastMsg}
        actionLabel={toastAction?.label}
        onAction={toastAction?.onAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { fontSize: 34, fontWeight: '300', color: colors.ink, marginTop: -6 },
  heading: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: colors.ink,
  },
  shareBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: { fontSize: 22, fontWeight: '700', color: colors.tally },
  shareOff: { color: colors.inkMuted, opacity: 0.4 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: H_PADDING, paddingTop: 4, paddingBottom: 96 },

  group: { marginBottom: space(6) },
  groupHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: space(3),
  },
  groupDot: { color: colors.inkMuted, opacity: 0.5, fontWeight: '400' },
  groupCount: { color: colors.inkMuted, fontWeight: '600', fontSize: 13 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },

  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.stage,
  },
  cardPressed: { opacity: 0.8 },

  thumb: { flex: 1, backgroundColor: colors.stage },
  thumbBandTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: colors.stage2,
  },
  thumbBandBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: colors.stage,
  },

  resBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  resBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    color: '#F3F1EB',
  },

  star: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starGlyph: {
    fontSize: 18,
    color: 'rgba(243,241,235,0.85)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  starOn: { color: colors.tally },

  durBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  durText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: '#F3F1EB',
  },

  saveBtn: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnPressed: { opacity: 0.6 },
  saveGlyph: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F3F1EB',
    marginTop: -1,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
  },
  glyph: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: colors.paperCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  glyphMark: { fontSize: 40, color: colors.tally, fontWeight: '700' },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkMuted,
    textAlign: 'center',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerText: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted },
});
