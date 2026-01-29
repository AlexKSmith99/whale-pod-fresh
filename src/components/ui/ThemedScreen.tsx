/**
 * ThemedScreen - Wrapper component that applies theme-aware background and texture
 * Use this to wrap screen content for consistent theming across the app
 */
import React, { ReactNode } from 'react';
import { View, StyleSheet, StatusBar, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import GrainTexture from './GrainTexture';

interface ThemedScreenProps {
  children: ReactNode;
  /** Additional style for the container */
  style?: ViewStyle;
  /** Show grain texture (default: true for new theme) */
  showTexture?: boolean;
  /** Custom background color override */
  backgroundColor?: string;
}

export default function ThemedScreen({
  children,
  style,
  showTexture = true,
  backgroundColor,
}: ThemedScreenProps) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  const bgColor = backgroundColor || colors.background;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, style]}>
      <StatusBar
        barStyle={isNewTheme ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />
      {/* Grain texture overlay for new theme */}
      {isNewTheme && showTexture && <GrainTexture opacity={0.06} />}
      {children}
    </View>
  );
}

/**
 * Hook to get common themed styles for use within screens
 */
export function useThemedStyles() {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  return {
    colors,
    isNewTheme,
    // Common text styles
    textPrimary: { color: colors.textPrimary },
    textSecondary: { color: colors.textSecondary },
    textTertiary: { color: colors.textTertiary },
    // Common background styles
    surfaceStyle: { backgroundColor: colors.surface },
    surfaceAltStyle: { backgroundColor: colors.surfaceAlt },
    // Common border styles
    borderStyle: { borderColor: colors.border },
    // Font families for new theme
    bodyFont: isNewTheme ? 'JuliusSansOne_400Regular' : undefined,
    headerFont: 'NothingYouCouldDo_400Regular',
    accentFont: isNewTheme ? 'Aboreto_400Regular' : undefined,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
