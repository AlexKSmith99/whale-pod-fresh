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

  // Light mode: warm parchment gradient - rustic, earthy
  return (
    <LinearGradient
      colors={[
        '#FAF9F6',   // raw parchment (top)
        '#F2EFEA',   // weathered linen (upper third)
        '#EDE9E1',   // warm sandstone (center)
        '#FAF9F6',   // raw parchment (bottom)
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
