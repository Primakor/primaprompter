import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, fonts, radius } from '../../theme/tokens';
import type { PrompterFont, TeleprompterPrefs } from '../../types';

type Props = {
  prefs: TeleprompterPrefs;
  onChange: (p: TeleprompterPrefs) => void;
  onClose: () => void;
};

// System + Lexend (real, bundled via @expo-google-fonts/lexend, loaded in App.tsx).
// OpenDyslexic isn't bundled yet — it needs its OFL .ttf — so it stays hidden until
// that asset is registered, to avoid falsely implying dyslexia support (see familyFor).
const TYPEFACES: { key: PrompterFont; label: string }[] = [
  { key: 'system', label: 'SF' },
  { key: 'lexend', label: 'Lexend' },
];

// Auto-scroll start behavior. 'Follow system' honours the OS Reduce Motion
// setting (prompter starts paused when it's on); 'Always on' is the informed
// override that always auto-starts scrolling when recording begins.
const AUTOSCROLL_MODES: {
  key: TeleprompterPrefs['autoScrollMode'];
  label: string;
}[] = [
  { key: 'system', label: 'Follow system' },
  { key: 'always', label: 'Always on' },
];

// Prompter typeface → registered font family. Lexend is the real bundled face;
// OpenDyslexic stays a placeholder (fonts.mono) and its option is hidden until the
// real .ttf is bundled. 'system' → undefined (the platform default face).
function familyFor(font: PrompterFont): string | undefined {
  switch (font) {
    case 'dyslexic':
      return fonts.mono; // placeholder — option hidden until OpenDyslexic .ttf ships
    case 'lexend':
      return fonts.lexend;
    default:
      return undefined;
  }
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

function snap(v: number, min: number, max: number, step: number): number {
  const snapped = Math.round((v - min) / step) * step + min;
  // Guard against float drift so values like 1.6 stay clean.
  const decimals = step < 1 ? 2 : 0;
  return Number(clamp(snapped, min, max).toFixed(decimals));
}

/**
 * Dark bottom sheet for tuning how the teleprompter band reads. Purely
 * presentational: every control calls onChange with a fresh prefs object; the
 * parent owns state + persistence.
 */
export function PrompterAppearanceSheet({ prefs, onChange, onClose }: Props) {
  const patch = useCallback(
    (delta: Partial<TeleprompterPrefs>) => onChange({ ...prefs, ...delta }),
    [prefs, onChange]
  );

  return (
    <View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.grabber} />

      <View style={styles.header}>
        <Text style={styles.title}>Prompter</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close prompter settings"
        >
          <Text style={styles.closeGlyph}>Done</Text>
        </Pressable>
      </View>

      <BandPreview prefs={prefs} />

      <View style={styles.block}>
        <Text style={styles.label}>Typeface</Text>
        <View style={styles.segment}>
          {TYPEFACES.map(({ key, label }) => {
            const on = prefs.fontFamily === key;
            return (
              <Pressable
                key={key}
                onPress={() => patch({ fontFamily: key })}
                style={[styles.segItem, on && styles.segItemOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Typeface ${label}`}
              >
                <Text
                  style={[
                    styles.segText,
                    { fontFamily: familyFor(key) },
                    on && styles.segTextOn,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Slider
        label="Text size"
        value={prefs.fontSize}
        min={28}
        max={56}
        step={1}
        format={(v) => `${Math.round(v)}`}
        onValue={(v) => patch({ fontSize: v })}
      />

      <Slider
        label="Line height"
        value={prefs.lineHeight}
        min={1.3}
        max={2.2}
        step={0.1}
        format={(v) => v.toFixed(1)}
        onValue={(v) => patch({ lineHeight: v })}
      />

      <Slider
        label="Band opacity"
        value={prefs.bandOpacity}
        min={0.3}
        max={0.95}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onValue={(v) => patch({ bandOpacity: v })}
      />

      <View style={styles.block}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Speed</Text>
          <Text style={styles.readout}>{prefs.defaultWpm} WPM</Text>
        </View>
        <Stepper
          value={prefs.defaultWpm}
          min={80}
          max={220}
          step={5}
          onValue={(v) => patch({ defaultWpm: v })}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Auto-scroll</Text>
        <View style={styles.segment}>
          {AUTOSCROLL_MODES.map(({ key, label }) => {
            const on = prefs.autoScrollMode === key;
            return (
              <Pressable
                key={key}
                onPress={() => patch({ autoScrollMode: key })}
                style={[styles.segItem, on && styles.segItemOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Auto-scroll ${label}`}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Toggle
        label="High contrast"
        value={prefs.highContrast}
        onValue={(v) => patch({ highContrast: v })}
      />

      <Toggle
        label="Mirror text"
        subtitle="For beam-splitter rigs"
        value={prefs.mirrorText}
        onValue={(v) => patch({ mirrorText: v })}
      />
    </View>
  );
}

function BandPreview({ prefs }: { prefs: TeleprompterPrefs }) {
  const family = familyFor(prefs.fontFamily);
  const textStyle = {
    fontFamily: family,
    fontSize: Math.min(prefs.fontSize, 34),
    lineHeight: Math.min(prefs.fontSize, 34) * prefs.lineHeight,
    transform: prefs.mirrorText ? [{ scaleX: -1 as number }] : undefined,
  };
  return (
    <View
      style={styles.preview}
      accessibilityRole="image"
      accessibilityLabel="Live preview of the reading band"
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.previewScrim,
          { backgroundColor: `rgba(8,9,11,${prefs.bandOpacity})` },
        ]}
        pointerEvents="none"
      />
      <Text
        numberOfLines={1}
        style={[
          styles.previewLine,
          styles.previewDim,
          prefs.highContrast && styles.previewDimHi,
          textStyle,
        ]}
      >
        keep your eyes on the lens
      </Text>
      <Text numberOfLines={1} style={[styles.previewLine, styles.previewLive, textStyle]}>
        and read this line aloud
      </Text>
    </View>
  );
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onValue: (v: number) => void;
};

/** Minimal track-drag slider built on a Pan gesture. */
function Slider({ label, value, min, max, step, format, onValue }: SliderProps) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const emit = useCallback(
    (x: number) => {
      if (width <= 0) return;
      const frac = clamp(x / width, 0, 1);
      onValue(snap(min + frac * (max - min), min, max, step));
    },
    [width, min, max, step, onValue]
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      runOnJS(emit)(e.x);
    })
    .onChange((e) => {
      'worklet';
      runOnJS(emit)(e.x);
    });

  const frac = max > min ? clamp((value - min) / (max - min), 0, 1) : 0;

  const step10 = () => onValue(snap(value + step, min, max, step));
  const stepDown = () => onValue(snap(value - step, min, max, step));

  return (
    <View style={styles.block}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.readout}>{format(value)}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.sliderHit}
          onLayout={onLayout}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: format(value) }}
          accessibilityActions={[
            { name: 'increment' },
            { name: 'decrement' },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') step10();
            else if (e.nativeEvent.actionName === 'decrement') stepDown();
          }}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${frac * 100}%` }]} />
            <View style={[styles.thumb, { left: `${frac * 100}%` }]} />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

type StepperProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onValue: (v: number) => void;
};

function Stepper({ value, min, max, step, onValue }: StepperProps) {
  const dec = () => onValue(clamp(value - step, min, max));
  const inc = () => onValue(clamp(value + step, min, max));
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={dec}
        disabled={value <= min}
        style={[styles.stepBtn, value <= min && styles.stepBtnOff]}
        accessibilityRole="button"
        accessibilityLabel="Decrease speed"
      >
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>
      <View style={styles.stepValueWrap}>
        <Text style={styles.stepValue}>{value} WPM</Text>
      </View>
      <Pressable
        onPress={inc}
        disabled={value >= max}
        style={[styles.stepBtn, value >= max && styles.stepBtnOff]}
        accessibilityRole="button"
        accessibilityLabel="Increase speed"
      >
        <Text style={styles.stepGlyph}>＋</Text>
      </Pressable>
    </View>
  );
}

type ToggleProps = {
  label: string;
  subtitle?: string;
  value: boolean;
  onValue: (v: boolean) => void;
};

function Toggle({ label, subtitle, value, onValue }: ToggleProps) {
  return (
    <Pressable
      onPress={() => onValue(!value)}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
    >
      <View style={styles.toggleLabels}>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.stage,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: colors.camLine,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.camLine,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 15, fontWeight: '700', color: colors.tally },

  preview: {
    height: 110,
    borderRadius: radius.card,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  previewScrim: { borderRadius: radius.card },
  previewLine: { color: '#FFFFFF' },
  previewDim: { color: 'rgba(255,255,255,0.42)' },
  previewDimHi: { color: 'rgba(255,255,255,0.62)' },
  previewLive: { color: '#FFFFFF', fontWeight: '600' },

  block: { marginBottom: 20 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: colors.inkMutedOnDark, marginTop: 2 },
  readout: { fontFamily: fonts.mono, fontSize: 13, color: colors.tally },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.stage2,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segItemOn: { backgroundColor: colors.tally },
  segText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.72)' },
  segTextOn: { color: colors.tallyInk },

  sliderHit: { minHeight: 44, justifyContent: 'center' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.stage2,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.tally,
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    backgroundColor: colors.tally,
    borderWidth: 3,
    borderColor: colors.stage,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: { opacity: 0.4 },
  stepGlyph: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: -2 },
  stepValueWrap: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.stage2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: 8,
  },
  toggleLabels: { flex: 1, paddingRight: 12 },
  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: colors.tally, borderColor: colors.tally },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchKnobOn: { alignSelf: 'flex-end' },
});
