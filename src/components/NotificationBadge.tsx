import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/designSystem';

interface Props {
  show: boolean;
  size?: number;
}

export default function NotificationBadge({ show, size = 8 }: Props) {
  if (!show) return null;

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.error,
    position: 'absolute',
    top: -2,
    right: -2,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});
