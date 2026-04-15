import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const OUTLINE = '#333';
const BODY_FILL = '#A8D8EA';
const BACK_FILL = '#7BB5CC';

// Wide plump oval body — horizontal bean shape, head on left, tapers right.
// Much wider than tall (~2.2:1), matching the round cartoon whale reference.
const WHALE_BODY =
  'M 24 10 ' +
  'C 10 6, 2 18, 4 34 ' +           // left forehead curving down
  'C 6 52, 20 60, 46 62 ' +         // chin / belly bottom-left
  'C 74 64, 104 58, 118 44 ' +      // belly sweeping right
  'C 128 34, 128 22, 120 14 ' +     // right side tapering up
  'C 108 4, 60 4, 24 10 Z';         // flat top going back left

// Darker blue area on upper-back — subtle tonal patch, NO outline
const BACK_MARK =
  'M 50 10 ' +
  'C 40 14, 36 24, 42 36 ' +
  'C 48 48, 78 52, 100 38 ' +
  'C 116 26, 114 12, 98 8 ' +
  'C 80 2, 60 4, 50 10 Z';

// Cute two-fluke tail — rendered behind body so body covers the overlap
const WHALE_TAIL =
  'M 114 22 ' +
  'Q 126 8, 138 10 ' +              // upper fluke
  'Q 130 18, 122 24 ' +             // back to center
  'Q 130 30, 138 38 ' +             // lower fluke
  'Q 126 42, 114 30 Z';             // back into body

// Small belly flipper
const FLIPPER =
  'M 44 56 ' +
  'Q 50 64, 58 60 ' +
  'Q 52 56, 46 54 Z';

interface SwimmingWhaleProps {
  size?: number;
  swimDuration?: number;
  initialDelay?: number;
  direction?: 'ltr' | 'rtl';
  opacity?: number;
  verticalOffset?: number;
  bobHeight?: number;
}

export default function SwimmingWhale({
  size = 1,
  swimDuration = 14000,
  initialDelay = 0,
  direction = 'rtl',
  opacity = 0.9,
  verticalOffset = 0,
  bobHeight = 16,
}: SwimmingWhaleProps) {
  const whaleHeight = 42 * size;
  const whaleWidth = whaleHeight * (140 / 64);

  const flipX = direction === 'ltr' ? -1 : 1;
  const startX = direction === 'rtl' ? SCREEN_WIDTH + 20 : -whaleWidth - 20;
  const endX = direction === 'rtl' ? -whaleWidth - 20 : SCREEN_WIDTH + 20;

  const translateX = useRef(new Animated.Value(startX)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const swim = Animated.loop(
      Animated.sequence([
        Animated.delay(initialDelay),
        Animated.timing(translateX, {
          toValue: endX,
          duration: swimDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: bobHeight,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -bobHeight,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    swim.start();
    bob.start();
    return () => { swim.stop(); bob.stop(); };
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: verticalOffset,
        opacity,
        transform: [{ translateX }, { translateY }, { scaleX: flipX }],
      }}
    >
      <Svg width={whaleWidth} height={whaleHeight} viewBox="0 0 140 64">
        {/* Tail — rendered first so body covers the overlap seam */}
        <Path
          d={WHALE_TAIL}
          fill={BODY_FILL}
          stroke={OUTLINE}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Main body — wide plump light blue oval */}
        <Path
          d={WHALE_BODY}
          fill={BODY_FILL}
          stroke={OUTLINE}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Darker blue back marking — subtle, no outline */}
        <Path
          d={BACK_MARK}
          fill={BACK_FILL}
          stroke="none"
        />
        {/* Small flipper */}
        <Path
          d={FLIPPER}
          fill={BODY_FILL}
          stroke={OUTLINE}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        {/* Dot eye */}
        <Circle cx={18} cy={32} r={2.5} fill={OUTLINE} />
        {/* Smile */}
        <Path
          d="M 16 42 Q 26 50, 38 46"
          fill="none"
          stroke={OUTLINE}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
