import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { hapticService } from '../services/hapticService';

interface Props {
  notification: {
    title: string;
    body: string;
    type: string;
  } | null;
  onPress?: () => void;
  onDismiss?: () => void;
}

export default function NotificationToast({ notification, onPress, onDismiss }: Props) {
  const [slideAnim] = useState(new Animated.Value(-100));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      // Haptic feedback when notification appears
      hapticService.rhythmicPulse(2, 100);

      // Slide in
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto dismiss after 6 seconds
      const timer = setTimeout(() => {
        dismiss();
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  };

  const handlePress = () => {
    hapticService.lightTap();
    dismiss();
    onPress?.();
  };

  if (!visible || !notification) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'application_received':
        return 'document-text';
      case 'kickoff_activated':
        return 'time';
      case 'connection_request':
        return 'people';
      case 'message':
      case 'new_message':
      case 'pod_chat':
      case 'pod_chat_message':
        return 'chatbubble';
      case 'meeting':
      case 'new_meeting':
      case 'kickoff_scheduled':
        return 'calendar';
      case 'interview_scheduling_requested':
      case 'interview_times_submitted':
      case 'interview_scheduled':
        return 'mic';
      default:
        return 'notifications';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toast}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={getIcon(notification.type) as any} size={24} color={colors.white} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {notification.title}
          </Text>
          <Text style={styles.body} numberOfLines={1}>
            {notification.body}
          </Text>
        </View>
        <TouchableOpacity onPress={dismiss} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={colors.white} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing.base,
    right: spacing.base,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    alignItems: 'center',
    ...shadows.lg,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.base,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
