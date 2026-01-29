import React from 'react';
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

const getColorForMember = (index: number): string => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#84cc16'];
  return colors[index % colors.length];
};

// Calculate positions for bubbles floating inside the main circle (with gaps between)
const getBubblePositions = (count: number, containerSize: number, bubbleSize: number) => {
  const center = containerSize / 2;
  const positions: { top: number; left: number }[] = [];
  const gap = containerSize * 0.06; // Gap between bubbles

  if (count === 1) {
    positions.push({ top: center - bubbleSize / 2, left: center - bubbleSize / 2 });
  } else if (count === 2) {
    positions.push({ top: center - bubbleSize / 2, left: containerSize * 0.1 });
    positions.push({ top: center - bubbleSize / 2, left: containerSize * 0.9 - bubbleSize });
  } else if (count === 3) {
    // Triangle formation with gaps
    positions.push({ top: containerSize * 0.08, left: center - bubbleSize / 2 }); // top center
    positions.push({ top: containerSize * 0.55, left: containerSize * 0.05 }); // bottom left
    positions.push({ top: containerSize * 0.55, left: containerSize * 0.95 - bubbleSize }); // bottom right
  } else if (count === 4) {
    // 2x2 with gaps
    const inset = containerSize * 0.08;
    const spacing = containerSize - inset * 2 - bubbleSize * 2;
    positions.push({ top: inset, left: inset }); // top left
    positions.push({ top: inset, left: inset + bubbleSize + spacing }); // top right
    positions.push({ top: inset + bubbleSize + spacing, left: inset }); // bottom left
    positions.push({ top: inset + bubbleSize + spacing, left: inset + bubbleSize + spacing }); // bottom right
  } else if (count === 5) {
    // 2 on top, 1 middle, 2 on bottom
    positions.push({ top: containerSize * 0.02, left: containerSize * 0.12 });
    positions.push({ top: containerSize * 0.02, left: containerSize * 0.88 - bubbleSize });
    positions.push({ top: center - bubbleSize / 2, left: center - bubbleSize / 2 });
    positions.push({ top: containerSize * 0.7, left: containerSize * 0.12 });
    positions.push({ top: containerSize * 0.7, left: containerSize * 0.88 - bubbleSize });
  } else if (count === 6) {
    // 2 rows of 3 with gaps
    const topY = containerSize * 0.05;
    const bottomY = containerSize * 0.58;
    const leftX = containerSize * 0.02;
    const centerX = center - bubbleSize / 2;
    const rightX = containerSize * 0.98 - bubbleSize;
    positions.push({ top: topY, left: leftX });
    positions.push({ top: topY, left: centerX });
    positions.push({ top: topY, left: rightX });
    positions.push({ top: bottomY, left: leftX });
    positions.push({ top: bottomY, left: centerX });
    positions.push({ top: bottomY, left: rightX });
  } else if (count === 7) {
    // 3-1-3 formation with gaps
    const topY = containerSize * 0.02;
    const midY = center - bubbleSize / 2;
    const bottomY = containerSize * 0.68;
    const leftX = containerSize * 0.02;
    const centerX = center - bubbleSize / 2;
    const rightX = containerSize * 0.98 - bubbleSize;
    positions.push({ top: topY, left: leftX });
    positions.push({ top: topY, left: centerX });
    positions.push({ top: topY, left: rightX });
    positions.push({ top: midY, left: centerX });
    positions.push({ top: bottomY, left: leftX });
    positions.push({ top: bottomY, left: centerX });
    positions.push({ top: bottomY, left: rightX });
  } else {
    // 8+: 3-2-3 formation with gaps
    const topY = containerSize * 0.02;
    const midY = center - bubbleSize / 2;
    const bottomY = containerSize * 0.68;
    const leftX = containerSize * 0.02;
    const centerX = center - bubbleSize / 2;
    const rightX = containerSize * 0.98 - bubbleSize;
    positions.push({ top: topY, left: leftX });
    positions.push({ top: topY, left: centerX });
    positions.push({ top: topY, left: rightX });
    positions.push({ top: midY, left: containerSize * 0.15 });
    positions.push({ top: midY, left: containerSize * 0.85 - bubbleSize });
    positions.push({ top: bottomY, left: leftX });
    positions.push({ top: bottomY, left: centerX });
    positions.push({ top: bottomY, left: rightX });
  }

  return positions;
};

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

  // Calculate bubble size based on member count (smaller to leave gaps)
  const getBubbleSize = () => {
    if (count === 1) return size * 0.65;
    if (count === 2) return size * 0.42;
    if (count <= 4) return size * 0.38;
    if (count <= 6) return size * 0.3;
    return size * 0.28;
  };

  const bubbleSize = getBubbleSize();
  const positions = getBubblePositions(Math.min(count, 8), size, bubbleSize);
  const displayMembers = members.slice(0, 8);
  const extraCount = count > 8 ? count - 7 : 0;

  const renderBubble = (member: Member, index: number, position: { top: number; left: number }, isOverflow = false) => {
    const bubbleStyle = {
      position: 'absolute' as const,
      top: position.top,
      left: position.left,
      width: bubbleSize,
      height: bubbleSize,
      borderRadius: bubbleSize / 2,
      borderWidth: 1.5,
      borderColor: '#e5e7eb',
      overflow: 'hidden' as const,
    };

    if (isOverflow) {
      return (
        <View key="overflow" style={[bubbleStyle, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={[styles.overflow, { fontSize: bubbleSize * 0.4 }]}>+{extraCount}</Text>
        </View>
      );
    }

    if (member.profile_picture) {
      return (
        <View key={member.id || index} style={bubbleStyle}>
          <Image
            source={{ uri: member.profile_picture }}
            style={{ width: bubbleSize - 4, height: bubbleSize - 4, borderRadius: bubbleSize / 2 }}
          />
        </View>
      );
    }

    return (
      <View
        key={member.id || index}
        style={[bubbleStyle, { backgroundColor: getColorForMember(index), justifyContent: 'center', alignItems: 'center' }]}
      >
        <Text style={[styles.initial, { fontSize: bubbleSize * 0.4 }]}>
          {getInitial(member.name)}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: radius, backgroundColor: 'transparent' }, style]}>
      {displayMembers.map((member, index) => {
        // If we have overflow, show +N on the last position
        if (extraCount > 0 && index === 7) {
          return renderBubble(member, index, positions[index], true);
        }
        return renderBubble(member, index, positions[index]);
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: '#fff',
    fontWeight: '600',
  },
  overflow: {
    color: '#fff',
    fontWeight: '700',
  },
});
