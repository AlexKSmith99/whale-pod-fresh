import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APPLY } from '../applyTheme';

interface Props extends TextInputProps {
  label?: string;
  /** Show a teal check on the right (e.g. valid email / available username). */
  valid?: boolean;
  /** Password-style eye toggle. When provided, renders the eye and controls secureTextEntry. */
  secureToggle?: { hidden: boolean; onToggle: () => void };
}

/** Dark rounded input pill with a grey label above, matching the reference. */
export default function InputPill({ label, valid, secureToggle, style, ...inputProps }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.pill}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={APPLY.placeholder}
          secureTextEntry={secureToggle ? secureToggle.hidden : inputProps.secureTextEntry}
          {...inputProps}
        />
        {secureToggle ? (
          <TouchableOpacity onPress={secureToggle.onToggle} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name={secureToggle.hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={APPLY.textSecondary} />
          </TouchableOpacity>
        ) : null}
        {valid && !secureToggle ? (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },
  label: { fontSize: 17, fontWeight: '600', color: APPLY.textSecondary, marginBottom: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APPLY.surface,
    borderRadius: 26,
    paddingHorizontal: 22,
    minHeight: 58,
  },
  input: { flex: 1, fontSize: 18, color: APPLY.text, paddingVertical: 16 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: APPLY.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
