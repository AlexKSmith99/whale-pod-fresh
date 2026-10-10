import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APPLY } from './applyTheme';
import type { LegalDoc } from '../LegalScreen';

const LOGO = require('../../../assets/whale-mark.png');

interface Props {
  onApply: () => void;
  onLogin: () => void;
  onOpenLegal: (doc: LegalDoc) => void;
}

export default function OpeningScreen({ onApply, onLogin, onOpenLegal }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.wordmark}>whale pod</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primary} onPress={onApply} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.primaryLabel}>Apply for Membership</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={onLogin} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.secondaryLabel}>Log in</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing, you agree to the{' '}
          <Text style={styles.link} onPress={() => onOpenLegal('terms')}>Terms</Text>
          {' '}and{' '}
          <Text style={styles.link} onPress={() => onOpenLegal('privacy')}>Privacy Policy</Text>.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APPLY.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 14 },
  logo: { width: 64, height: 64, tintColor: '#fff' },
  wordmark: { fontSize: 52, fontWeight: '700', color: '#fff', letterSpacing: -1 },
  footer: { paddingHorizontal: 20, paddingBottom: 16 },
  primary: { height: 62, borderRadius: 31, backgroundColor: APPLY.teal, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { color: '#fff', fontSize: 19, fontWeight: '700' },
  secondary: { height: 62, borderRadius: 31, backgroundColor: APPLY.surface, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  secondaryLabel: { color: APPLY.teal, fontSize: 19, fontWeight: '700' },
  legal: { color: APPLY.textMuted, fontSize: 14, textAlign: 'center', marginTop: 22, lineHeight: 20, paddingHorizontal: 16 },
  link: { color: APPLY.textSecondary, textDecorationLine: 'underline' },
});
