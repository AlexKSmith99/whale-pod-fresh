import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { colors as legacyColors, typography, spacing, borderRadius, shadows, editorial } from '../theme/designSystem';
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
      <View style={[
        styles.header,
        isNewTheme
          ? { backgroundColor: colors.surface, borderBottomColor: colors.border }
          : { backgroundColor: editorial.bg, borderBottomWidth: 0 },
      ]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: isNewTheme ? primaryColor : editorial.ink }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[
          styles.title,
          { color: colors.textPrimary },
          !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, letterSpacing: -0.5 },
        ]}>Membership Update</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📋</Text>
          </View>

          {/* Removal context — red accent stripe in light mode (semantic) */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface }, !isNewTheme && styles.editorialCard]}>
            {!isNewTheme && <View style={[styles.cardAccent, { backgroundColor: editorial.red }]} pointerEvents="none" />}
            <Text style={[styles.cardTitle, { color: colors.textSecondary }, !isNewTheme && styles.editorialLabel]}>You have been removed from</Text>
            <Text style={[styles.pursuitTitle, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, letterSpacing: -0.3 }]}>{pursuitTitle}</Text>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>on {formatDate(removedAt)}</Text>
          </View>

          <View style={[styles.reasonCard, { backgroundColor: colors.surface }, !isNewTheme && styles.editorialCard]}>
            {!isNewTheme && <View style={styles.cardAccent} pointerEvents="none" />}
            <Text style={[styles.reasonLabel, { color: colors.textSecondary }, !isNewTheme && styles.editorialLabel]}>Reason provided by the creator:</Text>
            <View style={[styles.reasonBox, { backgroundColor: isNewTheme ? colors.warningLight : '#fef3c7', borderLeftColor: colors.warning }]}>
              <Text style={[styles.reasonText, { color: colors.textPrimary }]}>{reason}</Text>
            </View>
          </View>

          <View style={[
            styles.noteCard,
            isNewTheme
              ? { backgroundColor: colors.primaryLight, borderLeftColor: primaryColor }
              : { backgroundColor: editorial.carolinaTint, borderLeftColor: editorial.carolina },
          ]}>
            <Text style={styles.noteIcon}>💡</Text>
            <Text style={[styles.noteText, { color: isNewTheme ? colors.textSecondary : editorial.carolinaDeep }]}>
              This pod will now appear in your "Past" pods section. You can still browse other pods and apply to join new teams.
            </Text>
          </View>

          <TouchableOpacity style={[styles.browseButton, { backgroundColor: isNewTheme ? primaryColor : editorial.ink }]} onPress={onBack}>
            <Text style={[styles.browseButtonText, { color: isNewTheme ? colors.background : legacyColors.white }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>Browse Pods</Text>
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
    fontFamily: 'Sora_600SemiBold',
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
    fontFamily: 'Sora_600SemiBold',
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
  // Editorial light-mode card chrome: white surface, hairline border, soft
  // shadow, with a 3px accent stripe down the left edge.
  editorialCard: {
    borderRadius: 14,
    paddingLeft: 22,
    borderWidth: 1,
    borderColor: editorial.hairline,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: editorial.carolina,
  },
  editorialLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: editorial.muted,
    fontFamily: 'InterTight_600SemiBold',
  },
});
