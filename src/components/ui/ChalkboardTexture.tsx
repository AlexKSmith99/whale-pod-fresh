/**
 * ChalkboardTexture - Adds a scratchy, chalkboard-like texture overlay
 * Creates a procedural grain and scratch effect for dark backgrounds
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChalkboardTextureProps {
  /** Overall opacity of the texture (0-1), default 0.08 */
  opacity?: number;
  /** Color of the texture elements, default off-white */
  color?: string;
}

// Seeded random for consistent texture
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export default function ChalkboardTexture({
  opacity = 0.08,
  color = 'rgba(244, 240, 230, 1)'
}: ChalkboardTextureProps) {

  // Generate chalk dust particles
  const dustParticles = useMemo(() => {
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      opacity: number;
    }> = [];

    // Create a grid of dust with some randomness
    const gridSize = 25; // pixels between potential particles
    const cols = Math.ceil(SCREEN_WIDTH / gridSize);
    const rows = Math.ceil(SCREEN_HEIGHT / gridSize);

    for (let i = 0; i < cols * rows; i++) {
      const rand = seededRandom(i * 17);
      // Only place particle 40% of the time for organic feel
      if (rand < 0.4) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        particles.push({
          x: (col * gridSize) + (seededRandom(i * 31) * gridSize * 0.8),
          y: (row * gridSize) + (seededRandom(i * 47) * gridSize * 0.8),
          size: 1 + seededRandom(i * 13) * 2,
          opacity: 0.3 + seededRandom(i * 23) * 0.7,
        });
      }
    }
    return particles;
  }, []);

  // Generate scratch lines
  const scratches = useMemo(() => {
    const lines: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      opacity: number;
    }> = [];

    const numScratches = 40;

    for (let i = 0; i < numScratches; i++) {
      const rand1 = seededRandom(i * 97);
      const rand2 = seededRandom(i * 113);
      const rand3 = seededRandom(i * 127);
      const rand4 = seededRandom(i * 131);
      const rand5 = seededRandom(i * 137);

      lines.push({
        x: rand1 * SCREEN_WIDTH,
        y: rand2 * SCREEN_HEIGHT,
        width: 30 + rand3 * 120, // 30-150px length
        height: rand4 < 0.7 ? 1 : 2, // mostly thin, some thicker
        rotation: -45 + rand5 * 90, // -45 to 45 degrees
        opacity: 0.15 + rand4 * 0.35,
      });
    }
    return lines;
  }, []);

  // Generate some chalk smudges (larger, softer areas)
  const smudges = useMemo(() => {
    const marks: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      opacity: number;
      rotation: number;
    }> = [];

    const numSmudges = 12;

    for (let i = 0; i < numSmudges; i++) {
      const rand1 = seededRandom(i * 211);
      const rand2 = seededRandom(i * 223);
      const rand3 = seededRandom(i * 227);
      const rand4 = seededRandom(i * 229);

      marks.push({
        x: rand1 * SCREEN_WIDTH,
        y: rand2 * SCREEN_HEIGHT,
        width: 40 + rand3 * 80,
        height: 8 + rand4 * 15,
        opacity: 0.02 + seededRandom(i * 233) * 0.04,
        rotation: seededRandom(i * 239) * 360,
      });
    }
    return marks;
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {/* Chalk dust particles */}
      {dustParticles.map((particle, index) => (
        <View
          key={`dust-${index}`}
          style={{
            position: 'absolute',
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            borderRadius: particle.size / 2,
            backgroundColor: color,
            opacity: particle.opacity,
          }}
        />
      ))}

      {/* Scratch lines */}
      {scratches.map((scratch, index) => (
        <View
          key={`scratch-${index}`}
          style={{
            position: 'absolute',
            left: scratch.x,
            top: scratch.y,
            width: scratch.width,
            height: scratch.height,
            backgroundColor: color,
            opacity: scratch.opacity,
            transform: [{ rotate: `${scratch.rotation}deg` }],
          }}
        />
      ))}

      {/* Smudge marks */}
      {smudges.map((smudge, index) => (
        <View
          key={`smudge-${index}`}
          style={{
            position: 'absolute',
            left: smudge.x,
            top: smudge.y,
            width: smudge.width,
            height: smudge.height,
            backgroundColor: color,
            opacity: smudge.opacity,
            borderRadius: smudge.height / 2,
            transform: [{ rotate: `${smudge.rotation}deg` }],
          }}
        />
      ))}

      {/* Vignette effect - darker edges */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderWidth: 60,
          borderColor: 'rgba(0, 0, 0, 0.15)',
        }}
      />
    </View>
  );
}
