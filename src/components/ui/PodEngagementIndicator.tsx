import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, LinearGradient as SvgLinearGradient, Defs, Stop } from 'react-native-svg';
import { supabase } from '../../config/supabase';

/**
 * Pod engagement visuals:
 *   - HotFlameIcon: layered flame for pods getting applications + acceptances (pre-kickoff).
 *   - JalapenoIndicator: 1-3 stylized jalapeños indicating post-kickoff activity tier.
 *   - ActiveGradientBorder: retained for legacy; no longer used on Feed/Pods cards.
 */

export interface EngagementState {
  isHot: boolean;
  spiceLevel: 0 | 1 | 2 | 3;
}

export function calculateEngagement(
  pod: any,
  meetingsCount: number = 0,
  chatCount: number = 0,
  recentAcceptances: number = 0,
  boardCount: number = 0
): EngagementState {
  // Hot (fire) = new pod + people applying / being accepted. Pre-kickoff signal.
  let isHot = false;
  if (pod?.created_at) {
    const createdAt = new Date(pod.created_at).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const isNewPod = Date.now() - createdAt <= thirtyDays;
    if (isNewPod && recentAcceptances >= 2) isHot = true;
  }

  // Spice = post-kickoff activity score. Only counts when the pod has actually kicked off.
  let spiceLevel: 0 | 1 | 2 | 3 = 0;
  if (pod?.status === 'active') {
    const score = meetingsCount + chatCount + boardCount;
    if (score >= 10) spiceLevel = 3;
    else if (score >= 5) spiceLevel = 2;
    else if (score >= 2) spiceLevel = 1;
  }

  return { isHot, spiceLevel };
}

export async function fetchEngagementData(
  pursuitIds: string[]
): Promise<Record<string, { meetingsCount: number; chatCount: number; recentAcceptances: number; boardCount: number }>> {
  const result: Record<string, { meetingsCount: number; chatCount: number; recentAcceptances: number; boardCount: number }> = {};
  pursuitIds.forEach((id) => {
    result[id] = { meetingsCount: 0, chatCount: 0, recentAcceptances: 0, boardCount: 0 };
  });
  if (pursuitIds.length === 0) return result;

  const now = Date.now();
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [meetingsRes, chatRes, teamRes, boardsRes] = await Promise.all([
      supabase
        .from('meetings')
        .select('pursuit_id')
        .in('pursuit_id', pursuitIds)
        .gte('scheduled_time', fourteenDaysAgo),
      supabase
        .from('pod_chat_messages')
        .select('pursuit_id')
        .in('pursuit_id', pursuitIds)
        .gte('created_at', sevenDaysAgo),
      supabase
        .from('team_members')
        .select('pursuit_id, status, created_at')
        .in('pursuit_id', pursuitIds)
        .in('status', ['active', 'accepted'])
        .gte('created_at', fourteenDaysAgo),
      supabase
        .from('team_boards')
        .select('id, pursuit_id')
        .in('pursuit_id', pursuitIds),
    ]);

    if (meetingsRes.data) {
      for (const row of meetingsRes.data as any[]) {
        if (result[row.pursuit_id]) result[row.pursuit_id].meetingsCount += 1;
      }
    }
    if (chatRes.data) {
      for (const row of chatRes.data as any[]) {
        if (result[row.pursuit_id]) result[row.pursuit_id].chatCount += 1;
      }
    }
    if (teamRes.data) {
      for (const row of teamRes.data as any[]) {
        if (result[row.pursuit_id]) result[row.pursuit_id].recentAcceptances += 1;
      }
    }

    // Count recent board task additions by joining board ids to pursuits
    if (boardsRes.data && boardsRes.data.length > 0) {
      const boardIdToPursuit: Record<string, string> = {};
      const boardIds: string[] = [];
      for (const b of boardsRes.data as any[]) {
        boardIdToPursuit[b.id] = b.pursuit_id;
        boardIds.push(b.id);
      }
      const tasksRes = await supabase
        .from('board_tasks')
        .select('board_id, created_at')
        .in('board_id', boardIds)
        .gte('created_at', fourteenDaysAgo);
      if (tasksRes.data) {
        for (const row of tasksRes.data as any[]) {
          const pid = boardIdToPursuit[row.board_id];
          if (pid && result[pid]) result[pid].boardCount += 1;
        }
      }
    }
  } catch (err) {
    console.warn('fetchEngagementData error:', err);
  }

  return result;
}

// ---------- Hot flickering flame (pre-kickoff "hot") ----------
interface HotFlameIconProps {
  enabled: boolean;
  size?: number;
  style?: any;
}

export function HotFlameIcon({ enabled, size = 22, style }: HotFlameIconProps) {
  const rot = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) return;
    const rotLoop = Animated.loop(
      Animated.sequence([
        Animated.spring(rot, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 10 }),
        Animated.spring(rot, { toValue: -1, useNativeDriver: true, speed: 8, bounciness: 10 }),
        Animated.spring(rot, { toValue: 0, useNativeDriver: true, speed: 8, bounciness: 10 }),
      ])
    );
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.spring(scaleA, { toValue: 1.05, useNativeDriver: true, speed: 10, bounciness: 12 }),
        Animated.spring(scaleA, { toValue: 0.95, useNativeDriver: true, speed: 10, bounciness: 12 }),
      ])
    );
    const opLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 420, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    rotLoop.start();
    scaleLoop.start();
    opLoop.start();
    return () => { rotLoop.stop(); scaleLoop.stop(); opLoop.stop(); };
  }, [enabled, rot, scaleA, opacity]);

  if (!enabled) return null;

  const rotate = rot.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] });

  return (
    <Animated.View
      style={[styles.badgeContainer, style, { opacity, transform: [{ rotate }, { scale: scaleA }] }]}
      pointerEvents="none"
    >
      <View style={styles.flameStack}>
        <Ionicons name="flame" size={size} color="#FF4500" />
        <Ionicons name="flame" size={size * 0.75} color="#FF8C00" style={styles.flameLayerMid} />
        <Ionicons name="flame" size={size * 0.45} color="#FFD700" style={styles.flameLayerCore} />
      </View>
    </Animated.View>
  );
}

