/**
 * AppButton - Themed button component with variants and haptic feedback
 */
import React, { ReactNode, useCallback } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { HapticManager } from '../../services/hapticManager';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonProps {
  children: ReactNode;
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Full width button */
  fullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Left icon component */
  leftIcon?: ReactNode;
  /** Right icon component */
  rightIcon?: ReactNode;
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Enable haptic feedback (default: true) */
  haptic?: boolean;
  /** Additional container style */
  style?: ViewStyle;
  /** Additional text style */
  textStyle?: TextStyle;
}

export default function AppButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  onPress,
  onLongPress,
  haptic = true,
  style,
  textStyle,
}: AppButtonProps) {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius, typography } = theme;

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (haptic) {
      if (variant === 'danger') {
        HapticManager.heavyTap();
      } else {
        HapticManager.buttonTap();
      }
    }
    onPress?.();
  }, [disabled, loading, haptic, variant, onPress]);

  const handleLongPress = useCallback(() => {
    if (disabled || loading) return;
    if (haptic) {
      HapticManager.longPressActivated();
    }
    onLongPress?.();
  }, [disabled, loading, haptic, onLongPress]);

  // Size styles
  const sizeStyles: Record<ButtonSize, { paddingV: number; paddingH: number; fontSize: number; minHeight: number }> = {
    sm: {
      paddingV: spacing.sm,
      paddingH: spacing.base,
      fontSize: typography.fontSize.sm,
      minHeight: 36,
    },
    md: {
      paddingV: spacing.md,
      paddingH: spacing.lg,
      fontSize: typography.fontSize.base,
      minHeight: 44,
    },
    lg: {
      paddingV: spacing.base,
      paddingH: spacing.xl,
      fontSize: typography.fontSize.lg,
      minHeight: 52,
    },
  };

  // Get variant styles
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    const isDisabled = disabled || loading;

    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.disabled : colors.primary,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.textInverse,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.disabled : colors.secondary,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.textInverse,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.primary,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: isDisabled ? colors.disabled : colors.border,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.textPrimary,
          },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: isDisabled ? colors.disabled : colors.error,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.white,
          },
        };
      default:
        return {
          container: {},
          text: {},
        };
    }
  };

  const { paddingV, paddingH, fontSize, minHeight } = sizeStyles[size];
  const variantStyles = getVariantStyles();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: paddingV,
    paddingHorizontal: paddingH,
    minHeight,
    borderRadius: borderRadius.lg,
    ...(fullWidth && { width: '100%' }),
    ...variantStyles.container,
    ...style,
  };

  const labelStyle: TextStyle = {
    fontSize,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    ...variantStyles.text,
    ...textStyle,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={containerStyle}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.text.color}
          style={{ marginRight: typeof children === 'string' ? spacing.sm : 0 }}
        />
      ) : leftIcon ? (
        <View style={{ marginRight: spacing.sm }}>{leftIcon}</View>
      ) : null}

      {typeof children === 'string' ? (
        <Text style={labelStyle}>{children}</Text>
      ) : (
        children
      )}

      {rightIcon && !loading && (
        <View style={{ marginLeft: spacing.sm }}>{rightIcon}</View>
      )}
    </TouchableOpacity>
  );
}

// Convenience variants
export const PrimaryButton: React.FC<Omit<AppButtonProps, 'variant'>> = (props) => (
  <AppButton variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<AppButtonProps, 'variant'>> = (props) => (
  <AppButton variant="secondary" {...props} />
);

export const GhostButton: React.FC<Omit<AppButtonProps, 'variant'>> = (props) => (
  <AppButton variant="ghost" {...props} />
);

export const OutlineButton: React.FC<Omit<AppButtonProps, 'variant'>> = (props) => (
  <AppButton variant="outline" {...props} />
);

export const DangerButton: React.FC<Omit<AppButtonProps, 'variant'>> = (props) => (
  <AppButton variant="danger" {...props} />
);
