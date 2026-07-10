import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/tokens';

/** Temporary screen stand-in while the real feature is being built. */
export function Placeholder({ title, dark = false }: { title: string; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const fg = dark ? '#F4F5F7' : colors.ink;
  const bg = dark ? colors.stage : colors.paper;
  return (
    <View style={[st.root, { paddingTop: insets.top, backgroundColor: bg }]}>
      <View style={st.bar}>
        <Pressable
          onPress={() => nav.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={[st.back, { color: fg }]}>‹</Text>
        </Pressable>
        <Text style={[st.title, { color: fg }]}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={st.center}>
        <Text style={[st.soon, { color: dark ? 'rgba(244,245,247,0.5)' : colors.inkMuted }]}>
          Coming together…
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  back: { fontSize: 34, fontWeight: '300', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  soon: { fontSize: 14 },
});
