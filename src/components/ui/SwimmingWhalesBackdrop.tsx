import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import SwimmingWhale from './SwimmingWhale';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  variant?: number;
}

// Cartoon ocean wave — mix of pointy and round peaks, filled blue
function CartoonWave({ y, amplitude, speed, delay, fillColor, fillColorLight, strokeColor, capColor, segments = 6, pointy = false }: {
  y: number; amplitude: number; speed: number; delay: number;
  fillColor: string; fillColorLight: string; strokeColor: string;
  capColor?: string; segments?: number; pointy?: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateX, {
          toValue: -SCREEN_WIDTH * 0.2,
          duration: speed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH * 0.1,
          duration: speed * 0.7,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: speed * 0.5,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    drift.start();
    return () => drift.stop();
  }, []);

  const waveWidth = SCREEN_WIDTH * 2.5;
  const segW = waveWidth / segments;
  const svgHeight = y + amplitude + 50;
  const gradId = `waveGrad_${y}_${amplitude}_${pointy ? 'p' : 'r'}`;

  let wavePath = `M -${segW} ${y}`;
  let foamPath = '';

  for (let i = 0; i < segments + 2; i++) {
    const x = -segW + i * segW;

    if (pointy) {
      // Pointy peaks — sharp triangular crests
      const peakX = x + segW * 0.45;
      const peakY = y - amplitude;
      const valleyX = x + segW;
      const valleyY = y + 2; // slight dip below baseline
      // Sharp rise to peak
      wavePath += ` L ${peakX} ${peakY}`;
      // Smooth curve down from peak
      wavePath += ` Q ${peakX + segW * 0.2} ${peakY + amplitude * 0.4}, ${valleyX} ${valleyY}`;

      if (capColor) {
        // Pointy foam — curling at the sharp tip
        foamPath += `M ${peakX - 8} ${peakY + 5} Q ${peakX - 2} ${peakY - 5}, ${peakX + 2} ${peakY - 2} `;
        foamPath += `Q ${peakX + 6} ${peakY - 4}, ${peakX + 10} ${peakY + 4} `;
        // Extra curl
        foamPath += `M ${peakX - 3} ${peakY + 2} Q ${peakX} ${peakY - 4}, ${peakX + 5} ${peakY + 1} `;
      }
    } else {
      // Round cartoon bumps
      const cp1x = x + segW * 0.25;
      const cp1y = y - amplitude * 1.2;
      const cp2x = x + segW * 0.75;
      const cp2y = y - amplitude * 1.2;
      const endx = x + segW;
      const endy = y;
      wavePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endx} ${endy}`;

      if (capColor) {
        const crestX = x + segW * 0.5;
        const crestY = y - amplitude;
        foamPath += `M ${crestX - 10} ${crestY + 4} Q ${crestX - 4} ${crestY - 4}, ${crestX} ${crestY - 2} `;
        foamPath += `Q ${crestX + 4} ${crestY - 4}, ${crestX + 10} ${crestY + 4} `;
        foamPath += `M ${crestX - 6} ${crestY + 2} Q ${crestX} ${crestY - 3}, ${crestX + 6} ${crestY + 2} `;
      }
    }
  }

  // Close fill area
  wavePath += ` L ${waveWidth + segW} ${svgHeight} L -${segW} ${svgHeight} Z`;

  return (
    <Animated.View style={{
      position: 'absolute',
      left: -segW,
      top: 0,
      transform: [{ translateX }],
    }}>
      <Svg width={waveWidth + segW * 2} height={svgHeight}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fillColor} stopOpacity="1" />
            <Stop offset="1" stopColor={fillColorLight} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>
        <Path
          d={wavePath}
          fill={`url(#${gradId})`}
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {capColor && (
          <Path
            d={foamPath}
            fill="none"
            stroke={capColor}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
      </Svg>
    </Animated.View>
  );
}

interface WhaleConfig {
  size: number;
  swimDuration: number;
  initialDelay: number;
  direction: 'ltr' | 'rtl';
  opacity: number;
  verticalOffset: number;
  bobHeight: number;
  layer: 'back' | 'front';
}

const LAYOUTS: WhaleConfig[][] = [
  // 1 solo whale
  [{ size: 1.0, swimDuration: 10000, initialDelay: 500, direction: 'rtl', opacity: 0.9, verticalOffset: 10, bobHeight: 16, layer: 'front' }],
  // 2 whales — one behind, one in front
  [
    { size: 0.85, swimDuration: 10500, initialDelay: 0, direction: 'rtl', opacity: 0.7, verticalOffset: 6, bobHeight: 14, layer: 'back' },
    { size: 0.9, swimDuration: 11000, initialDelay: 2500, direction: 'rtl', opacity: 0.9, verticalOffset: 18, bobHeight: 16, layer: 'front' },
  ],
  // 2 whales — both in front, spaced apart
  [
    { size: 0.95, swimDuration: 10000, initialDelay: 0, direction: 'rtl', opacity: 0.9, verticalOffset: 4, bobHeight: 18, layer: 'front' },
    { size: 0.8, swimDuration: 11500, initialDelay: 4500, direction: 'rtl', opacity: 0.85, verticalOffset: 22, bobHeight: 14, layer: 'front' },
  ],
  // 2 whales — different directions
  [
    { size: 1.0, swimDuration: 9500, initialDelay: 1000, direction: 'rtl', opacity: 0.9, verticalOffset: 6, bobHeight: 16, layer: 'front' },
    { size: 0.7, swimDuration: 12000, initialDelay: 5500, direction: 'ltr', opacity: 0.65, verticalOffset: 12, bobHeight: 12, layer: 'back' },
  ],
  // 3 whales — mixed layers
  [
    { size: 0.75, swimDuration: 10500, initialDelay: 0, direction: 'rtl', opacity: 0.65, verticalOffset: 4, bobHeight: 12, layer: 'back' },
    { size: 0.9, swimDuration: 10000, initialDelay: 2500, direction: 'rtl', opacity: 0.9, verticalOffset: 16, bobHeight: 16, layer: 'front' },
    { size: 0.8, swimDuration: 11000, initialDelay: 5000, direction: 'rtl', opacity: 0.85, verticalOffset: 10, bobHeight: 14, layer: 'front' },
  ],
  // 3 whales — two close + one far
  [
    { size: 0.95, swimDuration: 9500, initialDelay: 0, direction: 'rtl', opacity: 0.9, verticalOffset: 4, bobHeight: 18, layer: 'front' },
    { size: 0.85, swimDuration: 10000, initialDelay: 1500, direction: 'rtl', opacity: 0.85, verticalOffset: 14, bobHeight: 14, layer: 'front' },
    { size: 0.7, swimDuration: 12000, initialDelay: 6000, direction: 'rtl', opacity: 0.6, verticalOffset: 8, bobHeight: 12, layer: 'back' },
  ],
  // 1 slightly larger solo
  [{ size: 1.1, swimDuration: 9000, initialDelay: 1500, direction: 'rtl', opacity: 0.9, verticalOffset: 8, bobHeight: 18, layer: 'front' }],
  // 3 whales — one behind, two in front
  [
    { size: 0.75, swimDuration: 11500, initialDelay: 0, direction: 'rtl', opacity: 0.65, verticalOffset: 4, bobHeight: 12, layer: 'back' },
    { size: 0.9, swimDuration: 10000, initialDelay: 4000, direction: 'rtl', opacity: 0.9, verticalOffset: 14, bobHeight: 16, layer: 'front' },
    { size: 0.85, swimDuration: 10500, initialDelay: 5500, direction: 'rtl', opacity: 0.85, verticalOffset: 20, bobHeight: 14, layer: 'front' },
  ],
];

export default function SwimmingWhaleRow({ variant = 0 }: Props) {
  // Pick a random layout, seeded by variant so it's stable per row
  const layoutIndex = useMemo(() => {
    const hash = (variant * 7 + 3) % LAYOUTS.length;
    return hash;
  }, [variant]);

  const whales = LAYOUTS[layoutIndex];
  const backWhales = whales.filter(w => w.layer === 'back');
  const frontWhales = whales.filter(w => w.layer === 'front');

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Back whales — swim behind the waves, partially obscured */}
      {backWhales.map((config, index) => (
        <SwimmingWhale key={`back-${index}`} {...config} />
      ))}

      {/* Back wave — round, lighter blue */}
      <CartoonWave
        y={35} amplitude={16} speed={5000} delay={200}
        fillColor="rgba(135, 190, 230, 0.30)"
        fillColorLight="rgba(173, 216, 240, 0.20)"
        strokeColor="rgba(70, 140, 200, 0.40)"
        segments={5}
        pointy={false}
      />

      {/* Mid wave — POINTY peaks, with white caps */}
      <CartoonWave
        y={48} amplitude={14} speed={3800} delay={0}
        fillColor="rgba(60, 130, 200, 0.35)"
        fillColorLight="rgba(90, 160, 220, 0.25)"
        strokeColor="rgba(40, 100, 170, 0.50)"
        capColor="rgba(255, 255, 255, 0.90)"
        segments={6}
        pointy={true}
      />

      {/* Front wave — round cartoon, darker blue, white caps */}
      <CartoonWave
        y={60} amplitude={10} speed={3500} delay={400}
        fillColor="rgba(50, 120, 190, 0.30)"
        fillColorLight="rgba(80, 150, 210, 0.22)"
        strokeColor="rgba(30, 90, 160, 0.45)"
        capColor="rgba(255, 255, 255, 0.85)"
        segments={8}
        pointy={false}
      />

      {/* Front whales — swim in front of the waves */}
      {frontWhales.map((config, index) => (
        <SwimmingWhale key={`front-${index}`} {...config} />
      ))}

      {/* Small foreground pointy ripple */}
      <CartoonWave
        y={72} amplitude={7} speed={4200} delay={600}
        fillColor="rgba(80, 150, 210, 0.20)"
        fillColorLight="rgba(120, 180, 230, 0.12)"
        strokeColor="rgba(60, 130, 200, 0.30)"
        segments={10}
        pointy={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 100,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 6,
  },
});
