/**
 * AppText - Themed text component with semantic variants
 * Automatically applies correct typography based on theme
 */
import React, { ReactNode } from 'react';
import { Text, TextStyle, StyleSheet, TextProps } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type TextVariant =
  | 'h1'       // Largest header
  | 'h2'       // Section header
  | 'h3'       // Subsection header
  | 'h4'       // Small header
  | 'body'     // Default body text
  | 'bodyLarge'
  | 'bodySmall'
  | 'caption'  // Small caption/helper text
  | 'label'    // Form labels
  | 'accent'   // Accent font (Aboreto in new theme)
  | 'button'   // Button text
  | 'mono';    // Monospace (code)

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'accent'
  | 'accentGreen'
  | 'success'
  | 'warning'
  | 'error'
  | 'disabled';

interface AppTextProps extends Omit<TextProps, 'style'> {
  children: ReactNode;
  /** Typography variant */
  variant?: TextVariant;
  /** Color preset */
  color?: TextColor;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Bold weight override */
  bold?: boolean;
  /** Semibold weight override */
  semibold?: boolean;
  /** Medium weight override */
  medium?: boolean;
  /** Uppercase text */
  uppercase?: boolean;
  /** Additional style */
  style?: TextStyle;
}

export default function AppText({
  children,
  variant = 'body',
  color = 'primary',
  align = 'left',
  bold,
  semibold,
  medium,
  uppercase,
  style,
  ...rest
}: AppTextProps) {
  const { theme, isNewTheme } = useTheme();
  const { colors, typography } = theme;

  // Get font family based on variant
  const getFontFamily = (): string | undefined => {
    switch (variant) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        return typography.fontFamily.header;
      case 'accent':
        return typography.fontFamily.accent;
      case 'mono':
        return typography.fontFamily.mono;
      case 'body':
      case 'bodyLarge':
      case 'bodySmall':
      case 'caption':
      case 'label':
      case 'button':
      default:
        // Apply body font in both themes (Inter for light, KleeOne/JuliusSansOne for dark)
        return typography.fontFamily.body !== 'System' ? typography.fontFamily.body : undefined;
    }
  };

  // Get font size based on variant
  const getFontSize = (): number => {
    switch (variant) {
      case 'h1':
        return typography.fontSize['4xl'];
      case 'h2':
        return typography.fontSize['3xl'];
      case 'h3':
        return typography.fontSize['2xl'];
      case 'h4':
        return typography.fontSize.xl;
      case 'bodyLarge':
        return typography.fontSize.lg;
      case 'body':
      case 'button':
        return typography.fontSize.base;
      case 'bodySmall':
      case 'label':
        return typography.fontSize.sm;
      case 'caption':
        return typography.fontSize.xs;
      case 'accent':
        return typography.fontSize.sm;
      case 'mono':
        return typography.fontSize.sm;
      default:
        return typography.fontSize.base;
    }
  };

  // Get font weight based on variant and overrides
  const getFontWeight = (): TextStyle['fontWeight'] => {
    if (bold) return typography.fontWeight.bold;
    if (semibold) return typography.fontWeight.semibold;
    if (medium) return typography.fontWeight.medium;

    switch (variant) {
      case 'h1':
      case 'h2':
        return typography.fontWeight.bold;
      case 'h3':
      case 'h4':
      case 'button':
        return typography.fontWeight.semibold;
      case 'label':
        return typography.fontWeight.medium;
      default:
        return typography.fontWeight.regular;
    }
  };

  // Get line height based on variant
  const getLineHeight = (): number => {
    const fontSize = getFontSize();
    switch (variant) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        return fontSize * typography.lineHeight.tight;
      case 'caption':
        return fontSize * typography.lineHeight.relaxed;
      default:
        return fontSize * typography.lineHeight.normal;
    }
  };

  // Get color based on preset
  const getColor = (): string => {
    switch (color) {
      case 'primary':
        return colors.textPrimary;
      case 'secondary':
        return colors.textSecondary;
      case 'tertiary':
        return colors.textTertiary;
      case 'inverse':
        return colors.textInverse;
      case 'accent':
        return colors.primary;
      case 'accentGreen':
        return colors.accentGreen;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      case 'disabled':
        return colors.disabledText;
      default:
        return colors.textPrimary;
    }
  };

  // Get letter spacing
  const getLetterSpacing = (): number => {
    switch (variant) {
      case 'accent':
        return typography.letterSpacing.wide;
      case 'h1':
      case 'h2':
        return typography.letterSpacing.tight;
      default:
        return typography.letterSpacing.normal;
    }
  };

  const textStyle: TextStyle = {
    fontFamily: getFontFamily(),
    fontSize: getFontSize(),
    fontWeight: getFontWeight(),
    lineHeight: getLineHeight(),
    color: getColor(),
    textAlign: align,
    letterSpacing: getLetterSpacing(),
    textTransform: uppercase ? 'uppercase' : 'none',
  };

  return (
    <Text style={[textStyle, style]} {...rest}>
      {children}
    </Text>
  );
}

// Convenience components
export const H1: React.FC<Omit<AppTextProps, 'variant'>> = (props) => (
  <AppText variant="h1" {...props} />
);

export const H2: React.FC<Omit<AppTextProps, 'variant'>> = (props) => (
  <AppText variant="h2" {...props} />
);

export const H3: React.FC<Omit<AppTextProps, 'variant'>> = (props) => (
  <AppText variant="h3" {...props} />
);

export const H4: React.FC<Omit<AppTextProps, 'variant'>> = (props) => (
  <AppText variant="h4" {...props} />
);

export const BodyText: React.FC<Omit<AppTextProps, 'variant'>> = (props) => (
  <AppText variant="body" {...props} />
);

export const Caption: React.FC<Omit<AppTextProps, 'variant'>> = (props) => (
  <AppText variant="caption" color="secondary" {...props} />
);

export const Label: React.FC<Omit<AppTextProps, 'variant'>> = (props) => (
  <AppText variant="label" {...props} />
);

export const AccentText: React.FC<Omit<AppTextProps, 'variant'>> = (props) => (
  <AppText variant="accent" uppercase {...props} />
);
