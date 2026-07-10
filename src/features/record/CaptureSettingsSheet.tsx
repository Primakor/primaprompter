import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme/tokens';
import type {
  CaptureSettings,
  Resolution,
  Fps,
  VideoCodec,
  StabilizationMode,
  CountdownSeconds,
} from '../../types';

export interface CaptureSettingsSheetProps {
  settings: CaptureSettings;
  onChange: (s: CaptureSettings) => void;
  onClose: () => void;
  /**
   * Capability matrix keyed by option token (e.g. '4k', '60', 'hevc', 'hdr').
   * Derived from the real device query (see lib/cameraCapabilities); unspecified
   * keys are treated as supported.
   */
  supported?: Partial<Record<string, boolean>>;
  /**
   * Whether HDR video is available for the current resolution + fps selection.
   * Gates the HDR row (see below).
   */
  hdrAvailable?: boolean;
}

/** One option in a Segmented control. */
interface SegOption<T> {
  value: T;
  label: string;
  /** Capability key looked up in `supported`. */
  key?: string;
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: ReadonlyArray<SegOption<T>>;
  value: T;
  onSelect: (v: T) => void;
  supported?: Partial<Record<string, boolean>>;
  subtitle?: string;
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onSelect,
  supported,
  subtitle,
}: SegmentedProps<T>) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <View
        style={styles.segment}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map((opt) => {
          const isOn = opt.value === value;
          const disabled =
            opt.key != null && supported != null && supported[opt.key] === false;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => !disabled && onSelect(opt.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${opt.label}`}
              accessibilityState={{ selected: isOn, disabled }}
              style={[
                styles.segItem,
                isOn && styles.segItemOn,
                disabled && styles.segItemDisabled,
              ]}
            >
              <Text
                style={[
                  styles.segText,
                  isOn && styles.segTextOn,
                  disabled && styles.segTextDisabled,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface ToggleRowProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  /** Trailing text shown when disabled (e.g. "unavailable"). */
  disabledNote?: string;
}

function ToggleRow({
  label,
  subtitle,
  value,
  onToggle,
  disabled,
  disabledNote,
}: ToggleRowProps) {
  return (
    <View style={[styles.row, styles.toggleRow, disabled && styles.rowDisabled]}>
      <View style={styles.rowHead}>
        <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, disabled && styles.rowSubDisabled]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {disabled && disabledNote ? (
        <Text style={styles.unavailable}>{disabledNote}</Text>
      ) : (
        <Pressable
          onPress={() => !disabled && onToggle(!value)}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityState={{ checked: value, disabled }}
          style={[styles.track, value && styles.trackOn]}
        >
          <View style={[styles.thumb, value && styles.thumbOn]} />
        </Pressable>
      )}
    </View>
  );
}

const RESOLUTIONS: ReadonlyArray<SegOption<Resolution>> = [
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K', key: '4k' },
];
const FRAME_RATES: ReadonlyArray<SegOption<Fps>> = [
  { value: 24, label: '24' },
  { value: 30, label: '30' },
  { value: 60, label: '60', key: '60' },
];
const CODECS: ReadonlyArray<SegOption<VideoCodec>> = [
  { value: 'h264', label: 'H.264' },
  { value: 'hevc', label: 'HEVC', key: 'hevc' },
];
const STABILIZERS: ReadonlyArray<SegOption<StabilizationMode>> = [
  { value: 'off', label: 'Off' },
  { value: 'standard', label: 'Standard' },
  { value: 'cinematic', label: 'Cinematic', key: 'cinematic' },
];
const COUNTDOWNS: ReadonlyArray<SegOption<CountdownSeconds>> = [
  { value: 0, label: 'Off' },
  { value: 3, label: '3s' },
  { value: 10, label: '10s' },
];

export function CaptureSettingsSheet({
  settings,
  onChange,
  onClose,
  supported,
  hdrAvailable,
}: CaptureSettingsSheetProps) {
  const patch = (p: Partial<CaptureSettings>) => onChange({ ...settings, ...p });
  const resLabel = settings.resolution === '4k' ? '4K' : '1080p';

  return (
    <View style={styles.sheet}>
      <View style={styles.grabber} accessibilityElementsHidden />

      <View style={styles.header}>
        <View style={styles.headText}>
          <Text style={styles.title}>Capture</Text>
          <Text style={styles.subtitle}>
            Only what this device can actually do is offered.
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close capture settings"
          style={styles.closeBtn}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>

      <Segmented<Resolution>
        label="Resolution"
        options={RESOLUTIONS}
        value={settings.resolution}
        onSelect={(v) => patch({ resolution: v })}
        supported={supported}
      />
      <Segmented<Fps>
        label="Frame rate"
        options={FRAME_RATES}
        value={settings.fps}
        onSelect={(v) => patch({ fps: v })}
        supported={supported}
      />
      <Segmented<VideoCodec>
        label="Codec"
        options={CODECS}
        value={settings.codec}
        onSelect={(v) => patch({ codec: v })}
        supported={supported}
      />
      <Segmented<StabilizationMode>
        label="Stabilization"
        options={STABILIZERS}
        value={
          settings.stabilizationMode === 'off' ||
          settings.stabilizationMode === 'standard' ||
          settings.stabilizationMode === 'cinematic'
            ? settings.stabilizationMode
            : 'standard'
        }
        onSelect={(v) => patch({ stabilizationMode: v })}
        supported={supported}
      />
      <Segmented<CountdownSeconds>
        label="Countdown"
        options={COUNTDOWNS}
        value={settings.countdownSeconds}
        onSelect={(v) => patch({ countdownSeconds: v })}
      />

      <ToggleRow
        label="Grid"
        subtitle="Rule-of-thirds overlay in the viewfinder."
        value={settings.gridEnabled}
        onToggle={(v) => patch({ gridEnabled: v })}
      />

      <ToggleRow
        label="HDR"
        subtitle={
          hdrAvailable
            ? `High dynamic range at ${resLabel}·${settings.fps}`
            : `Not available at ${resLabel}·${settings.fps}`
        }
        value={settings.hdrEnabled}
        onToggle={(v) => patch({ hdrEnabled: v })}
        disabled={!hdrAvailable}
        disabledNote={hdrAvailable ? undefined : 'unavailable'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.stage2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.camLine,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headText: { flex: 1, paddingRight: 12 },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMutedOnDark,
    marginTop: 4,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeGlyph: { fontSize: 16, color: '#FFFFFF', fontWeight: '600' },

  row: { minHeight: 44, marginBottom: 16, justifyContent: 'center' },
  rowDisabled: { opacity: 0.55 },
  rowHead: { marginBottom: 8 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  rowLabelDisabled: { color: colors.inkMutedOnDark },
  rowSub: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkMutedOnDark, marginTop: 3 },
  rowSubDisabled: { color: colors.inkMutedOnDark },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.stage,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.camLine,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.card - 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segItemOn: { backgroundColor: colors.tally },
  segItemDisabled: { opacity: 0.4 },
  segText: { fontFamily: fonts.mono, fontSize: 13, color: '#E7E4DC' },
  segTextOn: { color: colors.tallyInk, fontWeight: '700' },
  segTextDisabled: { color: colors.inkMuted },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.stage,
    borderWidth: 1,
    borderColor: colors.camLine,
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.tally, borderColor: colors.tally },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E7E4DC',
    alignSelf: 'flex-start',
  },
  thumbOn: { backgroundColor: colors.tallyInk, alignSelf: 'flex-end' },
  unavailable: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkMutedOnDark,
    textTransform: 'lowercase',
  },
});
