import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radius } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Script } from '../../types';
import { useScripts } from './useScripts';
import { createScript } from '../../db/repositories/scripts';
import { estimateDurationMs, formatDuration } from '../../lib/estimateDuration';
import { formatRelative } from '../../lib/formatRelative';
import { getTeleprompterPrefs } from '../../store/prefs';
import { importTextFile, pasteText } from '../../lib/importText';
import { Toast } from '../../components/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Library'>;

const FOLDERS = ['All', 'Reels', 'Client work', 'Personal'];
const CUE_TAG_RE = /\[[^\]]*\]/g;

function preview(body: string): string {
  return body.replace(CUE_TAG_RE, '').replace(/\s+/g, ' ').trim();
}

function ScriptCard({ script, onOpen }: { script: Script; onOpen: () => void }) {
  const wpm = script.wpmOverride ?? getTeleprompterPrefs().defaultWpm;
  const dur = formatDuration(estimateDurationMs(script.wordCount, wpm));
  return (
    <Pressable
      onPress={onOpen}
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

function EmptyState({
  onNew,
  onImport,
  onPaste,
}: {
  onNew: () => void;
  onImport: () => void;
  onPaste: () => void;
}) {
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
        <View style={styles.btnSecondaryRow}>
          <Pressable
            style={styles.btnSecondary}
            onPress={onImport}
            accessibilityRole="button"
            accessibilityLabel="Import a text file"
          >
            <Text style={styles.btnSecondaryText}>Import .txt</Text>
          </Pressable>
          <Pressable
            style={styles.btnSecondary}
            onPress={onPaste}
            accessibilityRole="button"
            accessibilityLabel="Paste from clipboard"
          >
            <Text style={styles.btnSecondaryText}>Paste</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [query] = useState('');
  const { scripts, refresh } = useScripts(query);

  // Refresh when returning from the Editor so edits/new scripts show up.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const [noticeVisible, setNoticeVisible] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  const showNotice = useCallback((msg: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNoticeMsg(msg);
    setNoticeVisible(true);
    noticeTimer.current = setTimeout(() => setNoticeVisible(false), 2800);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    []
  );

  const handleNew = async () => {
    const s = await createScript({ title: 'Untitled script', body: '' });
    nav.navigate('Editor', { scriptId: s.id });
  };

  const handleImport = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await importTextFile();
      if (res.ok) {
        const s = await createScript({ title: res.title, body: res.body });
        nav.navigate('Editor', { scriptId: s.id });
      } else if (res.reason === 'too-large') {
        showNotice('That file is too large (max 64 KB).');
      } else if (res.reason === 'error') {
        showNotice("Couldn't read that file.");
      }
      // 'canceled' → stay silent
    } finally {
      busyRef.current = false;
    }
  }, [nav, showNotice]);

  const handlePaste = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await pasteText();
      if (res.ok) {
        const s = await createScript({ title: res.title, body: res.body });
        nav.navigate('Editor', { scriptId: s.id });
      } else if (res.reason === 'empty') {
        showNotice('Clipboard is empty.');
      } else if (res.reason === 'too-large') {
        showNotice('That text is too large (max 64 KB).');
      } else {
        showNotice("Couldn't read the clipboard.");
      }
    } finally {
      busyRef.current = false;
    }
  }, [nav, showNotice]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Text style={styles.wordmark}>
          Prima<Text style={{ color: colors.tally }}>Prompter</Text>
        </Text>
        <View style={styles.appbarActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={handleImport}
            accessibilityRole="button"
            accessibilityLabel="Import a text file"
          >
            <Text style={styles.iconGlyph}>⤓</Text>
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={handlePaste}
            accessibilityRole="button"
            accessibilityLabel="Paste from clipboard"
          >
            <Text style={styles.iconGlyph}>⧉</Text>
          </Pressable>
          <View style={styles.iconBtn}>
            <Text style={styles.iconGlyph}>⌕</Text>
          </View>
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
        <EmptyState onNew={handleNew} onImport={handleImport} onPaste={handlePaste} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {scripts.map((s) => (
            <ScriptCard
              key={s.id}
              script={s}
              onOpen={() => nav.navigate('Editor', { scriptId: s.id })}
            />
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
        <Pressable style={styles.tab} onPress={() => nav.navigate('Settings')}>
          <Text style={styles.tabText}>Settings</Text>
        </Pressable>
      </View>

      <Toast visible={noticeVisible} message={noticeMsg} />
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
  appbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  emptyBody: { fontSize: 13, lineHeight: 20, color: colors.inkMuted, textAlign: 'center' },
  btnRow: { marginTop: 20, width: '100%' },
  btnPrimary: {
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.tally,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: colors.tallyInk },
  btnSecondaryRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btnSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.ink },
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
