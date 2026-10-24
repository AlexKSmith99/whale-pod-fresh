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

/**
 * Full-width primary CTA. Ink-filled pill with white text, disabled → flat
 * neutral fill with a muted label.
 *
 * Ink rather than the accent: in the editorial palette Carolina is the discreet
 * accent and is never used as a large filled button. The component name is
 * legacy from the old teal design — kept so the dozen step files that import it
 * don't need touching.
 */
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
    height: 58,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnOn: { backgroundColor: APPLY.text },
  btnOff: { backgroundColor: APPLY.disabledBg },
  label: { fontSize: 17, fontFamily: 'InterTight_600SemiBold', letterSpacing: 0.2 },
});
