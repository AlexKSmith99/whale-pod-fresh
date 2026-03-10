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

export default function PodMemberCollage({ members, size, borderRadius, style }: PodMemberCollageProps) {
  const count = members.length;

  if (count === 0) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: borderRadius ?? size / 2, backgroundColor: '#f3f4f6' }, style]}>
        <Text style={[styles.initial, { fontSize: size * 0.4, color: '#9ca3af' }]}>?</Text>
      </View>
    );
  }

  // Bubble size is ~60% of container
  const bubbleSize = size * 0.6;
  const overlap = bubbleSize * 0.35;
  const step = bubbleSize - overlap;

  // Determine what to display: max 3 circles
  // 1 member: 1 avatar
  // 2 members: 2 avatars
  // 3 members: 3 avatars
  // 4+ members: 2 avatars + "+N" where N = count - 2
  const displayCount = Math.min(count, 3);
  const showOverflow = count > 3;
  const overflowCount = count - 2;

  // Total width of the overlapping row
  const totalWidth = bubbleSize + (displayCount - 1) * step;
  // Center the row horizontally in the container
  const startLeft = (size - totalWidth) / 2;
  // Center vertically
  const topOffset = (size - bubbleSize) / 2;

  const renderBubble = (index: number) => {
    const left = startLeft + index * step;
    const zIndex = displayCount - index; // first on top

    const bubbleStyle = {
      position: 'absolute' as const,
      top: topOffset,
      left,
      width: bubbleSize,
      height: bubbleSize,
      borderRadius: bubbleSize / 2,
      borderWidth: 2,
      borderColor: '#1a1f36', // dark background border for clean overlap
      overflow: 'hidden' as const,
      zIndex,
    };

    // Show "+N" overflow on the last (3rd) position
    if (showOverflow && index === 2) {
      return (
        <View key="overflow" style={[bubbleStyle, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={[styles.overflow, { fontSize: bubbleSize * 0.35 }]}>+{overflowCount}</Text>
        </View>
      );
    }

    const member = members[index];

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
    <View style={[styles.container, { width: size, height: size, borderRadius: borderRadius ?? size / 2 }, style]}>
      {Array.from({ length: displayCount }, (_, i) => renderBubble(i))}
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
