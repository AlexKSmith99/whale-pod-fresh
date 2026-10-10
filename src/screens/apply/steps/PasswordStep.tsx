import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApplyScaffold from '../components/ApplyScaffold';
import InputPill from '../components/InputPill';
import TealButton from '../components/TealButton';
import { APPLY } from '../applyTheme';
import { StepProps } from '../types';

export default function PasswordStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  const [hidden, setHidden] = useState(true);
  const [hiddenConfirm, setHiddenConfirm] = useState(true);

  const pw = data.password;
  const rules = [
    { label: '8 characters', ok: pw.length >= 8 },
    { label: 'lowercase and uppercase letters', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: '1 number', ok: /[0-9]/.test(pw) },
    { label: '1 symbol as @ # $ % ^ & * .', ok: /[@#$%^&*.]/.test(pw) },
  ];

  const allRules = rules.every(r => r.ok);
  const valid = allRules && pw.length > 0 && pw === data.passwordConfirm;

  return (
    <ApplyScaffold title="Set password" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <InputPill
        label="Password"
        value={data.password}
        onChangeText={t => update({ password: t })}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        secureToggle={{ hidden, onToggle: () => setHidden(h => !h) }}
      />
      <InputPill
        label="Confirm Password"
        value={data.passwordConfirm}
        onChangeText={t => update({ passwordConfirm: t })}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        secureToggle={{ hidden: hiddenConfirm, onToggle: () => setHiddenConfirm(h => !h) }}
        onSubmitEditing={() => valid && onNext()}
      />
      <Text style={styles.rulesTitle}>Password must contain at least:</Text>
      {rules.map(rule => (
        <View key={rule.label} style={styles.ruleRow}>
          <View style={[styles.circle, rule.ok && styles.circleOn]}>
            {rule.ok ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
          <Text style={styles.ruleLabel}>{rule.label}</Text>
        </View>
      ))}
      <View style={{ marginTop: 28 }}>
        <TealButton label="Next" onPress={onNext} disabled={!valid} />
      </View>
    </ApplyScaffold>
  );
}

const styles = StyleSheet.create({
  rulesTitle: { color: APPLY.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 14 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: APPLY.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  circleOn: { backgroundColor: APPLY.teal, borderColor: APPLY.teal },
  ruleLabel: { color: APPLY.textSecondary, fontSize: 15, fontWeight: '500', flex: 1 },
});
