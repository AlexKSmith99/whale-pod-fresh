import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import KeyboardAwareScreen from '../../../components/ui/KeyboardAwareScreen';
import { APPLY } from '../applyTheme';

interface Props {
  title?: string;
  onBack?: () => void;
  stepIndex?: number; // 1-based
  stepCount?: number;
  children: ReactNode;
  /** Disable the keyboard-aware scroll wrapper (for pickers / camera). */
  scroll?: boolean;
}

/** Shared chrome for every apply step: back chevron + "X of N" pill + big title. */
export default function ApplyScaffold({ title, onBack, stepIndex, stepCount, children, scroll = true }: Props) {
  const header = (
    <>
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity style={styles.circleBtn} onPress={onBack} accessibilityLabel="Go back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={APPLY.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.circleBtn} />
        )}
        {stepIndex && stepCount ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{stepIndex} of {stepCount}</Text>
          </View>
        ) : null}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {scroll ? (
        <KeyboardAwareScreen mode="scroll" style={styles.flex} contentContainerStyle={styles.content}>
          {header}
          {children}
        </KeyboardAwareScreen>
      ) : (
        <View style={[styles.flex, styles.content]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APPLY.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APPLY.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    backgroundColor: APPLY.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  pillText: { color: APPLY.text, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 34, fontWeight: '800', color: APPLY.text, letterSpacing: -0.5, marginBottom: 28 },
});
