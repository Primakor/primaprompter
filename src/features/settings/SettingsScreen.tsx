import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radius } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { CaptureSettings } from '../../types';
import { formatBytes, getFreeDiskBytes } from '../../lib/storage';
import { getCaptureSettings, getDiagnosticsOptIn, setDiagnosticsOptIn } from '../../store/prefs';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const SOURCE_URL = 'https://github.com/primakor/primaprompter';
const APP_VERSION = '1.0.0 (1)';

// TODO(native-batch): back with real used-bytes from the takes repo + volume stats.
const USED_BYTES_PLACEHOLDER = 2_400_000_000;

function codecLabel(codec: CaptureSettings['codec']): string {
  return codec === 'hevc' ? 'HEVC' : 'H.264';
}

function captureSummary(s: CaptureSettings): string {
  return `${s.resolution} · ${s.fps} · ${codecLabel(s.codec)}`;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  label,
  subtitle,
  value,
  valueMono,
  onPress,
  showChevron,
  divider,
  right,
  accessibilityLabel,
}: {
  label: string;
  subtitle?: string;
  value?: string;
  valueMono?: boolean;
  onPress?: () => void;
  showChevron?: boolean;
  divider?: boolean;
  right?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const content = (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={[styles.rowValue, valueMono && styles.rowValueMono]}>{value}</Text>
      ) : null}
      {right}
      {showChevron ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );

  if (!onPress) {
    return content;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.rowPressed}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {content}
    </Pressable>
  );
}

function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={12}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}
    >
      <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
    </Pressable>
  );
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [capture, setCapture] = useState<CaptureSettings | null>(null);
  const [diagnosticsOn, setDiagnosticsOn] = useState(false);

  useEffect(() => {
    let alive = true;
    setCapture(getCaptureSettings());
    setDiagnosticsOn(getDiagnosticsOptIn());
    (async () => {
      const free = await getFreeDiskBytes();
      if (alive) setFreeBytes(free);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onToggleDiagnostics = useCallback((next: boolean) => {
    setDiagnosticsOptIn(next);
    setDiagnosticsOn(next);
  }, []);

  const openSource = useCallback(() => {
    // TODO(native-batch): confirm canOpenURL / in-app browser policy.
    Linking.openURL(SOURCE_URL).catch(() => {});
  }, []);

  const storageSubtitle =
    freeBytes === null
      ? 'Calculating…'
      : `${formatBytes(USED_BYTES_PLACEHOLDER)} used · ${formatBytes(freeBytes)} free`;

  const captureSubtitle = capture ? captureSummary(capture) : '—';

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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Group title="Storage">
          <Row
            label="Manage takes"
            subtitle={storageSubtitle}
            onPress={() => nav.navigate('Gallery')}
            showChevron
            divider
            accessibilityLabel={`Manage takes. ${storageSubtitle}`}
          />
          <Row
            label="Default capture"
            subtitle={captureSubtitle}
            onPress={() => nav.navigate('Record')}
            showChevron
            accessibilityLabel={`Default capture. ${captureSubtitle}`}
          />
        </Group>

        <View style={styles.privacy}>
          <View style={styles.shield}>
            <Text style={styles.shieldGlyph}>⛊</Text>
          </View>
          <Text style={styles.privacyText}>
            On-device only. No account, no cloud, no analytics — your footage never leaves
            this phone.
          </Text>
        </View>

        <Group title="Diagnostics">
          <Row
            label="Share diagnostics"
            subtitle="Off — nothing is collected. Turn on to keep a local log you can send if something breaks."
            right={
              <Toggle
                value={diagnosticsOn}
                onValueChange={onToggleDiagnostics}
                accessibilityLabel="Share diagnostics"
              />
            }
          />
        </Group>

        <Group title="About">
          <Row
            label="Source code"
            subtitle="github · Apache-2.0"
            onPress={openSource}
            showChevron
            divider
            accessibilityLabel="Source code on GitHub, Apache 2.0 licensed"
          />
          <Row label="Version" value={APP_VERSION} valueMono />
        </Group>

        <Text style={styles.footer}>PrimaPrompter</Text>
      </ScrollView>

      <View style={[styles.tabbar, { paddingBottom: insets.bottom || 10 }]}>
        <Pressable
          style={styles.tab}
          onPress={() => nav.navigate('Library')}
          accessibilityRole="button"
          accessibilityLabel="Library tab"
        >
          <Text style={styles.tabText}>Library</Text>
        </Pressable>
        <View style={styles.tab} accessibilityRole="button" accessibilityLabel="Settings tab, selected">
          <Text style={[styles.tabText, styles.tabOn]}>Settings</Text>
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
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 12,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 34, fontWeight: '300', color: colors.ink, marginTop: -4 },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.ink,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  group: { marginBottom: 22 },
  groupTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.paperCard,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  rowSubtitle: { fontSize: 12, lineHeight: 17, color: colors.inkMuted, marginTop: 3 },
  rowValue: { fontSize: 15, color: colors.inkMuted },
  rowValueMono: { fontFamily: fonts.mono, fontSize: 13 },
  chevron: { fontSize: 24, color: colors.inkMuted, opacity: 0.6, marginLeft: -4 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 14,
    marginBottom: 22,
  },
  shield: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(37,178,104,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldGlyph: { fontSize: 20, color: colors.go },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.inkMuted },
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: colors.tally, alignItems: 'flex-end' },
  toggleTrackOff: { backgroundColor: colors.line, alignItems: 'flex-start' },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.paperCard,
  },
  toggleKnobOn: { backgroundColor: colors.tallyInk },
  toggleKnobOff: { backgroundColor: colors.paperCard },
  footer: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.inkMuted,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 4,
  },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
    paddingTop: 10,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, color: colors.inkMuted },
  tabOn: { color: colors.tally, fontWeight: '700' },
});
