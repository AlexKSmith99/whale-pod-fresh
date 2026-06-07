import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { editorial } from '../theme/designSystem';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.wordmarkWrap}>
        <Text style={styles.title}>whale pod</Text>
        <View style={styles.underline} />
      </View>
      <Text style={styles.subtitle}>Welcome{user?.name ? `, ${user.name}` : ''}</Text>
      <Text style={styles.text}>Your pod feed will go here</Text>
      <TouchableOpacity style={styles.button} onPress={signOut} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: editorial.bg },
  wordmarkWrap: { alignItems: 'center', marginBottom: 24 },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 36,
    color: editorial.ink,
    letterSpacing: -0.8,
  },
  underline: {
    height: 2,
    width: 64,
    backgroundColor: editorial.carolina,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 16,
    color: editorial.ink,
    marginBottom: 8,
  },
  text: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: editorial.muted,
    marginBottom: 32,
  },
  button: {
    backgroundColor: editorial.ink,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 9999,
  },
  buttonText: {
    fontFamily: 'InterTight_600SemiBold',
    color: editorial.surface,
    fontSize: 15,
  },
});
