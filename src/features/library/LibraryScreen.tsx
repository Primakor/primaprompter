import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme/tokens';
import type { Script } from '../../types';
import { useScripts } from './useScripts';
import { createScript } from '../../db/repositories/scripts';
import { estimateDurationMs, formatDuration } from '../../lib/estimateDuration';
import { formatRelative } from '../../lib/formatRelative';
import { getTeleprompterPrefs } from '../../store/prefs';

const FOLDERS = ['All', 'Reels', 'Client work', 'Personal'];
const CUE_TAG_RE = /\[[^\]]*\]/g;

function preview(body: string): string {
  return body.replace(CUE_TAG_RE, '').replace(/\s+/g, ' ').trim();
}

function ScriptCard({ script }: { script: Script }) {
  const wpm = script.wpmOverride ?? getTeleprompterPrefs().defaultWpm;
  const dur = formatDuration(estimateDurationMs(script.wordCount, wpm));
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Script: ${script.title}, ${script.wordCount} words, about ${dur}`}
    >
      <Text style={styles.cardTitle} numberOfLines={1}>
        {script.title}
      </Text>
      <Text style={styles.cardPreview} numberOfLines={2}>
        {preview(script.body) || 'Empty script'}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{script.wordCount} words</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={[styles.metaText, styles.metaAccent]}>≈ {dur}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>edited {formatRelative(script.updatedAt)}</Text>
      </View>
    </Pressable>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.glyph}>
        <Text style={styles.glyphMark}>¶</Text>
      </View>
      <Text style={styles.emptyTitle}>Nothing to read yet</Text>
      <Text style={styles.emptyBody}>
        Write or paste a script — we'll float it right by the lens while you record, so your
        eyes stay on camera.
      </Text>
      <View style={styles.btnRow}>
        <Pressable
          style={styles.btnPrimary}
          onPress={onNew}
          accessibilityRole="button"
          accessibilityLabel="Write a script"
        >
          <Text style={styles.btnPrimaryText}>＋ Write a script</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [query] = useState('');
  const { scripts, refresh } = useScripts(query);

  const handleNew = async () => {
    await createScript({ title: 'Untitled script', body: '' });
    await refresh();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Text style={styles.wordmark}>
          Prima<Text style={{ color: colors.tally }}>Prompter</Text>
        </Text>
        <View style={styles.iconBtn}>
          <Text style={styles.iconGlyph}>⌕</Text>
        </View>
      </View>

      <View style={styles.foldersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.foldersContent}
        >
          {FOLDERS.map((f, i) => (
            <View key={f} style={[styles.chip, i === 0 && styles.chipOn]}>
              <Text style={[styles.chipText, i === 0 && styles.chipTextOn]}>{f}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {scripts === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tally} />
        </View>
      ) : scripts.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {scripts.map((s) => (
            <ScriptCard key={s.id} script={s} />
          ))}
        </ScrollView>
      )}

      {scripts && scripts.length > 0 && (
        <Pressable
          style={[styles.fab, { bottom: 84 + insets.bottom }]}
          onPress={handleNew}
          accessibilityRole="button"
          accessibilityLabel="New script"
        >
          <Text style={styles.fabPlus}>＋</Text>
          <Text style={styles.fabText}>New script</Text>
        </Pressable>
      )}

      <View style={[styles.tabbar, { paddingBottom: insets.bottom || 10 }]}>
        <View style={styles.tab}>
          <Text style={[styles.tabText, styles.tabOn]}>Library</Text>
        </View>
        <View style={styles.tab}>
          <Text style={styles.tabText}>Settings</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: colors.ink,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 20, color: colors.ink },
  foldersWrap: { height: 44 },
  foldersContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.tally, borderColor: colors.tally },
  chipText: { fontSize: 13, color: colors.inkMuted },
  chipTextOn: { color: colors.tallyInk, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 130 },
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.card,
    padding: 15,
    marginBottom: 11,
  },
  cardPressed: { opacity: 0.7 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.ink, marginBottom: 5 },
  cardPreview: { fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11 },
  metaText: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkMuted },
  metaAccent: { color: colors.tally },
  metaDot: { color: colors.inkMuted, opacity: 0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  glyph: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: colors.paperCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  glyphMark: { fontSize: 44, color: colors.tally, fontWeight: '700' },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptyBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  btnRow: { marginTop: 20, width: '100%' },
  btnPrimary: {
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.tally,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: colors.tallyInk },
  fab: {
    position: 'absolute',
    right: 16,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: colors.tally,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.tally,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabPlus: { fontSize: 20, color: colors.tallyInk, fontWeight: '700', marginTop: -2 },
  fabText: { fontSize: 15, fontWeight: '700', color: colors.tallyInk },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, color: colors.inkMuted },
  tabOn: { color: colors.tally, fontWeight: '700' },
});
