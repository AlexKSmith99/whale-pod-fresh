import React from 'react';
import { View } from 'react-native';
import ApplyScaffold from '../components/ApplyScaffold';
import InputPill from '../components/InputPill';
import TealButton from '../components/TealButton';
import { StepProps } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  const emailValid = EMAIL_RE.test(data.email.trim());
  const confirmValid = EMAIL_RE.test(data.emailConfirm.trim()) && data.emailConfirm === data.email;
  const valid = emailValid && confirmValid;
  return (
    <ApplyScaffold title="What's your email?" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <InputPill
        label="Email"
        value={data.email}
        onChangeText={t => update({ email: t })}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        valid={emailValid}
      />
      <InputPill
        label="Confirm email"
        value={data.emailConfirm}
        onChangeText={t => update({ emailConfirm: t })}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        valid={confirmValid}
        onSubmitEditing={() => valid && onNext()}
      />
      <View style={{ marginTop: 8 }}>
        <TealButton label="Next" onPress={onNext} disabled={!valid} />
      </View>
    </ApplyScaffold>
  );
}
