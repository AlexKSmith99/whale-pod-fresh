import React from 'react';
import { View } from 'react-native';
import ApplyScaffold from '../components/ApplyScaffold';
import InputPill from '../components/InputPill';
import TealButton from '../components/TealButton';
import { StepProps } from '../types';

export default function NameStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  const valid = data.firstName.trim().length > 0 && data.lastName.trim().length > 0;
  return (
    <ApplyScaffold title="What's your name?" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <InputPill
        label="First Name"
        value={data.firstName}
        onChangeText={t => update({ firstName: t })}
        autoCapitalize="words"
        returnKeyType="next"
      />
      <InputPill
        label="Last Name"
        value={data.lastName}
        onChangeText={t => update({ lastName: t })}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={() => valid && onNext()}
      />
      <View style={{ marginTop: 8 }}>
        <TealButton label="Next" onPress={onNext} disabled={!valid} />
      </View>
    </ApplyScaffold>
  );
}
