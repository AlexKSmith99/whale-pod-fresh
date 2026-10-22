import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ApplyScaffold from '../components/ApplyScaffold';
import TealButton from '../components/TealButton';
import { APPLY } from '../applyTheme';
import { StepProps } from '../types';

function eighteenYearsAgo(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

export default function BirthdayStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  useEffect(() => {
    if (data.birthday == null) {
      update({ birthday: eighteenYearsAgo() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = data.birthday ?? eighteenYearsAgo();

  return (
    <ApplyScaffold title="How old are you?" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <Text style={styles.label}>Date of birth</Text>
      <DateTimePicker
        value={value}
        mode="date"
        display="spinner"
        style={styles.pickerSpinner}
        themeVariant="dark"
        maximumDate={new Date()}
        onChange={(_, date) => {
          if (date) update({ birthday: date });
        }}
      />
      <View style={{ marginTop: 28 }}>
        <TealButton label="Next" onPress={onNext} disabled={!data.birthday} />
      </View>
    </ApplyScaffold>
  );
}

const styles = StyleSheet.create({
  // Span the step's content width so the date columns spread out rather than
  // sitting in a narrow block with dead space beside them.
  pickerSpinner: { width: '100%' },
  label: { color: APPLY.textSecondary, fontSize: 17, fontWeight: '600', marginBottom: 10 },
});
