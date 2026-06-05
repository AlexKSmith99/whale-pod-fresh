import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, Dimensions, Easing } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const TITLE = 'Whale Pod';

interface Props {
  onComplete: () => void;
}

export default function IntroAnimation({ onComplete }: Props) {
  const whaleY = useRef(new Animated.Value(-SCREEN_H * 0.6)).current;
  const whaleScale = useRef(new Animated.Value(0.85)).current;
  const whaleRotate = useRef(new Animated.Value(-0.15)).current;
  const bgFade = useRef(new Animated.Value(0)).current;

  // One opacity + translateY + scale per letter for staggered reveal
  const letters = TITLE.split('');
  const letterAnims = useRef(
    letters.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(14),
      scale: new Animated.Value(0.85),
    }))
  ).current;

  useEffect(() => {
    // Background subtle fade in
    Animated.timing(bgFade, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();

    // Whale drop with spring bounce
    Animated.parallel([
      Animated.spring(whaleY, {
        toValue: 0,
        tension: 55,
        friction: 5.5,
        useNativeDriver: true,
      }),
      Animated.spring(whaleScale, {
        toValue: 1,
        tension: 70,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(whaleRotate, {
        toValue: 0,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered letter reveal, starts slightly after whale lands
    const letterAnimations = letterAnims.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.opacity, {
          toValue: 1,
          duration: 420,
          delay: 700 + i * 55,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(a.translateY, {
          toValue: 0,
          tension: 60,
          friction: 7,
          delay: 700 + i * 55,
          useNativeDriver: true,
        }),
        Animated.spring(a.scale, {
          toValue: 1,
          tension: 85,
          friction: 6,
          delay: 700 + i * 55,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(0, letterAnimations).start();

    // Finish after 2750ms (1s longer than original 1750ms for a more breathable hold)
    const timer = setTimeout(() => onComplete(), 2750);
    return () => clearTimeout(timer);
  }, []);

  const whaleRotateDeg = whaleRotate.interpolate({
    inputRange: [-0.3, 0],
    outputRange: ['-17deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: bgFade }]}>
      <View style={styles.centerStack}>
        <Animated.View
          style={{
            transform: [
              { translateY: whaleY },
              { scale: whaleScale },
              { rotate: whaleRotateDeg },
            ],
            marginBottom: 22,
          }}
        >
          <Image
            source={require('../../assets/whale-logo.png')}
            style={styles.whale}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={styles.titleRow}>
          {letters.map((ch, i) => (
            <Animated.Text
              key={`${ch}-${i}`}
              style={[
                styles.titleLetter,
                {
                  opacity: letterAnims[i].opacity,
                  transform: [
                    { translateY: letterAnims[i].translateY },
                    { scale: letterAnims[i].scale },
                  ],
                },
              ]}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </Animated.Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerStack: {
    alignItems: 'center',
  },
  whale: {
    width: 160,
    height: 96,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
  titleLetter: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 44,
    color: '#1B1B18',
    letterSpacing: -0.5,
  },
});
