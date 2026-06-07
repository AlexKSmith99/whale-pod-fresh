import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as legacyColors, typography, spacing, borderRadius, shadows, editorial } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface Props {
  pursuitTitle: string;
  memberName: string;
  reason: string;
  leftAt: string;
  onBack: () => void;
}

export default function MemberLeftScreen({ pursuitTitle, memberName, reason, leftAt, onBack }: Props) {
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
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.backText, { color: isNewTheme ? primaryColor : editorial.ink }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[
          styles.title,
          { color: colors.textPrimary },
          !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, letterSpacing: -0.5 },
        ]}>Team Update</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={[
              styles.iconBadge,
              isNewTheme
                ? { backgroundColor: colors.surfaceAlt, borderColor: colors.border }
                : { backgroundColor: editorial.surface, borderColor: editorial.hairline },
            ]}>
              <Ionicons name="exit-outline" size={28} color={isNewTheme ? colors.textSecondary : editorial.muted} />
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }, !isNewTheme && styles.editorialCard]}>
            {!isNewTheme && <View style={styles.cardAccent} pointerEvents="none" />}
            <Text style={[styles.cardTitle, { color: colors.textSecondary }, isNewTheme ? styles.darkLabel : styles.editorialLabel]}>A team member has left</Text>
            <Text style={[styles.memberName, { color: colors.textPrimary }, !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, letterSpacing: -0.3 }]}>{memberName}</Text>
            <Text style={[styles.pursuitText, { color: colors.textSecondary }]}>from {pursuitTitle}</Text>
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>on {formatDate(leftAt)}</Text>
          </View>

          <View style={[styles.reasonCard, { backgroundColor: colors.surface, borderColor: colors.border }, !isNewTheme && styles.editorialCard]}>
            {!isNewTheme && <View style={styles.cardAccent} pointerEvents="none" />}
            <Text style={[styles.reasonLabel, { color: colors.textSecondary }, isNewTheme ? styles.darkLabel : styles.editorialLabel]}>Reason provided by the member</Text>
            <View style={[styles.reasonBox, { backgroundColor: isNewTheme ? colors.warningLight : '#FDF3DC', borderLeftColor: colors.warning }]}>
              <Text style={[styles.reasonText, { color: colors.textPrimary }]}>{reason}</Text>
            </View>
          </View>

          <View style={[
            styles.noteCard,
            isNewTheme
              ? { backgroundColor: colors.surface, borderColor: colors.border }
              : { backgroundColor: editorial.carolinaTint, borderColor: 'transparent' },
          ]}>
            <Text style={[styles.noteText, { color: isNewTheme ? colors.textSecondary : editorial.carolinaDeep }]}>
              This team member has voluntarily left your pod. You may want to review applications or invite new members to fill the spot.
            </Text>
          </View>

          <TouchableOpacity style={[styles.browseButton, { backgroundColor: isNewTheme ? primaryColor : editorial.ink }]} activeOpacity={0.85} onPress={onBack}>
            <Text style={[styles.browseButtonText, { color: isNewTheme ? colors.background : legacyColors.white }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>Back to Notifications</Text>
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
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: legacyColors.white,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
    marginBottom: spacing.sm,
  },
  memberName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  pursuitText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textSecondary,
  },
  reasonCard: {
    backgroundColor: legacyColors.white,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.base,
    marginBottom: spacing.xl,
  },
  noteText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    fontFamily: 'Sora_600SemiBold',
  },
  browseButton: {
    backgroundColor: legacyColors.primary,
    borderRadius: 999,
    padding: spacing.base,
    alignItems: 'center',
  },
  darkLabel: {
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.45)',
  },
  browseButtonText: {
    color: legacyColors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  // Editorial light-mode card chrome: white surface, hairline border, soft
  // shadow, with a 3px Carolina-blue accent stripe down the left edge.
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
