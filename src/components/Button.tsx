import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.base,
      ...(fullWidth ? styles.fullWidth : {}),
    };

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      sm: styles.sizeSm,
      md: styles.sizeMd,
      lg: styles.sizeLg,
    };

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: styles.primary,
      secondary: styles.secondary,
      ghost: styles.ghost,
      outline: styles.outline,
    };

    const combinedStyle: ViewStyle = {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(disabled ? styles.disabled : {}),
    };

    return combinedStyle;
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = styles.text;

    // Size text styles
    const sizeTextStyles: Record<string, TextStyle> = {
      sm: styles.textSm,
      md: styles.textMd,
      lg: styles.textLg,
    };

    // Variant text styles
    const variantTextStyles: Record<string, TextStyle> = {
      primary: styles.textPrimary,
      secondary: styles.textSecondary,
      ghost: styles.textGhost,
      outline: styles.textOutline,
    };

    const combinedTextStyle: TextStyle = {
      ...baseTextStyle,
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
      ...(disabled ? styles.textDisabled : {}),
    };

    return combinedTextStyle;
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.primary}
          size="small"
        />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Base styles
  base: {
    borderRadius: borderRadius.base,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  fullWidth: {
    width: '100%',
  },

  // Size styles
  sizeSm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },

  sizeMd: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 44,
  },

  sizeLg: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    minHeight: 52,
  },

  // Variant styles
  primary: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },

  secondary: {
    backgroundColor: colors.secondary,
    ...shadows.sm,
  },

  ghost: {
    backgroundColor: 'transparent',
  },

  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },

  disabled: {
    backgroundColor: colors.disabled,
    ...shadows.none,
  },

  // Text styles
  text: {
    fontWeight: typography.fontWeight.semibold,
  },

  textSm: {
    fontSize: typography.fontSize.sm,
  },

  textMd: {
    fontSize: typography.fontSize.base,
  },

  textLg: {
    fontSize: typography.fontSize.lg,
  },

  textPrimary: {
    color: colors.white,
  },

  textSecondary: {
    color: colors.white,
  },

  textGhost: {
    color: colors.primary,
  },

  textOutline: {
    color: colors.textPrimary,
  },

  textDisabled: {
    color: colors.disabledText,
  },
});