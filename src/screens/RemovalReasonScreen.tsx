import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  pursuitTitle: string;
  reason: string;
  removedAt: string;
  onBack: () => void;
}

export default function RemovalReasonScreen({ pursuitTitle, reason, removedAt, onBack }: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const primaryColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: primaryColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Membership Update</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📋</Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>You have been removed from</Text>
            <Text style={[styles.pursuitTitle, { color: colors.textPrimary }]}>{pursuitTitle}</Text>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>on {formatDate(removedAt)}</Text>
          </View>

          <View style={[styles.reasonCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.reasonLabel, { color: colors.textSecondary }]}>Reason provided by the creator:</Text>
            <View style={[styles.reasonBox, { backgroundColor: isNewTheme ? colors.warningLight : '#fef3c7', borderLeftColor: colors.warning }]}>
              <Text style={[styles.reasonText, { color: colors.textPrimary }]}>{reason}</Text>
            </View>
          </View>

          <View style={[styles.noteCard, { backgroundColor: isNewTheme ? colors.primaryLight : '#eff6ff', borderLeftColor: primaryColor }]}>
            <Text style={styles.noteIcon}>💡</Text>
            <Text style={[styles.noteText, { color: isNewTheme ? colors.textSecondary : '#0369a1' }]}>
              This pod will now appear in your "Past" pods section. You can still browse other pursuits and apply to join new teams.
            </Text>
          </View>

          <TouchableOpacity style={[styles.browseButton, { backgroundColor: primaryColor }]} onPress={onBack}>
            <Text style={[styles.browseButtonText, { color: isNewTheme ? colors.background : legacyColors.white }]}>Browse Pursuits</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: legacyColors.background,
  },
  header: {
    backgroundColor: legacyColors.white,
    padding: spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: legacyColors.borderLight,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
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
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.base,
  },
  cardTitle: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    marginBottom: spacing.xs,
  },
  pursuitTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
  },
  reasonCard: {
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.base,
  },
  reasonLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textSecondary,
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
    color: legacyColors.textPrimary,
    lineHeight: 22,
    fontFamily: 'KleeOne_400Regular',
  },
  noteCard: {
    backgroundColor: '#eff6ff',
    borderRadius: borderRadius.base,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: legacyColors.primary,
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
    fontFamily: 'KleeOne_400Regular',
  },
  browseButton: {
    backgroundColor: legacyColors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
  },
  browseButtonText: {
    color: legacyColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
