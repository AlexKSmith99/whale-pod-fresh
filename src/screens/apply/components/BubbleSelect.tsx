import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { APPLY } from '../applyTheme';

interface Props {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}

/** Wrapping pill/bubble multi-select (unlimited). Selected = teal fill. */
export default function BubbleSelect({ options, selected, onToggle }: Props) {
  return (
    <View style={styles.wrap}>
      {options.map(opt => {
        const on = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.bubble, on && styles.bubbleOn]}
            onPress={() => onToggle(opt)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bubble: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: APPLY.surface,
    borderWidth: 1,
    borderColor: APPLY.border,
  },
  bubbleOn: { backgroundColor: APPLY.teal, borderColor: APPLY.teal },
  label: { color: APPLY.text, fontSize: 16, fontWeight: '500' },
  labelOn: { color: '#fff', fontWeight: '700' },
});
