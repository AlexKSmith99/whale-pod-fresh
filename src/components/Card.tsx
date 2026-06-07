import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme/designSystem';

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
  // Editorial card: white surface, radius 14, hairline border.
  base: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Soft card shadow — the only place a shadow belongs in light mode.
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  flat: {},

  outlined: {},
});