import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from '@expo-google-fonts/nothing-you-could-do';
import { QueryClientProvider } from '@tanstack/react-query';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { appFonts } from './src/constants/fonts';
import { queryClient } from './src/config/queryClient';
import ThemeTransitionWrapper from './src/components/ThemeTransitionWrapper';
import { AppAlertHost } from './src/components/ui/AppAlert';
import { CelebrationHost } from './src/components/ui/CelebrationOverlay';
import AppContent from './src/AppContent';
import './src/utils/enableTextSelection';

// NOTE: closeCreateButton/closeCreateText are not referenced anywhere (pre-existing
// dead styles, dead before this refactor too). Left in place per the pure-extraction
// constraint; safe to delete in a follow-up cleanup.
const styles = StyleSheet.create({
  closeCreateButton: {
    position: 'absolute',
    top: 55,
    right: 20,
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  closeCreateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default function App() {
  // Load all fonts globally
  const [fontsLoaded] = useFonts(appFonts);

  // Show loading while fonts load
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B1220' }}>
        <ActivityIndicator size="large" color="#A8E6A3" />
      </View>
    );
  }

  return (
    <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
            <ThemeTransitionWrapper />
            <AppAlertHost />
            <CelebrationHost />
            <StatusBar style="auto" />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </KeyboardProvider>
  );
}
