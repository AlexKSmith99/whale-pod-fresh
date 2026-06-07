import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'lg' | 'md' | 'sm';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * Pie-style pill button.
 *  primary    = lime fill, black text — main CTA
 *  secondary  = transparent w/ subtle border — back-of-screen actions
 *  ghost      = no border, subtle text — text-only actions
 *  destructive= red-ish fill — leave/delete actions
 *
 * Always lowercase. Big rounded pill (radius 999). Sora SemiBold.
 */
export default function PieButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'right',
  loading,
  disabled,
  full,
  style,
  textStyle,
}: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  const heightForSize: Record<Size, number> = { lg: 56, md: 48, sm: 38 };
  const fontForSize: Record<Size, number> = { lg: 16, md: 15, sm: 13 };
  const padForSize: Record<Size, number> = { lg: 24, md: 20, sm: 16 };

  // Light mode (editorial): primary CTA is ink-filled with white text.
  // Dark mode keeps the lime-fill / black-text "pie" look.
  let bg: string = isNewTheme ? colors.accentGreen : colors.textPrimary;
  let fg: string = isNewTheme ? '#000000' : '#FFFFFF';
  let borderColor: string | undefined;
  let borderWidth = 0;

  if (variant === 'secondary') {
    bg = isNewTheme ? '#1F1F1F' : 'transparent';
    fg = colors.textPrimary;
    borderColor = colors.border;
    borderWidth = 1;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    fg = colors.textPrimary;
  } else if (variant === 'destructive') {
    bg = isNewTheme ? '#2A1414' : '#FCA5A5';
    fg = isNewTheme ? '#FCA5A5' : '#7F1D1D';
    borderColor = isNewTheme ? 'rgba(252, 165, 165, 0.25)' : 'transparent';
    borderWidth = isNewTheme ? 1 : 0;
  }

  const opacity = disabled || loading ? 0.5 : 1;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          height: heightForSize[size],
          paddingHorizontal: padForSize[size],
          backgroundColor: bg,
          borderColor,
          borderWidth,
          opacity,
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon} size={fontForSize[size] + 2} color={fg} style={{ marginRight: 8 }} />
          )}
          <Text style={[styles.label, { color: fg, fontSize: fontForSize[size], fontFamily: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' }, textStyle]}>
            {label}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon} size={fontForSize[size] + 2} color={fg} style={{ marginLeft: 8 }} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: {
    fontFamily: 'Sora_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
