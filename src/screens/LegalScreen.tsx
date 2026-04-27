import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { TERMS_OF_SERVICE, PRIVACY_POLICY, SUPPORT } from '../constants/legalContent';

export type LegalDoc = 'terms' | 'privacy' | 'support';

interface Props {
  doc: LegalDoc;
  onBack: () => void;
}

const docMap: Record<LegalDoc, { title: string; body: string }> = {
  terms:   { title: 'Terms of Service', body: TERMS_OF_SERVICE },
  privacy: { title: 'Privacy Policy',   body: PRIVACY_POLICY },
  support: { title: 'Support',          body: SUPPORT },
};

// Tiny markdown-ish renderer. Splits by lines and styles based on the leading marker.
// Supports: # / ## / ### headings, > callouts, - bullets, blank-line paragraph breaks.
function renderBody(body: string, colors: any) {
  const lines = body.split('\n');
  const blocks: React.ReactElement[] = [];
  let key = 0;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line === '') {
      blocks.push(<View key={key++} style={{ height: 10 }} />);
    } else if (line.startsWith('### ')) {
      blocks.push(
        <Text key={key++} style={[styles.h3, { color: colors.textPrimary }]}>
          {line.slice(4)}
        </Text>
      );
    } else if (line.startsWith('## ')) {
      blocks.push(
        <Text key={key++} style={[styles.h2, { color: colors.textPrimary }]}>
          {line.slice(3)}
        </Text>
      );
    } else if (line.startsWith('# ')) {
      blocks.push(
        <Text key={key++} style={[styles.h1, { color: colors.textPrimary }]}>
          {line.slice(2)}
        </Text>
      );
    } else if (line.startsWith('> ')) {
      blocks.push(
        <View
          key={key++}
          style={[
            styles.callout,
            { backgroundColor: colors.surfaceAlt, borderLeftColor: colors.accentGreen },
          ]}
        >
          <Text style={[styles.calloutText, { color: colors.textPrimary }]}>
            {line.slice(2)}
          </Text>
        </View>
      );
    } else if (line.startsWith('- ')) {
      blocks.push(
        <View key={key++} style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: colors.accentGreen }]}>•</Text>
          <Text style={[styles.body, { color: colors.textPrimary, flex: 1 }]}>
            {line.slice(2)}
          </Text>
        </View>
      );
    } else {
      blocks.push(
        <Text key={key++} style={[styles.body, { color: colors.textPrimary }]}>
          {line}
        </Text>
      );
    }
  }
  return blocks;
}

export default function LegalScreen({ doc, onBack }: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const { title, body } = docMap[doc];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'Sora_400Regular' : 'PlayfairDisplay_700Bold' }]}>
          {title}
        </Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderBody(body, colors)}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scroll: { padding: 20 },
  h1: { fontSize: 26, fontWeight: '700', marginTop: 4, marginBottom: 12, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  h3: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 4 },
  bulletDot: { fontSize: 18, lineHeight: 22, marginRight: 8, width: 12 },
  callout: {
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  calloutText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
