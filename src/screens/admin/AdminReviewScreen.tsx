/**
 * AdminReviewScreen — admin-only review of waitlist applicants.
 *
 * Part of the MAIN app, so it uses the app's runtime light/dark theme
 * (editorial light / Pie dark) via useTheme() + getThemedStyles — NOT the
 * teal apply-flow palette. Mirrors ProfileScreen's theming, header pattern,
 * WhaleLoader, GrainTexture, and AppAlert conventions.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { notificationService } from '../../services/notificationService';
import { useTheme } from '../../theme/ThemeContext';
import { getThemedStyles } from '../../theme/themedStyles';
import { colors as legacyColors, spacing, borderRadius, editorial } from '../../theme/designSystem';
import WhaleLoader from '../../components/ui/WhaleLoader';
import GrainTexture from '../../components/ui/GrainTexture';
import { AppAlert } from '../../components/ui/AppAlert';

interface Applicant {
  id: string;
  name?: string | null;
  username?: string | null;
  age?: number | string | null;
  building?: string | null;
  looking_for?: string | null;
  profile_pictures?: string[] | null;
  profile_picture?: string | null;
  selfie_url?: string | null;
  applied_at?: string | null;
}

export default function AdminReviewScreen({ onBack }: { onBack: () => void }) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const accent = isNewTheme ? colors.accentGreen : colors.primary;
  const onAccentText = isNewTheme ? colors.background : colors.white;
  const destructive = isNewTheme ? colors.error : editorial.red;

  const titleFont = isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold';
  const bodyFont = isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold';

  useEffect(() => {
    loadApplicants();
  }, []);

  const loadApplicants = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, name, username, age, building, looking_for, profile_pictures, profile_picture, selfie_url, applied_at'
        )
        .eq('application_status', 'pending')
        .order('applied_at', { ascending: true });

      if (error) throw error;
      setApplicants((data as Applicant[]) || []);
    } catch (error) {
      console.error('Error loading applications:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const setProcessingFor = (id: string, on: boolean) => {
    setProcessing(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setProcessingFor(id, true);
    try {
      const { error } = await supabase.rpc('review_application', {
        target_user: id,
        decision,
      });
      if (error) throw error;

      try {
        if (decision === 'approved') {
          await notificationService.notifyMembershipApproved(id);
        } else {
          await notificationService.notifyMembershipRejected(id);
        }
      } catch (notifyError) {
        console.warn('Notification failed:', notifyError);
      }

      setApplicants(prev => prev.filter(a => a.id !== id));
      AppAlert.alert(
        decision === 'approved' ? 'Approved' : 'Rejected',
        decision === 'approved'
          ? 'Applicant approved and notified.'
          : 'Applicant rejected and notified.'
      );
    } catch (e: any) {
      AppAlert.alert('Error', e.message);
    } finally {
      setProcessingFor(id, false);
    }
  };

  const handleApprove = (applicant: Applicant) => {
    runDecision(applicant.id, 'approved');
  };

  const handleReject = (applicant: Applicant) => {
    AppAlert.alert(
      'Reject applicant?',
      `${applicant.name || applicant.username || 'This applicant'} will be rejected and notified. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => runDecision(applicant.id, 'rejected'),
        },
      ]
    );
  };

  const formatDate = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderCard = (applicant: Applicant) => {
    const isProcessing = processing.has(applicant.id);
    const pics: string[] =
      applicant.profile_pictures && applicant.profile_pictures.length > 0
        ? applicant.profile_pictures
        : applicant.profile_picture
        ? [applicant.profile_picture]
        : [];
    const appliedDate = formatDate(applicant.applied_at);

    const detailRows = (
      [
        { label: 'Building', value: applicant.building },
        { label: 'Looking for', value: applicant.looking_for },
      ] as { label: string; value?: string | null }[]
    ).filter(r => r.value);

    return (
      <View key={applicant.id} style={[styles.card, themedStyles.card]}>
        {/* Photo thumbnails */}
        {pics.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbRow}
          >
            {pics.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.thumb} resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        {/* Identity */}
        <View style={styles.identityRow}>
          <Text style={[styles.name, themedStyles.textPrimary, { fontFamily: titleFont, letterSpacing: -0.3 }]}>
            {applicant.name || 'Unnamed applicant'}
          </Text>
          {!!applicant.username && (
            <Text style={[styles.username, themedStyles.textSecondary, { fontFamily: bodyFont }]}>
              @{applicant.username}
            </Text>
          )}
          {applicant.age != null && applicant.age !== '' && (
            <Text style={[styles.age, themedStyles.textTertiary, { fontFamily: bodyFont }]}>
              {String(applicant.age)}
            </Text>
          )}
        </View>

        {/* Selfie */}
        {!!applicant.selfie_url && (
          <View style={styles.selfieBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textTertiary, fontFamily: bodyFont }]}>
              SELFIE
            </Text>
            <Image source={{ uri: applicant.selfie_url }} style={styles.selfie} resizeMode="cover" />
          </View>
        )}

        {/* Detail rows */}
        {detailRows.map(row => (
          <View key={row.label} style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textTertiary, fontFamily: bodyFont }]}>
              {row.label.toUpperCase()}
            </Text>
            <Text style={[styles.fieldValue, themedStyles.bodyText, { fontFamily: bodyFont }]}>
              {row.value}
            </Text>
          </View>
        ))}

        {!!appliedDate && (
          <Text style={[styles.appliedText, { color: colors.textTertiary, fontFamily: bodyFont }]}>
            Applied {appliedDate}
          </Text>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: accent }, isProcessing && styles.actionDisabled]}
            onPress={() => handleApprove(applicant)}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionText, { color: onAccentText, fontFamily: bodyFont }]}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionOutline,
              { borderColor: destructive },
              isProcessing && styles.actionDisabled,
            ]}
            onPress={() => handleReject(applicant)}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionText, { color: destructive, fontFamily: bodyFont }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, themedStyles.container]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* Header */}
      <View style={[styles.header, themedStyles.surface, !isNewTheme && { backgroundColor: editorial.bg, borderWidth: 0, shadowOpacity: 0, elevation: 0 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={isNewTheme ? colors.textPrimary : editorial.ink} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              isNewTheme
                ? { color: colors.textPrimary, fontFamily: 'Sora_700Bold' }
                : { color: editorial.ink, fontFamily: 'PlayfairDisplay_700Bold' },
            ]}
          >
            Applications
          </Text>
          <View style={styles.headerCount}>
            {!loading && !loadError && (
              <Text style={[styles.headerCountText, { color: isNewTheme ? colors.accentGreen : colors.primary, fontFamily: bodyFont }]}>
                {applicants.length}
              </Text>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <WhaleLoader size={56} />
        </View>
      ) : loadError ? (
        <View style={styles.centerFill}>
          <Ionicons name="cloud-offline-outline" size={56} color={colors.textTertiary} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, themedStyles.emptyText, !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 }]}>
            Couldn't load applications
          </Text>
          <Text style={[styles.emptyHint, themedStyles.emptySubtext, { fontFamily: bodyFont }]}>
            This area may not be set up yet. Please try again later.
          </Text>
        </View>
      ) : applicants.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="checkmark-done-outline" size={56} color={colors.textTertiary} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, themedStyles.emptyText, !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 }]}>
            No pending applications.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {applicants.map(renderCard)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: legacyColors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: spacing.base,
    paddingHorizontal: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 26,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerCount: {
    minWidth: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerCountText: {
    fontSize: 18,
  },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: 8,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    marginBottom: spacing.base,
  },
  thumbRow: {
    gap: 8,
    paddingBottom: spacing.md,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
    fontSize: 20,
  },
  username: {
    fontSize: 14,
  },
  age: {
    fontSize: 14,
  },
  selfieBlock: {
    marginTop: spacing.md,
  },
  selfie: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginTop: 6,
  },
  fieldBlock: {
    marginTop: spacing.md,
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 15,
    lineHeight: 21,
  },
  appliedText: {
    fontSize: 12,
    marginTop: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionText: {
    fontSize: 15,
  },
});
