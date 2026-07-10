import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme/tokens';

/**
 * Small bottom toast — purely presentational. Visibility, auto-dismiss and the
 * message are owned by the parent (no global state here). Renders above the
 * safe-area inset with an optional trailing action link (e.g. "Settings").
 */
export function Toast({
  message,
  visible,
  actionLabel,
  onAction,
}: {
  message: string;
  visible: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const hasAction = !!actionLabel && !!onAction;

  return (
    <View
      style={[styles.wrap, { bottom: (insets.bottom || 14) + 12 }]}
      pointerEvents="box-none"
    >
      <View
        style={styles.toast}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.msg}>{message}</Text>
        {hasAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    maxWidth: 520,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    backgroundColor: colors.stage2,
    borderWidth: 1,
    borderColor: colors.camLine,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  msg: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: colors.paper },
  action: { fontSize: 13, fontWeight: '700', color: colors.tally },
});
