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
        {/* The editorial wordmark: lowercase Playfair over a 2px Carolina
            underline bar, matching the feed header. */}
        <View>
          <Text style={styles.wordmark}>whale pod</Text>
          <View style={styles.wordmarkRule} />
        </View>
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
  // Ink, not white — the page is cream now.
  logo: { width: 56, height: 56, tintColor: APPLY.text },
  wordmark: { fontSize: 46, fontFamily: 'PlayfairDisplay_700Bold', color: APPLY.text, letterSpacing: -1 },
  wordmarkRule: { height: 2, backgroundColor: APPLY.teal, marginTop: 4, borderRadius: 1 },
  footer: { paddingHorizontal: 20, paddingBottom: 16 },
  // Primary CTA is an ink-filled pill with white text. Carolina is the discreet
  // accent in this palette and is never used as a large filled button.
  primary: { height: 58, borderRadius: 9999, backgroundColor: APPLY.text, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { color: '#FFFFFF', fontSize: 17, fontFamily: 'InterTight_600SemiBold', letterSpacing: 0.2 },
  // Secondary is transparent with a hairline border, not a filled surface.
  secondary: {
    height: 58,
    borderRadius: 9999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: APPLY.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryLabel: { color: APPLY.text, fontSize: 17, fontFamily: 'InterTight_600SemiBold', letterSpacing: 0.2 },
  legal: { color: APPLY.textMuted, fontSize: 13, textAlign: 'center', marginTop: 22, lineHeight: 19, paddingHorizontal: 16, fontFamily: 'InterTight_600SemiBold' },
  link: { color: APPLY.tealPressed, textDecorationLine: 'underline' },
});
