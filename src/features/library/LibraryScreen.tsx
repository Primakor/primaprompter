import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme/tokens';

type Script = {
  id: string;
  title: string;
  preview: string;
  words: number;
  dur: string;
  edited: string;
};

const FOLDERS = ['All', 'Reels', 'Client work', 'Personal'];

// Static sample data — the op-sqlite repository wiring lands in Phase 3.
const SCRIPTS: Script[] = [
  {
    id: '1',
    title: 'Product launch — take 2',
    preview:
      "Hey everyone — today I want to show you the thing we've been building for the last six months…",
    words: 182,
    dur: '1:24',
    edited: '2d ago',
  },
  {
    id: '2',
    title: 'Skincare routine · morning',
    preview:
      "First thing, always — a splash of cold water. No cleanser yet. Here's why that matters…",
    words: 96,
    dur: '0:44',
    edited: '5d ago',
  },
  {
    id: '3',
    title: 'Weekly update — episode 14',
    preview:
      'Big week. Three things I promised you last time, and where each one landed…',
    words: 241,
    dur: '1:51',
    edited: '1w ago',
  },
];

export function LibraryScreen() {
  const insets = useSafeAreaInsets();

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

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {SCRIPTS.map((s) => (
          <Pressable
            key={s.id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Script: ${s.title}, ${s.words} words, about ${s.dur}`}
          >
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardPreview} numberOfLines={2}>
              {s.preview}
            </Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>{s.words} words</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={[styles.metaText, styles.metaAccent]}>≈ {s.dur}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>edited {s.edited}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: 84 + insets.bottom }]}
        accessibilityRole="button"
        accessibilityLabel="New script"
      >
        <Text style={styles.fabPlus}>＋</Text>
        <Text style={styles.fabText}>New script</Text>
      </Pressable>

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