// ---------- Jalapeño SVG (single pepper) ----------
interface JalapenoSvgProps {
  size?: number;
}

function JalapenoSvg({ size = 20 }: JalapenoSvgProps) {
  // Viewbox 100x100, pepper occupies ~40x80
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgLinearGradient id="peppergrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#86EFAC" stopOpacity="1" />
          <Stop offset="0.5" stopColor="#22C55E" stopOpacity="1" />
          <Stop offset="1" stopColor="#166534" stopOpacity="1" />
        </SvgLinearGradient>
        <SvgLinearGradient id="stemgrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4ADE80" stopOpacity="1" />
          <Stop offset="1" stopColor="#166534" stopOpacity="1" />
        </SvgLinearGradient>
      </Defs>
      {/* Stem */}
      <Path
        d="M 48 10 Q 42 4, 38 10 Q 40 14, 46 15 Q 50 18, 54 15 Q 60 14, 62 10 Q 58 4, 52 10 Q 50 12, 48 10 Z"
        fill="url(#stemgrad)"
      />
      {/* Body */}
      <Path
        d="M 50 15 Q 38 18, 40 30 Q 42 55, 46 80 Q 50 92, 54 80 Q 58 55, 60 30 Q 62 18, 50 15 Z"
        fill="url(#peppergrad)"
      />
      {/* Highlight stripe */}
      <Path
        d="M 44 28 Q 45 50, 46 75"
        stroke="#BBF7D0"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </Svg>
  );
}

// ---------- Jalapeño indicator (1-3 peppers, animated) ----------
interface JalapenoIndicatorProps {
  count: 0 | 1 | 2 | 3;
  style?: any;
}

export function JalapenoIndicator({ count, style }: JalapenoIndicatorProps) {
  const bounce = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count === 0) return;
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.spring(bounce, { toValue: 1, useNativeDriver: true, speed: 6, bounciness: 14 }),
        Animated.spring(bounce, { toValue: 0, useNativeDriver: true, speed: 6, bounciness: 14 }),
      ])
    );
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    bounceLoop.start();
    swayLoop.start();
    return () => { bounceLoop.stop(); swayLoop.stop(); };
  }, [count, bounce, sway]);

  if (count === 0) return null;

  // Scale peppers down when more are clustered
  const size = count === 1 ? 26 : count === 2 ? 22 : 18;
  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  // Arrangement — overlap slightly, rotate each for a "bunch"
  const peppers = Array.from({ length: count }).map((_, i) => {
    const angle = count === 1 ? 0 : (i - (count - 1) / 2) * 14;
    const offsetX = count === 1 ? 0 : (i - (count - 1) / 2) * (size * 0.55);
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          transform: [{ translateX: offsetX }, { rotate: `${angle}deg` }],
          zIndex: count - i,
        }}
      >
        <JalapenoSvg size={size} />
      </View>
    );
  });

  // Container width scales with count
  const containerWidth = size + (count - 1) * (size * 0.55) + 4;

  return (
    <Animated.View
      style={[
        styles.badgeContainer,
        style,
        {
          width: containerWidth,
          height: size + 6,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateY }, { rotate }],
        },
      ]}
      pointerEvents="none"
    >
      {peppers}
    </Animated.View>
  );
}

// ---------- Legacy: shimmering border (kept exported; unused on Feed/Pods) ----------
interface ActiveGradientBorderProps {
  children: React.ReactNode;
  enabled: boolean;
  borderRadius?: number;
  thickness?: number;
  backgroundColor?: string;
  gradientColors?: readonly string[];
}

const RAINBOW_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B72AA', '#FF6B6B'] as const;

export function ActiveGradientBorder({
  children,
  enabled,
  borderRadius = 16,
  thickness = 2.5,
  backgroundColor,
  gradientColors,
}: ActiveGradientBorderProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: false })
    );
    loop.start();
    return () => { loop.stop(); anim.setValue(0); };
  }, [enabled, anim]);

  if (!enabled) return <>{children}</>;

  const startX = anim.interpolate({ inputRange: [0, 1], outputRange: [-0.5, 1.5] });
  const endX = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.5] });

  return (
    <Animated.View style={{ borderRadius, padding: thickness, marginBottom: 16 }}>
      <AnimatedLinearGradient
        // @ts-ignore
        start={{ x: startX as unknown as number, y: 0 }}
        // @ts-ignore
        end={{ x: endX as unknown as number, y: 1 }}
        colors={gradientColors ? [...gradientColors] : [...RAINBOW_COLORS]}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />
      <View
        style={{
          borderRadius: Math.max(0, borderRadius - thickness),
          backgroundColor: backgroundColor || 'transparent',
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 20,
  },
  flameStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameLayerMid: {
    position: 'absolute',
    top: '18%',
  },
  flameLayerCore: {
    position: 'absolute',
    top: '35%',
  },
});
