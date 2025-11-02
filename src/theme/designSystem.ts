// Modern Design System - Kalshi-inspired Light Mode
// Clean, minimal, professional aesthetic

export const colors = {
  // Base colors - clean whites and grays
  white: '#FFFFFF',
  background: '#FAFBFC',
  backgroundSecondary: '#F5F7FA',

  // Text colors - high contrast for readability
  textPrimary: '#1A1D1F',
  textSecondary: '#6F767E',
  textTertiary: '#9A9FA5',

  // Border colors - subtle
  border: '#E8ECEF',
  borderLight: '#F2F4F7',

  // Accent colors - modern purple/blue
  primary: '#6366F1',      // Indigo - main CTA color
  primaryHover: '#4F46E5',
  primaryLight: '#EEF2FF',

  secondary: '#0EA5E9',    // Sky blue - secondary actions
  secondaryHover: '#0284C7',
  secondaryLight: '#F0F9FF',

  // Status colors
  success: '#10B981',
  successLight: '#D1FAE5',

  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  error: '#EF4444',
  errorLight: '#FEE2E2',

  // Disabled state
  disabled: '#D1D5DB',
  disabledText: '#9CA3AF',
};

export const typography = {
  // Font families
  fontFamily: {
    primary: 'System',
    mono: 'Courier',
  },

  // Font sizes
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
  },

  // Font weights
  fontWeight: {
    regular: '400' as '400',
    medium: '500' as '500',
    semibold: '600' as '600',
    bold: '700' as '700',
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const borderRadius = {
  sm: 6,
  base: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
};

export const shadows = {
  // Subtle shadows for cards
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },

  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

// Common style patterns
export const commonStyles = {
  // Flexbox shortcuts
  flexCenter: {
    justifyContent: 'center' as 'center',
    alignItems: 'center' as 'center',
  },

  flexBetween: {
    justifyContent: 'space-between' as 'space-between',
    alignItems: 'center' as 'center',
  },

  // Container patterns
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.base,
  },

  // Input base style
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
};

export const animations = {
  // Standard timing
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
};
