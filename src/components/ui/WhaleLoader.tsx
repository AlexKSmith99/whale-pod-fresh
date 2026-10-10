import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { editorial } from '../../theme/designSystem';

// Tintable, transparent whale mark derived from the app logo (assets/whale-mark.png).
const WHALE = require('../../../assets/whale-mark.png');
const ASPECT = 171 / 355; // height / width of the trimmed mark

interface Props {
  /** Whale width in px (height derives from the logo aspect ratio). Default 52. */
  size?: number;
  /** Override the tint. Defaults to ink in light theme, lime in dark. */
  color?: string;
  style?: ViewStyle;
}

/**
 * The whale-pod loading indicator: the brand whale bobbing on the swell.
 * Drop-in replacement for <ActivityIndicator/> for page/section loading states.
 */
export default function WhaleLoader({ size = 52, color, style }: Props) {
  const { theme, isNewTheme } = useTheme();
  const tint = color ?? (isNewTheme ? theme.colors.accentGreen : editorial.ink);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  // Endpoints match (0 and 1 map to the same pose) so the loop seams are invisible.
  const translateY = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -size * 0.16, 0] });
  const rotate = t.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['-5deg', '2deg', '5deg', '2deg', '-5deg'],
  });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] });

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <Animated.Image
        source={WHALE}
        resizeMode="contain"
        style={{
          width: size,
          height: size * ASPECT,
          tintColor: tint,
          transform: [{ translateY }, { rotate }, { scale }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
