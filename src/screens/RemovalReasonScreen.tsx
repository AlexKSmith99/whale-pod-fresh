import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  pursuitTitle: string;
  reason: string;
  removedAt: string;
  onBack: () => void;
}

export default function RemovalReasonScreen({ pursuitTitle, reason, removedAt, onBack }: Props) {
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
        <Text style={styles.title}>Membership Update</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📋</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>You have been removed from</Text>
            <Text style={styles.pursuitTitle}>{pursuitTitle}</Text>
            <Text style={styles.dateText}>on {formatDate(removedAt)}</Text>
          </View>

          <View style={styles.reasonCard}>
            <Text style={styles.reasonLabel}>Reason provided by the creator:</Text>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteIcon}>💡</Text>
            <Text style={styles.noteText}>
              This pod will now appear in your "Past" pods section. You can still browse other pursuits and apply to join new teams.
            </Text>
          </View>

          <TouchableOpacity style={styles.browseButton} onPress={onBack}>
            <Text style={styles.browseButtonText}>Browse Pursuits</Text>
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
    marginBottom: spacing.xs,
  },
  pursuitTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
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
