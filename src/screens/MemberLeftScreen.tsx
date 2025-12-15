import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  pursuitTitle: string;
  memberName: string;
  reason: string;
  leftAt: string;
  onBack: () => void;
}

export default function MemberLeftScreen({ pursuitTitle, memberName, reason, leftAt, onBack }: Props) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Team Update</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🚪</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>A team member has left</Text>
            <Text style={styles.memberName}>{memberName}</Text>
            <Text style={styles.pursuitText}>from {pursuitTitle}</Text>
            <Text style={styles.dateText}>on {formatDate(leftAt)}</Text>
          </View>

          <View style={styles.reasonCard}>
            <Text style={styles.reasonLabel}>Reason provided by the member:</Text>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteIcon}>💡</Text>
            <Text style={styles.noteText}>
              This team member has voluntarily left your pod. You may want to review applications or invite new members to fill the spot.
            </Text>
          </View>

          <TouchableOpacity style={styles.browseButton} onPress={onBack}>
            <Text style={styles.browseButtonText}>Back to Notifications</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  icon: {
    fontSize: 64,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.base,
  },
  cardTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  memberName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  pursuitText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  reasonCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.base,
  },
  reasonLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.base,
  },
  reasonBox: {
    backgroundColor: '#fef3c7',
    borderRadius: borderRadius.base,
    padding: spacing.base,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  reasonText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  noteCard: {
    backgroundColor: '#eff6ff',
    borderRadius: borderRadius.base,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  noteIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: '#0369a1',
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
  },
  browseButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
