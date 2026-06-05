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

  // Light mode: flat cream paper — matches onboarding aesthetic for an
  // editorial, magazine-like surface.
  return (
    <View style={[styles.container, { backgroundColor: '#FAF9F6' }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
