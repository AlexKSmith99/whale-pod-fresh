import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApplyScaffold from '../components/ApplyScaffold';
import TealButton from '../components/TealButton';
import { APPLY } from '../applyTheme';
import { StepProps } from '../types';

const OPTIONS: Array<'Man' | 'Woman'> = ['Man', 'Woman'];

export default function WhoStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  return (
    <ApplyScaffold title="Who are you?" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <View style={styles.row}>
        {OPTIONS.map(opt => {
          const selected = data.gender === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => update({ gender: opt })}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </View>
              <Text style={styles.cardLabel}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ marginTop: 28 }}>
        <TealButton label="Next" onPress={onNext} disabled={!data.gender} />
      </View>
    </ApplyScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  card: {
    flex: 1,
    height: 150,
    borderRadius: 18,
    backgroundColor: APPLY.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 18,
    justifyContent: 'space-between',
  },
  cardSelected: { borderColor: APPLY.teal },
  radio: {
    alignSelf: 'flex-end',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#6B6B70',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: APPLY.teal, borderColor: APPLY.teal },
  cardLabel: { color: APPLY.text, fontSize: 22, fontWeight: '700' },
});
