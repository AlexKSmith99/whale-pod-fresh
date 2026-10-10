import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { APPLY } from './applyTheme';
import TealButton from './components/TealButton';

export default function ApplicationSentScreen({ onNext }: { onNext: () => void }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Ionicons name="checkmark-circle-outline" size={92} color={APPLY.teal} style={{ marginBottom: 24 }} />
        <Text style={styles.title}>Application sent</Text>
        <Text style={styles.body}>Check your inbox: we've sent an email to verify your address.</Text>
        <Text style={styles.body}>Confirm it to receive updates on your application status.</Text>
      </View>
      <View style={styles.footer}>
        <TealButton label="Next" onPress={onNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APPLY.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 34, fontWeight: '800', color: APPLY.text, letterSpacing: -0.5, marginBottom: 20, textAlign: 'center' },
  body: { fontSize: 18, color: '#8A8A8E', textAlign: 'center', lineHeight: 26, marginBottom: 16, fontWeight: '500' },
  footer: { paddingHorizontal: 20, paddingBottom: 20 },
});
