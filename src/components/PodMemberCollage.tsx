import React, { useMemo } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

interface Member {
  id?: string;
  name?: string;
  profile_picture?: string;
}

interface PodMemberCollageProps {
  members: Member[];
  size: number;
  borderRadius?: number;
  style?: any;
}

const getInitial = (name?: string): string => {
  return name?.charAt(0).toUpperCase() || '?';
};

const MEMBER_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#84cc16'];

const getColorForMember = (index: number): string => {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
};

// Pre-defined layouts for floating bubbles inside the pool.
// Each entry is [xCenter%, yCenter%, sizeScale] — designed so bubbles
// don't overlap at any member count. Coordinates are % of container.
const FLOAT_LAYOUTS: Record<number, [number, number, number][]> = {
  1: [[0.5, 0.5, 0.65]],
  2: [
    [0.33, 0.38, 0.52],
    [0.67, 0.62, 0.46],
  ],
  3: [
    [0.35, 0.30, 0.42],
    [0.68, 0.35, 0.36],
    [0.45, 0.70, 0.38],
  ],
  4: [
    [0.32, 0.30, 0.38],
    [0.68, 0.28, 0.34],
    [0.55, 0.65, 0.36],
    [0.25, 0.68, 0.30],
  ],
};

// For 5+ members: show first 3 + overflow badge
const OVERFLOW_LAYOUT: [number, number, number][] = [
  [0.32, 0.30, 0.40],
  [0.70, 0.32, 0.34],
  [0.38, 0.68, 0.36],
  [0.72, 0.70, 0.28], // overflow badge position
];

export default function PodMemberCollage({ members, size, borderRadius, style }: PodMemberCollageProps) {
  const count = members.length;
  const radius = borderRadius ?? size / 2;

  if (count === 0) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: radius, backgroundColor: '#f3f4f6' }, style]}>
        <Text style={[styles.initial, { fontSize: size * 0.4, color: '#9ca3af' }]}>?</Text>
      </View>
    );
  }

  // Single member — just render a normal avatar, no pool needed
  if (count === 1) {
    const member = members[0];
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: radius }, style]}>
        {member.profile_picture ? (
          <Image
            source={{ uri: member.profile_picture }}
            style={{ width: size, height: size, borderRadius: radius }}
          />
        ) : (
          <View style={[styles.container, { width: size, height: size, borderRadius: radius, backgroundColor: getColorForMember(0) }]}>
            <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{getInitial(member.name)}</Text>
          </View>
        )}
      </View>
    );
  }

  const showOverflow = count > 4;
  const displayMembers = showOverflow ? members.slice(0, 3) : members.slice(0, 4);
  const layout = showOverflow
    ? OVERFLOW_LAYOUT
    : FLOAT_LAYOUTS[Math.min(count, 4)];

  return (
    <View style={[styles.container, styles.pool, { width: size, height: size, borderRadius: radius }, style]}>
      {displayMembers.map((member, i) => {
        const [cx, cy, scale] = layout[i];
        const bubbleSize = size * scale;
        const left = cx * size - bubbleSize / 2;
        const top = cy * size - bubbleSize / 2;

        return (
          <View
            key={member.id || `m-${i}`}
            style={[styles.bubble, {
              width: bubbleSize,
              height: bubbleSize,
              borderRadius: bubbleSize / 2,
              left,
              top,
              zIndex: i,
            }]}
          >
            {member.profile_picture ? (
              <Image
                source={{ uri: member.profile_picture }}
                style={{ width: bubbleSize, height: bubbleSize, borderRadius: bubbleSize / 2 }}
              />
            ) : (
              <View style={[styles.initialBubble, {
                width: bubbleSize,
                height: bubbleSize,
                borderRadius: bubbleSize / 2,
                backgroundColor: getColorForMember(i),
              }]}>
                <Text style={[styles.initial, { fontSize: bubbleSize * 0.42 }]}>
                  {getInitial(member.name)}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Overflow badge */}
      {showOverflow && (() => {
        const [cx, cy, scale] = layout[3];
        const badgeSize = size * scale;
        const left = cx * size - badgeSize / 2;
        const top = cy * size - badgeSize / 2;
        return (
          <View
            key="overflow"
            style={[styles.bubble, styles.overflowBadge, {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              left,
              top,
              zIndex: 10,
            }]}
          >
            <Text style={[styles.overflow, { fontSize: badgeSize * 0.4 }]}>
              +{count - 3}
            </Text>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pool: {
    backgroundColor: '#e5e7eb',
  },
  bubble: {
    position: 'absolute',
    overflow: 'hidden',
  },
  initialBubble: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: '#fff',
    fontWeight: '600',
  },
  overflowBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflow: {
    color: '#fff',
    fontWeight: '700',
  },
});
