import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { HapticManager } from '../services/hapticManager';

interface UseCardPressOptions {
  scaleDown?: number;
  haptic?: boolean;
}

export function useCardPress({
  scaleDown = 0.97,
  haptic = true,
}: UseCardPressOptions = {}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    if (haptic) HapticManager.softTap();
    Animated.spring(scale, {
      toValue: scaleDown,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleDown, haptic]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, []);

  return { scale, onPressIn, onPressOut };
}
