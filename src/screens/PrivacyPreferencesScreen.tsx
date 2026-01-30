import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  privacyService,
  PrivacyPreferences,
  AllowlistValue,
  ALLOWLIST_OPTIONS,
} from '../services/privacyService';
import { colors as legacyColors, typography, spacing, borderRadius } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

interface PrivacyPreferencesScreenProps {
  onBack: () => void;
}

interface AllowlistSectionProps {
  title: string;
  description?: string;
  value: AllowlistValue[];
  onChange: (newValue: AllowlistValue[]) => void;
  colors: any;
  accentColor: string;
  isNewTheme: boolean;
}

// Reusable component for allowlist checkbox sections
function AllowlistSection({ title, description, value, onChange, colors, accentColor, isNewTheme }: AllowlistSectionProps) {
  const handleToggle = (optionKey: AllowlistValue) => {
    const newValue = privacyService.processAllowlistUpdate(value, optionKey);
    onChange(newValue);
  };

  const isNoneSelected = value.includes('none');

  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {description && <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{description}</Text>}
      <View style={styles.checkboxGroup}>
        {ALLOWLIST_OPTIONS.map((option) => {
          const isChecked = value.includes(option.key);
          const isDisabled = isNoneSelected && option.key !== 'none';

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.checkboxRow,
                { backgroundColor: colors.backgroundSecondary },
                isDisabled && styles.checkboxRowDisabled,
              ]}
              onPress={() => handleToggle(option.key)}
              disabled={isDisabled}
            >
              <View style={[
                styles.checkbox,
                { borderColor: colors.border },
                isChecked && { backgroundColor: accentColor, borderColor: accentColor },
                isDisabled && { borderColor: colors.disabled },
              ]}>
                {isChecked && (
                  <Ionicons name="checkmark" size={16} color={isNewTheme ? colors.background : colors.white} />
                )}
              </View>
              <Text style={[
                styles.checkboxLabel,
                { color: colors.textPrimary },
                isDisabled && { color: colors.textTertiary },
                option.key === 'none' && { color: colors.error },
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function PrivacyPreferencesScreen({ onBack }: PrivacyPreferencesScreenProps) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<PrivacyPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const accentColor = isNewTheme ? colors.accentGreen : legacyColors.primary;

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const prefs = await privacyService.getPreferences(user.id);
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load privacy preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user || !preferences) return;

    setSaving(true);
    try {
      await privacyService.updatePreferences(user.id, preferences);
      setHasChanges(false);
      Alert.alert('Success', 'Privacy preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save privacy preferences');
    } finally {
      setSaving(false);
    }
  };

  const updateAllowlist = (
    field: 'profile_access_allowlist' | 'socials_allowlist' | 'reviews_allowlist' | 'pods_tab_allowlist' | 'connections_allowlist',
    newValue: AllowlistValue[]
  ) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [field]: newValue });
    setHasChanges(true);
  };

  const updateBoolean = (
    field: 'pod_public_roster_listed' | 'pod_public_roster_profile_clickable',
    newValue: boolean
  ) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [field]: newValue });
    setHasChanges(true);
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save them before leaving?',
        [
          { text: 'Discard', style: 'destructive', onPress: onBack },
          { text: 'Save', onPress: async () => {
            await savePreferences();
            onBack();
          }},
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      onBack();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Privacy Preferences</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Privacy Preferences</Text>
        <TouchableOpacity
          onPress={savePreferences}
          style={[
            styles.saveButton,
            { backgroundColor: accentColor },
            !hasChanges && { backgroundColor: colors.disabled }
          ]}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={isNewTheme ? colors.background : colors.white} />
          ) : (
            <Text style={[
              styles.saveButtonText,
              { color: isNewTheme ? colors.background : colors.white },
              !hasChanges && { color: colors.disabledText }
            ]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={[styles.introSection, { backgroundColor: colors.surface }]}>
          <View style={[styles.introIconContainer, { backgroundColor: isNewTheme ? colors.successLight : '#d1fae5' }]}>
            <Ionicons name="shield-checkmark" size={32} color={colors.success} />
          </View>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>Control Your Privacy</Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Choose who can see different parts of your profile. Check the boxes for each audience you want to allow.
          </Text>
        </View>

        {/* Profile Access */}
        <AllowlistSection
          title="Profile Access"
          description="Who can open and view your profile page. Note: If you're a Pod creator, your base profile is always publicly accessible."
          value={preferences?.profile_access_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('profile_access_allowlist', newValue)}
          colors={colors}
          accentColor={accentColor}
          isNewTheme={isNewTheme}
        />

        {/* Social Links */}
        <AllowlistSection
          title="Social Media Links"
          description="Who can see your LinkedIn, Instagram, and other social links."
          value={preferences?.socials_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('socials_allowlist', newValue)}
          colors={colors}
          accentColor={accentColor}
          isNewTheme={isNewTheme}
        />

        {/* Reviews */}
        <AllowlistSection
          title="Teammate Reviews"
          description="Who can see reviews others have written about you."
          value={preferences?.reviews_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('reviews_allowlist', newValue)}
          colors={colors}
          accentColor={accentColor}
          isNewTheme={isNewTheme}
        />

        {/* Pods Tab */}
        <AllowlistSection
          title="Pods Tab"
          description="Who can see the list of pods you're part of (current and past)."
          value={preferences?.pods_tab_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('pods_tab_allowlist', newValue)}
          colors={colors}
          accentColor={accentColor}
          isNewTheme={isNewTheme}
        />

        {/* Connections */}
        <AllowlistSection
          title="Connections"
          description="Who can see your list of connections."
          value={preferences?.connections_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('connections_allowlist', newValue)}
          colors={colors}
          accentColor={accentColor}
          isNewTheme={isNewTheme}
        />

        {/* Pod Roster Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pod Roster Privacy</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Control how you appear in pods you join.
          </Text>

          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchInfo}>
              <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>Show me in public pod rosters</Text>
              <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                When enabled, you'll appear in the public member list of pods you join.
              </Text>
            </View>
            <Switch
              value={preferences?.pod_public_roster_listed ?? true}
              onValueChange={(value) => updateBoolean('pod_public_roster_listed', value)}
              trackColor={{ false: colors.border as string, true: accentColor }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.border as string}
            />
          </View>

          <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
            <View style={styles.switchInfo}>
              <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>Allow profile access from roster</Text>
              <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                When enabled, others can tap your card in a pod roster to view your profile.
              </Text>
            </View>
            <Switch
              value={preferences?.pod_public_roster_profile_clickable ?? true}
              onValueChange={(value) => updateBoolean('pod_public_roster_profile_clickable', value)}
              trackColor={{ false: colors.border as string, true: accentColor }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.border as string}
              disabled={!preferences?.pod_public_roster_listed}
            />
          </View>
          {!preferences?.pod_public_roster_listed && (
            <Text style={[styles.switchNote, { color: colors.textTertiary }]}>
              Note: Profile access setting only applies when you're visible in rosters.
            </Text>
          )}
        </View>

        {/* Help Section */}
        <View style={[styles.helpSection, { backgroundColor: isNewTheme ? colors.successLight : '#f0fdf4', borderLeftColor: colors.success }]}>
          <Text style={[styles.helpTitle, { color: isNewTheme ? colors.success : '#065f46' }]}>Understanding Audience Options</Text>
          <View style={styles.helpItem}>
            <Text style={[styles.helpBullet, { color: colors.success }]}>*</Text>
            <Text style={[styles.helpText, { color: colors.textPrimary }]}>
              <Text style={styles.helpBold}>Connections:</Text> Users you've connected with on the app.
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={[styles.helpBullet, { color: colors.success }]}>*</Text>
            <Text style={[styles.helpText, { color: colors.textPrimary }]}>
              <Text style={styles.helpBold}>Pod members:</Text> Users who share at least one pod with you.
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={[styles.helpBullet, { color: colors.success }]}>*</Text>
            <Text style={[styles.helpText, { color: colors.textPrimary }]}>
              <Text style={styles.helpBold}>Pod creator when applying:</Text> Creators of pods you've applied to (while your application is pending).
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={[styles.helpBullet, { color: colors.success }]}>*</Text>
            <Text style={[styles.helpText, { color: colors.textPrimary }]}>
              <Text style={styles.helpBold}>Everyone:</Text> Anyone, including users not logged in.
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={[styles.helpBullet, { color: colors.success }]}>*</Text>
            <Text style={[styles.helpText, { color: colors.textPrimary }]}>
              <Text style={styles.helpBold}>Visible to no one:</Text> Completely private (only you can see).
            </Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  placeholder: {
    width: 60,
  },
  saveButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
  },
  content: {
    flex: 1,
  },
  introSection: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  introIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  introTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  introText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.base,
    lineHeight: 18,
  },
  checkboxGroup: {
    gap: spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.base,
  },
  checkboxRowDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
  },
  switchInfo: {
    flex: 1,
    marginRight: spacing.base,
  },
  switchLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  switchDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  switchNote: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  helpSection: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  helpTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  helpItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  helpBullet: {
    fontSize: typography.fontSize.sm,
    marginRight: spacing.sm,
    fontWeight: typography.fontWeight.bold,
  },
  helpText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    lineHeight: 18,
  },
  helpBold: {
    fontWeight: typography.fontWeight.semibold,
  },
  bottomPadding: {
    height: 40,
  },
});
