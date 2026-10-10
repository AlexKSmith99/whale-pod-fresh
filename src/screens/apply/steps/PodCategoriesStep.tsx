import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ApplyScaffold from '../components/ApplyScaffold';
import BubbleSelect from '../components/BubbleSelect';
import TealButton from '../components/TealButton';
import { APPLY } from '../applyTheme';
import { POD_CATEGORIES } from '../../../constants/pursuitTypes';
import { StepProps } from '../types';

export default function PodCategoriesStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  const toggle = (v: string) =>
    update({ podCategories: data.podCategories.includes(v) ? data.podCategories.filter(x => x !== v) : [...data.podCategories, v] });

  return (
    <ApplyScaffold title="Select the Pod Categories you're interested in" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <Text style={styles.hint}>Choose as many as you like.</Text>
      <BubbleSelect options={POD_CATEGORIES} selected={data.podCategories} onToggle={toggle} />
      <View style={{ marginTop: 28 }}>
        <TealButton label="Next" onPress={onNext} disabled={data.podCategories.length === 0} />
      </View>
    </ApplyScaffold>
  );
}

const styles = StyleSheet.create({
  hint: { color: APPLY.textSecondary, fontSize: 16, marginBottom: 20 },
});
