/**
 * Theme Context - Provides runtime theme switching between Old (Light) and New (Dark Navy)
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme mode type
export type ThemeMode = 'old' | 'new';

// Color token interface
export interface ThemeColors {
  // Base backgrounds
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceAlt: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Borders
  border: string;
  borderLight: string;
  borderActive: string;

  // Primary accent
  primary: string;
  primaryHover: string;
  primaryLight: string;

  // Secondary accent (green in new theme)
  secondary: string;
  secondaryHover: string;
  secondaryLight: string;

  // Accent greens (for new theme emphasis)
  accentGreen: string;
  accentGreenMuted: string;

  // Status colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;

  // Other
  white: string;
  black: string;
  disabled: string;
  disabledText: string;
  overlay: string;

  // Tab bar specific
  tabBarBackground: string;
  tabBarBorder: string;
  tabIconInactive: string;
  tabIconActive: string;
}

// Typography token interface
export interface ThemeTypography {
  fontFamily: {
    header: string;
    body: string;
    accent: string;
    mono: string;
  };
  fontSize: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
  };
  fontWeight: {
    regular: '400';
    medium: '500';
    semibold: '600';
    bold: '700';
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  letterSpacing: {
    tight: number;
    normal: number;
    wide: number;
  };
}

// Full theme interface
export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  isDark: boolean;
}

// Spacing scale (shared between themes)
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
} as const;

// Border radius scale (shared between themes)
export const borderRadius = {
  none: 0,
  sm: 6,
  base: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

// Shadow definitions (theme-aware)
export const shadows = {
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  none: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

// ============================================
// OLD THEME (Current Light Mode - Kalshi-inspired)
// ============================================
const oldColors: ThemeColors = {
  // Base backgrounds
  background: '#FEFEFE',
  backgroundSecondary: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F6',

  // Text colors
  textPrimary: '#1A1D1F',
  textSecondary: '#6F767E',
  textTertiary: '#9A9FA5',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E8ECEF',
  borderLight: '#F2F4F7',
  borderActive: '#6366F1',

  // Primary accent (indigo)
  primary: '#6366F1',
  primaryHover: '#4F46E5',
  primaryLight: '#EEF2FF',

  // Secondary accent (sky blue)
  secondary: '#0EA5E9',
  secondaryHover: '#0284C7',
  secondaryLight: '#F0F9FF',

  // Accent greens (not prominent in old theme)
  accentGreen: '#10B981',
  accentGreenMuted: '#6EE7B7',

  // Status colors
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',

  // Other
  white: '#FFFFFF',
  black: '#000000',
  disabled: '#D1D5DB',
  disabledText: '#9CA3AF',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Tab bar
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabIconInactive: '#9CA3AF',
  tabIconActive: '#0EA5E9',
};

// ============================================
// NEW THEME (Dark Navy - Edgy/Exciting)
// ============================================
const newColors: ThemeColors = {
  // Base backgrounds - dark navy blues
  background: '#0B1220',        // Primary dark navy
  backgroundSecondary: '#0D1526', // Slightly lighter
  surface: '#0F1B33',           // Card/surface navy
  surfaceAlt: '#111F3B',        // Alt sections

  // Text colors - bright off-whites
  textPrimary: '#F4F0E6',       // Main text - warm off-white
  textSecondary: '#D8D2C8',     // Secondary text - muted
  textTertiary: '#9A9690',      // Tertiary
  textInverse: '#0B1220',       // For light backgrounds

  // Borders - off-white with transparency
  border: 'rgba(244, 240, 230, 0.2)',      // Subtle off-white border
  borderLight: 'rgba(244, 240, 230, 0.1)', // Very subtle
  borderActive: '#A8E6A3',                  // Green for active states

  // Primary accent (keep indigo for CTAs)
  primary: '#818CF8',           // Lighter indigo for dark bg
  primaryHover: '#A5B4FC',
  primaryLight: 'rgba(129, 140, 248, 0.15)',

  // Secondary accent (green - main accent)
  secondary: '#A8E6A3',         // Faded bright light green
  secondaryHover: '#86EFAC',
  secondaryLight: 'rgba(168, 230, 163, 0.15)',

  // Accent greens (prominent in new theme)
  accentGreen: '#A8E6A3',       // Primary green accent
  accentGreenMuted: '#7FBF92',  // Muted green

  // Status colors (adjusted for dark bg)
  success: '#86EFAC',
  successLight: 'rgba(134, 239, 172, 0.15)',
  warning: '#FCD34D',
  warningLight: 'rgba(252, 211, 77, 0.15)',
  error: '#FCA5A5',
  errorLight: 'rgba(252, 165, 165, 0.15)',

  // Other
  white: '#FFFFFF',
  black: '#000000',
  disabled: 'rgba(244, 240, 230, 0.3)',
  disabledText: 'rgba(244, 240, 230, 0.4)',
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Tab bar
  tabBarBackground: '#0D1526',
  tabBarBorder: 'rgba(244, 240, 230, 0.1)',
  tabIconInactive: 'rgba(244, 240, 230, 0.4)',
  tabIconActive: '#A8E6A3',
};

// Typography (shared structure, font families differ)
const baseTypography: Omit<ThemeTypography, 'fontFamily'> = {
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
};

const oldTypography: ThemeTypography = {
  ...baseTypography,
  fontFamily: {
    header: 'NothingYouCouldDo_400Regular',
    body: 'System',
    accent: 'System',
    mono: 'Courier',
  },
};

const newTypography: ThemeTypography = {
  ...baseTypography,
  fontFamily: {
    header: 'NothingYouCouldDo_400Regular',
    body: 'JuliusSansOne_400Regular',
    accent: 'Aboreto_400Regular',
    mono: 'Courier',
  },
};

// Build complete theme objects
const oldTheme: Theme = {
  mode: 'old',
  colors: oldColors,
  typography: oldTypography,
  spacing,
  borderRadius,
  shadows,
  isDark: false,
};

const newTheme: Theme = {
  mode: 'new',
  colors: newColors,
  typography: newTypography,
  spacing,
  borderRadius,
  shadows,
  isDark: true,
};

// ============================================
// CONTEXT
// ============================================
interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  isNewTheme: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = '@whale_pod_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
  initialMode?: ThemeMode;
}

export function ThemeProvider({ children, initialMode = 'old' }: ThemeProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(initialMode);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'old' || saved === 'new') {
          setThemeModeState(saved);
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      }
    };
    loadTheme();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode = themeMode === 'old' ? 'new' : 'old';
    setThemeMode(newMode);
  }, [themeMode, setThemeMode]);

  const theme = themeMode === 'new' ? newTheme : oldTheme;

  const value: ThemeContextValue = {
    theme,
    themeMode,
    toggleTheme,
    setThemeMode,
    isNewTheme: themeMode === 'new',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook for just theme object (convenience)
export function useThemeColors(): ThemeColors {
  return useTheme().theme.colors;
}

export function useThemeTypography(): ThemeTypography {
  return useTheme().theme.typography;
}

// Export theme objects for direct access if needed
export { oldTheme, newTheme };
