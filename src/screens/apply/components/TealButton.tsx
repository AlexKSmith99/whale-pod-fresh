import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { APPLY } from '../applyTheme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/** Full-width teal pill CTA. Disabled → dark grey fill + muted label (per reference). */
export default function TealButton({ label, onPress, disabled, loading, style }: Props) {
  const isOff = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.btn, isOff ? styles.btnOff : styles.btnOn, style]}
      onPress={onPress}
      disabled={isOff}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={isOff ? APPLY.textMuted : '#fff'} />
      ) : (
        <Text style={[styles.label, { color: isOff ? APPLY.textMuted : '#fff' }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnOn: { backgroundColor: APPLY.teal },
  btnOff: { backgroundColor: APPLY.disabledBg },
  label: { fontSize: 18, fontWeight: '700' },
});
