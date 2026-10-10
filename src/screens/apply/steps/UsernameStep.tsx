import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ApplyScaffold from '../components/ApplyScaffold';
import InputPill from '../components/InputPill';
import TealButton from '../components/TealButton';
import { APPLY } from '../applyTheme';
import { StepProps } from '../types';
import { supabase } from '../../../config/supabase';

type Status = 'idle' | 'checking' | 'available' | 'taken';

export default function UsernameStep({ data, update, onNext, onBack, stepIndex, stepCount }: StepProps) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const value = data.username.trim();
    if (timer.current) clearTimeout(timer.current);

    if (value.length < 3) {
      setStatus('idle');
      return;
    }

    setStatus('checking');
    const myReq = ++reqId.current;
    timer.current = setTimeout(async () => {
      try {
        const { data: row, error } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', value)
          .maybeSingle();
        if (myReq !== reqId.current) return;
        if (error) {
          // Column may not exist yet — treat as available.
          setStatus('available');
          return;
        }
        setStatus(row ? 'taken' : 'available');
      } catch {
        if (myReq !== reqId.current) return;
        setStatus('available');
      }
    }, 400);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data.username]);

  const valid = status === 'available';

  return (
    <ApplyScaffold title="Choose username" onBack={onBack} stepIndex={stepIndex} stepCount={stepCount}>
      <InputPill
        label="Username"
        value={data.username}
        onChangeText={t => update({ username: t })}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        valid={valid}
        onSubmitEditing={() => valid && onNext()}
      />
      {status === 'checking' ? (
        <Text style={[styles.helper, { color: APPLY.textSecondary }]}>Checking…</Text>
      ) : status === 'available' ? (
        <Text style={[styles.helper, { color: APPLY.teal }]}>Available</Text>
      ) : status === 'taken' ? (
        <Text style={[styles.helper, { color: APPLY.danger }]}>Taken</Text>
      ) : null}
      <View style={{ marginTop: 8 }}>
        <TealButton label="Next" onPress={onNext} disabled={!valid} />
      </View>
    </ApplyScaffold>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 15, fontWeight: '600', marginTop: -12, marginBottom: 14 },
});
