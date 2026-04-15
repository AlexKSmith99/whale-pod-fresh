import { useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';

interface UseStaggerFadeInOptions {
  itemCount: number;
  staggerDelay?: number;
  duration?: number;
  startDelay?: number;
  enabled?: boolean;
}

interface UseStaggerFadeInReturn {
  opacities: Animated.Value[];
  translateYs: Animated.Value[];
  startAnimation: () => void;
}

export function useStaggerFadeIn({
  itemCount,
  staggerDelay = 80,
  duration = 400,
  startDelay = 0,
  enabled = true,
}: UseStaggerFadeInOptions): UseStaggerFadeInReturn {
  const opacities = useRef<Animated.Value[]>(
    Array.from({ length: Math.max(itemCount, 1) }, () => new Animated.Value(enabled ? 0 : 1))
  ).current;
  const translateYs = useRef<Animated.Value[]>(
    Array.from({ length: Math.max(itemCount, 1) }, () => new Animated.Value(enabled ? 12 : 0))
  ).current;

  const startAnimation = useCallback(() => {
    const animations = opacities.slice(0, itemCount).map((opacity, index) => {
      return Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay: startDelay + index * staggerDelay,
          useNativeDriver: true,
        }),
        Animated.timing(translateYs[index], {
          toValue: 0,
          duration,
          delay: startDelay + index * staggerDelay,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start();
  }, [itemCount, staggerDelay, duration, startDelay]);

  useEffect(() => {
    if (enabled && itemCount > 0) {
      startAnimation();
    }
  }, [enabled, itemCount]);

  return { opacities, translateYs, startAnimation };
}
