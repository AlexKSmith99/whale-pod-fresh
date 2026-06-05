import React from 'react';
import ThemeTransition from './ThemeTransition';

// Theme transition wrapper component
export default function ThemeTransitionWrapper() {
  const { transitionState, onTransitionComplete } = require('../theme/ThemeContext').useTheme();

  return (
    <ThemeTransition
      isTransitioning={transitionState.isTransitioning}
      fromColor={transitionState.fromColor}
      toColor={transitionState.toColor}
      onTransitionComplete={onTransitionComplete}
    />
  );
}
