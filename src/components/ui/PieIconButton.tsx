import React from 'react';
import { TouchableOpacity, View, ViewStyle, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;          // outer circle size
  iconSize?: number;      // icon size inside
  variant?: 'glass' | 'solid' | 'lime';
  active?: boolean;       // toggles between filled / outlined state
  style?: ViewStyle;
  iconColor?: string;
}

/**
 * Pie-style circular icon button.
 *   glass = dark translucent (back chevron, X close, "..." menu)
 *   solid = surfaceAlt fill (search, filter)
 *   lime  = accent fill, black icon (primary action)
 */
export default function PieIconButton({
  icon, onPress, size = 44, iconSize, variant = 'solid', active, style, iconColor,
}: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  // On the Carolina-blue accent fill (light mode) the icon is white;
  // dark mode keeps black-on-lime.
  const fgOnAccent = isNewTheme ? '#000000' : '#FFFFFF';

  let bg = colors.surfaceAlt;
  let fg = colors.textPrimary;
  if (variant === 'glass') {
    bg = isNewTheme ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.92)';
    fg = isNewTheme ? '#FFFFFF' : colors.textPrimary;
  } else if (variant === 'lime') {
    bg = colors.accentGreen;
    fg = fgOnAccent;
  }
  if (active) {
    bg = colors.accentGreen;
    fg = fgOnAccent;
  }
  if (iconColor) fg = iconColor;

  const innerIconSize = iconSize ?? Math.round(size * 0.45);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={innerIconSize} color={fg} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
