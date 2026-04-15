/**
 * ThemeTransition — Full-screen ocean wave scene inspired by the Great Wave
 * of Kanagawa. Both top and bottom edges are wavy (no rectangular shape).
 * The wave art covers the screen, then slides off to reveal the new theme.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet, Easing } from 'react-native';
import Svg, { Path, Circle, Defs, ClipPath, G } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');
const EDGE = 50; // extra height for wavy edges top & bottom
const SCENE_H = SH + EDGE * 2;

/* ── path builders ─────────────────────────────────────────────────── */

/** Wave row: sinusoidal top edge → sinusoidal bottom edge. */
function waveRow(
  w: number,
  baseYRatio: number,
  amplitude: number,
  frequency: number,
  phase: number,
  bottomY: number,
  bottomAmp: number,
  bottomFreq: number,
  bottomPhase: number,
): string {
  const baseY = baseYRatio * SCENE_H;
  const steps = 80;

  // Top edge left → right
  let d = `M 0 ${(baseY + amplitude * Math.sin(phase)).toFixed(1)}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = t * w;
    const y = baseY + amplitude * Math.sin(t * Math.PI * 2 * frequency + phase);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  // Bottom edge right → left (wavy)
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const x = t * w;
    const y = bottomY + bottomAmp * Math.sin(t * Math.PI * 2 * bottomFreq + bottomPhase);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  return d + ' Z';
}

/** Curling crest — scroll/hook shape at a wave peak. */
function curlPath(cx: number, cy: number, size: number, flip: boolean): string {
  const f = flip ? -1 : 1;
  const s = size;
  return (
    `M ${cx - s * 0.6 * f} ${cy + s * 0.15} ` +
    `C ${cx - s * 0.3 * f} ${cy - s * 0.5}, ${cx + s * 0.2 * f} ${cy - s * 0.6}, ${cx + s * 0.5 * f} ${cy - s * 0.25} ` +
    `C ${cx + s * 0.6 * f} ${cy - s * 0.05}, ${cx + s * 0.45 * f} ${cy + s * 0.2}, ${cx + s * 0.15 * f} ${cy + s * 0.18} ` +
    `C ${cx - s * 0.05 * f} ${cy + s * 0.15}, ${cx - s * 0.1 * f} ${cy + s * 0.02}, ${cx - s * 0.05 * f} ${cy - s * 0.08}`
  );
}

/** Wavy clip outline — gives the entire scene wavy top & bottom edges. */
function buildClipPath(w: number, h: number): string {
  const steps = 80;
  const topBase = EDGE;
  const topAmp = 20;
  const bottomBase = h - EDGE;
  const bottomAmp = 22;

  // Top edge left → right
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * w;
    const y = topBase + topAmp * Math.sin(t * Math.PI * 2 * 2.5 + 0.5);
    d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  // Right side down
  d += ` L ${w} ${bottomBase}`;

  // Bottom edge right → left
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const x = t * w;
    const y = bottomBase + bottomAmp * Math.sin(t * Math.PI * 2 * 2 + 1.8);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  // Left side up
  d += ' Z';
  return d;
}

/* ── wave layers ───────────────────────────────────────────────────── */

// Bottom edge shared by all layers (wavy bottom boundary)
const BOT_Y = SCENE_H - EDGE + 10;
const BOT_AMP = 22;
const BOT_FREQ = 2;
const BOT_PHASE = 1.8;

const LAYERS = [
  { y: 0.04, amp: 10, freq: 3.0, phase: 1.0, color: '#7EC8E3' },
  { y: 0.10, amp: 14, freq: 2.5, phase: 2.5, color: '#6BBAD8' },
  { y: 0.17, amp: 18, freq: 2.0, phase: 0.4, color: '#5AACCE' },
  { y: 0.24, amp: 24, freq: 1.8, phase: 1.8, color: '#4A9DC3' },
  { y: 0.32, amp: 30, freq: 1.5, phase: 3.2, color: '#3B8DB8' },
  { y: 0.41, amp: 34, freq: 1.3, phase: 0.9, color: '#2D7DAD' },
  { y: 0.50, amp: 30, freq: 1.6, phase: 2.3, color: '#236C9E' },
  { y: 0.59, amp: 26, freq: 2.0, phase: 0.2, color: '#1A5C8F' },
  { y: 0.67, amp: 20, freq: 2.3, phase: 1.5, color: '#134D7F' },
  { y: 0.75, amp: 16, freq: 2.8, phase: 3.5, color: '#0E3F6F' },
  { y: 0.82, amp: 10, freq: 3.2, phase: 0.7, color: '#0A3260' },
  { y: 0.89, amp: 6,  freq: 4.0, phase: 2.0, color: '#072750' },
];

/* ── curling crests ────────────────────────────────────────────────── */

const CURLS = [
  { cx: 0.25, cy: 0.23, size: 32, flip: false },
  { cx: 0.70, cy: 0.16, size: 28, flip: true },
  { cx: 0.50, cy: 0.31, size: 40, flip: false },
  { cx: 0.15, cy: 0.40, size: 34, flip: true },
  { cx: 0.80, cy: 0.40, size: 36, flip: false },
  { cx: 0.40, cy: 0.49, size: 30, flip: true },
  { cx: 0.65, cy: 0.58, size: 28, flip: false },
  { cx: 0.30, cy: 0.67, size: 24, flip: true },
];

/* ── component ─────────────────────────────────────────────────────── */

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
  const translateY = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isTransitioning) {
      setVisible(true);
      translateY.setValue(-EDGE); // position so wavy top is just above screen

      Animated.sequence([
        Animated.delay(225),
        Animated.timing(translateY, {
          toValue: SH + EDGE,
          duration: 1950,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        onTransitionComplete();
      });
    }
  }, [isTransitioning]);

  if (!visible) return null;

  const clipD = buildClipPath(SW, SCENE_H);

  const layerPaths = LAYERS.map((l) =>
    waveRow(SW, l.y, l.amp, l.freq, l.phase, BOT_Y, BOT_AMP, BOT_FREQ, BOT_PHASE),
  );

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[styles.scene, { transform: [{ translateY }] }]}
      >
        <Svg width={SW} height={SCENE_H} viewBox={`0 0 ${SW} ${SCENE_H}`}>
          <Defs>
            <ClipPath id="wavyEdge">
              <Path d={clipD} />
            </ClipPath>
          </Defs>

          <G clipPath="url(#wavyEdge)">
            {/* Sky fill — covers full clip area */}
            <Path
              d={`M 0 0 L ${SW} 0 L ${SW} ${SCENE_H} L 0 ${SCENE_H} Z`}
              fill="#8ED1EC"
            />

            {/* Layered wave rows — each shares the same wavy bottom edge */}
            {LAYERS.map((layer, i) => (
              <Path key={`w${i}`} d={layerPaths[i]} fill={layer.color} />
            ))}

            {/* Curling crests */}
            {CURLS.map((c, i) => (
              <Path
                key={`c${i}`}
                d={curlPath(SW * c.cx, SCENE_H * c.cy, c.size, c.flip)}
                fill="none"
                stroke="white"
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.7}
              />
            ))}

            {/* Foam dots along wave crests */}
            {LAYERS.slice(3, 9).flatMap((layer, li) => {
              const cy = layer.y * SCENE_H;
              return Array.from({ length: 14 }).map((_, i) => {
                const t = (i + 0.3 + li * 0.12) / 14;
                const x = t * SW;
                const y =
                  cy +
                  layer.amp *
                    Math.sin(t * Math.PI * 2 * layer.freq + layer.phase) -
                  4;
                const r = 1.5 + (i % 4) * 1.2;
                return (
                  <Circle
                    key={`f${li}-${i}`}
                    cx={x.toFixed(1)}
                    cy={y.toFixed(1)}
                    r={r}
                    fill="white"
                    opacity={0.4 + (i % 3) * 0.15}
                  />
                );
              });
            })}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    overflow: 'hidden',
  },
  scene: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCENE_H,
  },
});
