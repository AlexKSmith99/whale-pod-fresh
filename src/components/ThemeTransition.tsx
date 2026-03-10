/**
 * ThemeTransition - Wave effect using stretched ovals
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet, Easing } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ThemeTransitionProps {
  isTransitioning: boolean;
  fromColor: string;
  toColor: string;
  onTransitionComplete: () => void;
}

export default function ThemeTransition({
  isTransitioning,
  fromColor,
  toColor,
  onTransitionComplete,
}: ThemeTransitionProps) {
  const translateY = useRef(new Animated.Value(-SCREEN_HEIGHT - 250)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isTransitioning) {
      setVisible(true);
      translateY.setValue(-SCREEN_HEIGHT - 250);

      Animated.timing(translateY, {
        toValue: 150,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        onTransitionComplete();
      });
    }
  }, [isTransitioning]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.waveContainer,
          { transform: [{ translateY }] },
        ]}
      >
        {/* Main solid fill */}
        <View style={[styles.solidFill, { backgroundColor: toColor }]} />

        {/* Wave layer 1 - Large swooping curves */}
        <View style={styles.waveLayer}>
          <View
            style={[
              styles.waveOval,
              {
                backgroundColor: toColor,
                width: SCREEN_WIDTH * 0.7,
                height: 100,
                left: -SCREEN_WIDTH * 0.1,
                borderRadius: 50,
              },
            ]}
          />
          <View
            style={[
              styles.waveOval,
              {
                backgroundColor: toColor,
                width: SCREEN_WIDTH * 0.6,
                height: 90,
                left: SCREEN_WIDTH * 0.45,
                top: 20,
                borderRadius: 45,
              },
            ]}
          />
        </View>

        {/* Wave layer 2 - Medium curves */}
        <View style={[styles.waveLayer, { top: SCREEN_HEIGHT + 50 }]}>
          <View
            style={[
              styles.waveOval,
              {
                backgroundColor: toColor,
                width: SCREEN_WIDTH * 0.5,
                height: 80,
                left: SCREEN_WIDTH * 0.1,
                borderRadius: 40,
                opacity: 0.9,
              },
            ]}
          />
          <View
            style={[
              styles.waveOval,
              {
                backgroundColor: toColor,
                width: SCREEN_WIDTH * 0.55,
                height: 85,
                left: SCREEN_WIDTH * 0.5,
                top: 15,
                borderRadius: 42,
                opacity: 0.9,
              },
            ]}
          />
          <View
            style={[
              styles.waveOval,
              {
                backgroundColor: toColor,
                width: SCREEN_WIDTH * 0.4,
                height: 70,
                left: -SCREEN_WIDTH * 0.1,
                top: 25,
                borderRadius: 35,
                opacity: 0.9,
              },
            ]}
          />
        </View>

        {/* Wave layer 3 - Smaller trailing waves */}
        <View style={[styles.waveLayer, { top: SCREEN_HEIGHT + 110 }]}>
          <View
            style={[
              styles.waveOval,
              {
                backgroundColor: toColor,
                width: SCREEN_WIDTH * 0.35,
                height: 60,
                left: 20,
                borderRadius: 30,
                opacity: 0.75,
              },
            ]}
          />
          <View
            style={[
              styles.waveOval,
              {
                backgroundColor: toColor,
                width: SCREEN_WIDTH * 0.4,
                height: 65,
                left: SCREEN_WIDTH * 0.35,
                top: 10,
                borderRadius: 32,
                opacity: 0.75,
              },
            ]}
          />
          <View
            style={[
              styles.waveOval,
              {
                backgroundColor: toColor,
                width: SCREEN_WIDTH * 0.3,
                height: 55,
                left: SCREEN_WIDTH * 0.7,
                top: 5,
                borderRadius: 27,
                opacity: 0.75,
              },
            ]}
          />
        </View>

        {/* Foam/spray layer */}
        <View style={[styles.waveLayer, { top: SCREEN_HEIGHT + 20 }]}>
          {Array.from({ length: 20 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.foam,
                {
                  left: (i * SCREEN_WIDTH) / 18,
                  top: Math.sin(i * 0.8) * 40 + 30,
                  width: 15 + (i % 4) * 8,
                  height: 12 + (i % 3) * 6,
                  borderRadius: 10,
                  opacity: 0.5 + (i % 3) * 0.2,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    overflow: 'hidden',
  },
  waveContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT + 250,
  },
  solidFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
  },
  waveLayer: {
    position: 'absolute',
    top: SCREEN_HEIGHT,
    left: 0,
    right: 0,
    height: 120,
  },
  waveOval: {
    position: 'absolute',
  },
  foam: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});
