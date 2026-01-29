/**
 * AppScreen - Base screen container with themed background and optional texture overlay
 * Provides consistent screen wrapper across the entire app
 */
import React, { ReactNode, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ViewStyle,
  Platform,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface AppScreenProps {
  children: ReactNode;
  /** Use SafeAreaView (default: true) */
  safeArea?: boolean;
  /** Additional style for the container */
  style?: ViewStyle;
  /** Show texture overlay (only in new theme, default: true) */
  showTexture?: boolean;
  /** Padding preset */
  padding?: 'none' | 'sm' | 'base' | 'lg';
  /** Override background color */
  backgroundColor?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Procedural noise texture generator
 * Creates a subtle grain overlay using pseudo-random patterns
 */
const NoiseOverlay: React.FC<{ opacity: number }> = ({ opacity }) => {
  // Generate noise dots procedurally
  const noiseDots = useMemo(() => {
    const dots: Array<{ x: number; y: number; size: number; opacity: number }> = [];
    const density = 0.0003; // dots per pixel
    const totalDots = Math.floor(SCREEN_WIDTH * SCREEN_HEIGHT * density);

    for (let i = 0; i < totalDots; i++) {
      dots.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2,
        opacity: 0.03 + Math.random() * 0.08,
      });
    }
    return dots;
  }, []);

  // Generate scratch lines
  const scratches = useMemo(() => {
    const lines: Array<{ x: number; y: number; rotation: number; length: number; opacity: number }> = [];
    const numScratches = 15;

    for (let i = 0; i < numScratches; i++) {
      lines.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        rotation: -30 + Math.random() * 60, // -30 to 30 degrees
        length: 50 + Math.random() * 150,
        opacity: 0.02 + Math.random() * 0.04,
      });
    }
    return lines;
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {/* Grain dots */}
      {noiseDots.map((dot, index) => (
        <View
          key={`dot-${index}`}
          style={{
            position: 'absolute',
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: `rgba(244, 240, 230, ${dot.opacity})`,
          }}
        />
      ))}
      {/* Scratch lines */}
      {scratches.map((scratch, index) => (
        <View
          key={`scratch-${index}`}
          style={{
            position: 'absolute',
            left: `${scratch.x}%`,
            top: `${scratch.y}%`,
            width: scratch.length,
            height: 1,
            backgroundColor: `rgba(244, 240, 230, ${scratch.opacity})`,
            transform: [{ rotate: `${scratch.rotation}deg` }],
          }}
        />
      ))}
    </View>
  );
};

/**
 * Simplified CSS-based grain texture (more performant)
 */
const GrainOverlay: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  if (!isDark) return null;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          // Subtle radial gradient effect for depth
          backgroundColor: 'transparent',
        },
      ]}
      pointerEvents="none"
    >
      {/* Vignette effect */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'transparent',
            borderWidth: 80,
            borderColor: 'rgba(0, 0, 0, 0.15)',
            borderRadius: 0,
          },
        ]}
      />
      {/* Central subtle highlight */}
      <View
        style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          right: '10%',
          height: '30%',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
          borderRadius: 999,
        }}
      />
    </View>
  );
};

export default function AppScreen({
  children,
  safeArea = true,
  style,
  showTexture = true,
  padding = 'none',
  backgroundColor,
}: AppScreenProps) {
  const { theme, isNewTheme } = useTheme();
  const { colors, spacing } = theme;

  const bgColor = backgroundColor || colors.background;

  const paddingValue = {
    none: 0,
    sm: spacing.sm,
    base: spacing.base,
    lg: spacing.lg,
  }[padding];

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: bgColor,
    padding: paddingValue,
    ...style,
  };

  const Container = safeArea ? SafeAreaView : View;

  return (
    <>
      <StatusBar
        barStyle={isNewTheme ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />
      <Container style={containerStyle}>
        {/* Texture overlay for new theme */}
        {showTexture && isNewTheme && <GrainOverlay isDark={true} />}
        {children}
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  // Reserved for future static styles
});
