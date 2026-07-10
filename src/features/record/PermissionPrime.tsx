import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme/tokens';

export interface PermissionPrimeProps {
  /** Called when the user taps the primary "Continue" button. The parent
   *  Record screen performs the actual OS permission request. */
  onContinue: () => void;
}

function PermChip({ glyph, label }: { glyph: string; label: string }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={`${label} access`}>
      <Text style={styles.chipGlyph}>{glyph}</Text>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

/**
 * PermissionPrime — a presentational dark modal card shown over the viewfinder
 * before the OS camera/microphone prompt. Purely visual: it explains the
 * on-device, no-upload promise and hands off to the parent via onContinue.
 */
export function PermissionPrime({ onContinue }: PermissionPrimeProps) {
  return (
    <View style={styles.scrim}>
      <View
        style={styles.card}
        accessibilityViewIsModal
        accessibilityLabel="Camera and microphone access"
      >
        <View style={styles.tile}>
          <Text style={styles.tileGlyph}>◉</Text>
        </View>

        <Text style={styles.title}>Camera &amp; microphone</Text>
        <Text style={styles.body}>
          PrimaPrompter records straight to your device. Nothing is uploaded — ever.
          No account, no cloud, no tracking.
        </Text>

        <View style={styles.chipRow}>
          <PermChip glyph="◉" label="Camera" />
          <PermChip glyph="🎙" label="Microphone" />
        </View>

        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Continue and allow camera and microphone"
        >
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>

        <Pressable
          onPress={() => {}}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Why does it need these permissions?"
        >
          <Text style={styles.linkText}>Why does it need these?</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(6,7,9,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.stage2,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: colors.camLine,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 18,
    alignItems: 'center',
  },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.stage,
    borderWidth: 1,
    borderColor: colors.camLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  tileGlyph: { fontSize: 34, color: colors.tally },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: '#F4F2ED',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: '#A9ABB2',
    textAlign: 'center',
    marginBottom: 20,
  },
  chipRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.camLine,
    backgroundColor: colors.stage,
  },
  chipGlyph: { fontSize: 14, color: colors.tally },
  chipText: { fontSize: 13, fontWeight: '600', color: '#DCDDE1' },
  btn: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.tally,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { opacity: 0.85 },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.tallyInk },
  link: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  linkText: { fontSize: 13, color: colors.inkMutedOnDark, textDecorationLine: 'underline' },
});
