import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, shadows } from '../theme/designSystem';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'flat' | 'outlined';
  padding?: keyof typeof spacing;
  style?: ViewStyle;
}

export default function Card({
  children,
  variant = 'elevated',
  padding = 'base',
  style,
}: CardProps) {
  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = styles.base;

    const variantStyles: Record<string, ViewStyle> = {
      elevated: styles.elevated,
      flat: styles.flat,
      outlined: styles.outlined,
    };

    const paddingValue = spacing[padding];

    return {
      ...baseStyle,
      ...variantStyles[variant],
      padding: paddingValue,
    };
  };

  return <View style={[getCardStyle(), style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
  },

  elevated: {
    ...shadows.base,
    borderWidth: 0,
  },

  flat: {
    ...shadows.none,
    borderWidth: 0,
  },

  outlined: {
    ...shadows.none,
    borderWidth: 1,
    borderColor: colors.border,
  },
});