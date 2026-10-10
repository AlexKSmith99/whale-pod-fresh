import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ApplyScaffold from '../components/ApplyScaffold';
import BubbleSelect from '../components/BubbleSelect';
import TealButton from '../components/TealButton';
import { APPLY } from '../applyTheme';
import { POD_TYPES } from '../../../constants/pursuitTypes';
import { StepProps } from '../types';

export default function PodTypesStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  const toggle = (v: string) =>
    update({ podTypes: data.podTypes.includes(v) ? data.podTypes.filter(x => x !== v) : [...data.podTypes, v] });

  return (
    <ApplyScaffold title="Select the Pod Types you're interested in" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <Text style={styles.hint}>Choose as many as you like.</Text>
      <BubbleSelect options={POD_TYPES} selected={data.podTypes} onToggle={toggle} />
      <View style={{ marginTop: 28 }}>
        <TealButton label="Next" onPress={onNext} disabled={data.podTypes.length === 0} />
      </View>
    </ApplyScaffold>
  );
}

const styles = StyleSheet.create({
  hint: { color: APPLY.textSecondary, fontSize: 16, marginBottom: 20 },
});
