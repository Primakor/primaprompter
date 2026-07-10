import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import { getScript, updateScript } from '../../db/repositories/scripts';
import { countWords, estimateDurationMs, formatDuration } from '../../lib/estimateDuration';
import { getTeleprompterPrefs } from '../../store/prefs';
import { pasteText } from '../../lib/importText';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Editor'>;
type Rt = RouteProp<RootStackParamList, 'Editor'>;

export function EditorScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const scriptId = route.params?.scriptId;

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!scriptId) {
        setLoading(false);
        return;
      }
      const s = await getScript(scriptId);
      if (alive && s) {
        setTitle(s.title);
        setBody(s.body);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [scriptId]);

  const persist = useCallback(
    (t: string, b: string) => {
      if (scriptId) updateScript(scriptId, { title: t.trim() || 'Untitled script', body: b });
    },
    [scriptId]
  );

  const scheduleSave = useCallback(
    (t: string, b: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(t, b), 500);
    },
    [persist]
  );

  const onChangeTitle = (t: string) => {
    setTitle(t);
    scheduleSave(t, body);
  };
  const onChangeBody = (b: string) => {
    setBody(b);
    scheduleSave(title, b);
  };

  const flushAndBack = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    persist(title, body);
    nav.goBack();
  };

  const insertCue = (tag: string) => {
    const before = body.slice(0, selection.start);
    const after = body.slice(selection.end);
    const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
    const snippet = `${needsSpaceBefore ? ' ' : ''}${tag} `;
    const next = before + snippet + after;
    setBody(next);
    scheduleSave(title, next);
  };

  const handlePaste = async () => {
    const res = await pasteText();
    if (!res.ok) return; // empty / too-large / error → keep minimal, no-op
    const next =
      body.length === 0
        ? res.body
        : `${body}${body.endsWith('\n') ? '' : '\n\n'}${res.body}`;
    setBody(next);
    scheduleSave(title, next);
  };

  const words = countWords(body);
  const wpm = getTeleprompterPrefs().defaultWpm;
  const dur = formatDuration(estimateDurationMs(words, wpm));

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.tally} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.appbar, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={flushAndBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <TextInput
          value={title}
          onChangeText={onChangeTitle}
          placeholder="Untitled script"
          placeholderTextColor={colors.inkMuted}
          style={styles.title}
          numberOfLines={1}
          accessibilityLabel="Script title"
        />
        <Pressable onPress={flushAndBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Done">
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.bodyWrap} keyboardShouldPersistTaps="handled">
        <TextInput
          value={body}
          onChangeText={onChangeBody}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder="Write or paste your script. Use cue tags like [pause] or [look left] — they show while you read but don't count toward time."
          placeholderTextColor={colors.inkMuted}
          style={styles.body}
          multiline
          textAlignVertical="top"
          autoFocus={!body}
          accessibilityLabel="Script body"
        />
      </ScrollView>

      <View style={[styles.toolbar, { paddingBottom: insets.bottom || 12 }]}>
        <Pressable style={styles.cueBtn} onPress={() => insertCue('[pause]')} accessibilityRole="button" accessibilityLabel="Insert pause cue">
          <Text style={styles.cueBtnText}>＋ cue</Text>
        </Pressable>
        <Pressable style={styles.pasteBtn} onPress={handlePaste} accessibilityRole="button" accessibilityLabel="Paste from clipboard">
          <Text style={styles.pasteBtnText}>Paste</Text>
        </Pressable>
        <Text style={styles.stat} numberOfLines={1}>
          {words} words · <Text style={styles.statAccent}>≈ {dur}</Text>
        </Text>
        <View style={styles.spacer} />
        <Pressable
          style={styles.primary}
          onPress={() => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            persist(title, body);
            if (scriptId) nav.navigate('Record', { scriptId });
          }}
          accessibilityRole="button"
          accessibilityLabel="Preview in prompter"
        >
          <Text style={styles.primaryText}>▶ Prompter</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  center: { alignItems: 'center', justifyContent: 'center' },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  back: { fontSize: 34, fontWeight: '300', color: colors.ink, marginTop: -6, width: 22 },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.ink },
  done: { fontSize: 15, fontWeight: '700', color: colors.tally },
  bodyWrap: { flex: 1, paddingHorizontal: 18 },
  body: {
    fontSize: 17,
    lineHeight: 27,
    color: colors.ink,
    paddingTop: 4,
    paddingBottom: 40,
    minHeight: 240,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paperCard,
    paddingHorizontal: 16,
    paddingTop: 11,
  },
  cueBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: 'rgba(57,183,214,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cueBtnText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '600', color: '#0e5c70' },
  pasteBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteBtnText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  stat: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkMuted, flexShrink: 1 },
  statAccent: { color: colors.tally },
  spacer: { flex: 1 },
  primary: {
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: colors.tally,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 13, fontWeight: '700', color: colors.tallyInk },
});
