/**
 * GrainTexture - Adds a subtle fuzzy/grainy noise texture overlay
 * Creates a film grain effect for backgrounds
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GrainTextureProps {
  /** Overall opacity of the grain (0-1), default 0.15 */
  opacity?: number;
  /** Density of grain particles (higher = more dense), default 1 */
  density?: number;
}

// Seeded random for consistent texture
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export default function GrainTexture({
  opacity = 0.15,
  density = 1,
}: GrainTextureProps) {

  // Generate grain particles - small dots creating a fuzzy/noisy effect
  const grainParticles = useMemo(() => {
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      opacity: number;
    }> = [];

    // Create dense grain pattern
    const baseGridSize = 12; // Base pixels between particles
    const gridSize = baseGridSize / density;
    const cols = Math.ceil(SCREEN_WIDTH / gridSize);
    const rows = Math.ceil(SCREEN_HEIGHT / gridSize);
    const totalCells = cols * rows;

    // Limit total particles for performance
    const maxParticles = 800;
    const skipRate = Math.max(1, Math.floor(totalCells / maxParticles));

    for (let i = 0; i < totalCells; i += skipRate) {
      const rand = seededRandom(i * 17);
      // 60% chance to place a particle for organic feel
      if (rand < 0.6) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const randX = seededRandom(i * 31);
        const randY = seededRandom(i * 47);
        const randSize = seededRandom(i * 13);
        const randOpacity = seededRandom(i * 23);

        particles.push({
          x: (col * gridSize) + (randX * gridSize * 0.9),
          y: (row * gridSize) + (randY * gridSize * 0.9),
          size: 1 + randSize * 1.5, // 1-2.5px dots
          opacity: 0.2 + randOpacity * 0.6, // Vary individual opacity
        });
      }
    }
    return particles;
  }, [density]);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {/* Grain particles */}
      {grainParticles.map((particle, index) => (
        <View
          key={`grain-${index}`}
          style={{
            position: 'absolute',
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            borderRadius: particle.size / 2,
            backgroundColor: `rgba(255, 255, 255, ${particle.opacity})`,
          }}
        />
      ))}
    </View>
  );
}
