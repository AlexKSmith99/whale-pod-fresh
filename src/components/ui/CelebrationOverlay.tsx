/**
 * CelebrationOverlay — full-screen milestone celebration with confetti.
 *
 * Used for the big moments (getting accepted into a pod, a kickoff getting
 * scheduled). Renders a themed, screen-wide takeover: raining confetti, a
 * kicker chip, a huge headline, and a brief enthusiastic message.
 *   - Dark (Pie): near-black backdrop, lime/gold/white confetti, Sora.
 *   - Light (editorial): cream backdrop, Carolina/gold confetti, Playfair.
 *
 * Imperative API (host must be mounted once at the app root):
 *   Celebration.show({ kicker, headline, message })
 * Auto-dismisses after ~5s; tapping anywhere dismisses immediately.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { editorial } from '../../theme/designSystem';
import { HapticManager } from '../../services/hapticManager';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PIECE_COUNT = 54;
const AUTO_DISMISS_MS = 5200;

export interface CelebrationConfig {
  kicker: string;    // tiny uppercase chip, e.g. "POD ACCEPTED"
  headline: string;  // big line, e.g. "You're in!!"
  message: string;   // one brief sentence
}

let showCelebration: ((config: CelebrationConfig) => void) | null = null;

export const Celebration = {
  show(config: CelebrationConfig) {
    showCelebration?.(config);
  },
};

interface PieceSpec {
  x: number;          // horizontal start position
  drift: number;      // horizontal sway distance
  size: number;
  isRound: boolean;
  colorIndex: number;
  delay: number;
  duration: number;
  spins: number;
}

// Deterministic-ish randomness is fine here; specs are generated per show.
function makePieces(): PieceSpec[] {
  return Array.from({ length: PIECE_COUNT }, () => ({
    x: Math.random() * SCREEN_W,
    drift: (Math.random() - 0.5) * 120,
    size: 6 + Math.random() * 6,
    isRound: Math.random() < 0.3,
    colorIndex: Math.floor(Math.random() * 4),
    delay: Math.random() * 900,
    duration: 2600 + Math.random() * 1800,
    spins: 1 + Math.random() * 3,
  }));
}

function ConfettiPiece({ spec, color }: { spec: PieceSpec; color: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [progress, spec]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, SCREEN_H + 40],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, spec.drift, spec.drift * 0.4],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${spec.spins * 360}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.05, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: spec.x,
        width: spec.size,
        height: spec.isRound ? spec.size : spec.size * 1.7,
        borderRadius: spec.isRound ? spec.size / 2 : 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

export function CelebrationHost() {
  const { isNewTheme } = useTheme();
  const [config, setConfig] = useState<CelebrationConfig | null>(null);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.85)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pieces = useMemo(() => (config ? makePieces() : []), [config]);

  useEffect(() => {
    showCelebration = (c: CelebrationConfig) => setConfig(c);
    return () => {
      showCelebration = null;
    };
  }, []);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(contentOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setConfig(null),
    );
  }, [contentOpacity]);

  useEffect(() => {
    if (config) {
      HapticManager.success?.();
      contentOpacity.setValue(0);
      contentScale.setValue(0.85);
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(contentScale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      ]).start();
      dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
      return () => {
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
      };
    }
  }, [config, contentOpacity, contentScale, dismiss]);

  if (!config) return null;

  const dark = isNewTheme;
  const confettiColors = dark
    ? ['#C8FF6B', '#FFFFFF', '#FCD34D', '#94C44E']
    : [editorial.carolina, editorial.gold, editorial.carolinaDeep, editorial.ink];

  return (
    <Modal transparent statusBarTranslucent visible animationType="none" onRequestClose={dismiss}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: dark ? 'rgba(0, 0, 0, 0.93)' : 'rgba(250, 249, 246, 0.97)' }]}
        onPress={dismiss}
      >
        {pieces.map((spec, i) => (
          <ConfettiPiece key={i} spec={spec} color={confettiColors[spec.colorIndex]} />
        ))}

        <Animated.View style={[styles.content, { opacity: contentOpacity, transform: [{ scale: contentScale }] }]}>
          <View
            style={[
              styles.kickerChip,
              dark
                ? { backgroundColor: 'rgba(200, 255, 107, 0.12)', borderColor: 'rgba(200, 255, 107, 0.35)' }
                : { backgroundColor: editorial.carolinaTint, borderColor: 'rgba(75, 156, 211, 0.35)' },
            ]}
          >
            <Text
              style={[
                styles.kickerText,
                { color: dark ? '#C8FF6B' : editorial.carolinaDeep, fontFamily: dark ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' },
              ]}
            >
              {config.kicker}
            </Text>
          </View>

          <Text
            style={[
              styles.headline,
              dark
                ? { color: '#FFFFFF', fontFamily: 'Sora_700Bold', fontSize: 36, letterSpacing: -0.8 }
                : { color: editorial.ink, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 40, letterSpacing: -1 },
            ]}
          >
            {config.headline}
          </Text>

          <Text
            style={[
              styles.message,
              {
                color: dark ? 'rgba(255, 255, 255, 0.78)' : editorial.muted,
                fontFamily: dark ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
              },
            ]}
          >
            {config.message}
          </Text>
        </Animated.View>

        <Text
          style={[
            styles.tapHint,
            {
              color: dark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(27, 27, 24, 0.30)',
              fontFamily: dark ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
            },
          ]}
        >
          tap anywhere to continue
        </Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  kickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 20,
  },
  kickerText: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headline: {
    textAlign: 'center',
    marginBottom: 14,
  },
  message: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 300,
  },
  tapHint: {
    position: 'absolute',
    bottom: 64,
    alignSelf: 'center',
    fontSize: 12,
    letterSpacing: 0.4,
  },
});
