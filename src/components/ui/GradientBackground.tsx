import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';

interface GradientBackgroundProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function GradientBackground({ children, style }: GradientBackgroundProps) {
  const { theme, isNewTheme } = useTheme();

  if (isNewTheme) {
    // Dark mode: plain background, no gradient
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
        {children}
      </View>
    );
  }

  // Light mode: soft, low-contrast gradient
  // warm ivory → gentle blush tint → cool jade haze → warm ivory
  return (
    <LinearGradient
      colors={[
        '#FDFCFA',   // warm off-white/ivory (top)
        '#F5F0F2',   // gentle blush-blue tint (upper third)
        '#F0F5F3',   // cool green/jade haze (center)
        '#FDFCFA',   // warm off-white/ivory (bottom)
      ]}
      locations={[0, 0.3, 0.55, 1]}
      style={[styles.container, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
