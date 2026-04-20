import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';

/**
 * PodEngagementIndicator
 *
 * Exposes:
 *  - ActiveGradientBorder: a thin shimmering rainbow border wrapper for active pods.
 *  - HotFlameIcon: an animated flickering flame badge for hot/new pods.
 *  - calculateEngagement(): pure helper deciding { isActive, isHot } from data.
 *  - fetchEngagementData(): batch Supabase fetch for meetings, chat, team-member accepts.
 */

// ---------- Types ----------
export interface EngagementState {
  isActive: boolean;
  isHot: boolean;
}

export interface EngagementInputs {
  pod: any;
  meetingsCount?: number;
  chatCount?: number;
  recentAcceptances?: number;
}

// ---------- Pure logic ----------
export function calculateEngagement(
  pod: any,
  meetingsCount: number = 0,
  chatCount: number = 0,
  recentAcceptances: number = 0
): EngagementState {
  // isActive: recent meetings OR recent chat activity
  const isActive = meetingsCount >= 1 || chatCount >= 3;

  // isHot: pod created in last 30 days AND ≥2 accepted members in last 14 days
  let isHot = false;
  if (pod?.created_at) {
    const createdAt = new Date(pod.created_at).getTime();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const isNewPod = now - createdAt <= thirtyDays;
    if (isNewPod && recentAcceptances >= 2) {
      isHot = true;
    }
  }

  return { isActive, isHot };
}

// ---------- Batch data fetcher ----------
/**
 * Fetches engagement data for the given pursuit IDs in three parallel queries.
 * Returns a map: pursuitId -> { meetingsCount, chatCount, recentAcceptances }
 */
export async function fetchEngagementData(
  pursuitIds: string[]
): Promise<Record<string, { meetingsCount: number; chatCount: number; recentAcceptances: number }>> {
  const result: Record<string, { meetingsCount: number; chatCount: number; recentAcceptances: number }> = {};
  pursuitIds.forEach((id) => {
    result[id] = { meetingsCount: 0, chatCount: 0, recentAcceptances: 0 };
  });

  if (pursuitIds.length === 0) return result;

  const now = Date.now();
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [meetingsRes, chatRes, teamRes] = await Promise.all([
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
  } catch (err) {
    console.warn('fetchEngagementData error:', err);
  }

  return result;
}

// ---------- Active shimmering rainbow border ----------
interface ActiveGradientBorderProps {
  children: React.ReactNode;
  enabled: boolean;
  borderRadius?: number;
  thickness?: number;
  backgroundColor?: string;
}

const RAINBOW_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B72AA', '#FF6B6B'] as const;

export function ActiveGradientBorder({
  children,
  enabled,
  borderRadius = 16,
  thickness = 2.5,
  backgroundColor,
}: ActiveGradientBorderProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false, // interpolating gradient start/end positions; native driver can't animate layout
      })
    );
    loop.start();
    return () => {
      loop.stop();
      anim.setValue(0);
    };
  }, [enabled, anim]);

  if (!enabled) {
    return <>{children}</>;
  }

  // Animate gradient start/end horizontally to give a flowing shimmer
  const startX = anim.interpolate({ inputRange: [0, 1], outputRange: [-0.5, 1.5] });
  const endX = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.5] });

  return (
    <Animated.View
      style={{
        borderRadius,
        padding: thickness,
        marginBottom: 16,
      }}
    >
      <AnimatedLinearGradient
        // Flowing horizontal gradient
        // @ts-ignore - animated values work at runtime with useNativeDriver:false
        start={{ x: startX as unknown as number, y: 0 }}
        // @ts-ignore
        end={{ x: endX as unknown as number, y: 1 }}
        colors={[...RAINBOW_COLORS]}
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

// ---------- Hot flickering flame icon ----------
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

    return () => {
      rotLoop.stop();
      scaleLoop.stop();
      opLoop.stop();
    };
  }, [enabled, rot, scaleA, opacity]);

  if (!enabled) return null;

  const rotate = rot.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] });

  return (
    <Animated.View
      style={[
        styles.flameContainer,
        style,
        { opacity, transform: [{ rotate }, { scale: scaleA }] },
      ]}
      pointerEvents="none"
    >
      {/* Layered flame icons to simulate gradient: outer red, middle orange, core yellow */}
      <View style={styles.flameStack}>
        <Ionicons name="flame" size={size} color="#FF4500" style={styles.flameLayer} />
        <Ionicons name="flame" size={size * 0.75} color="#FF8C00" style={styles.flameLayerMid} />
        <Ionicons name="flame" size={size * 0.45} color="#FFD700" style={styles.flameLayerCore} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flameContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 20,
  },
  flameStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameLayer: {
    // outer
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
