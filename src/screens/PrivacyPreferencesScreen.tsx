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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  privacyService,
  PrivacyPreferences,
  AllowlistValue,
  ALLOWLIST_OPTIONS,
} from '../services/privacyService';
import { colors } from '../theme/designSystem';

interface PrivacyPreferencesScreenProps {
  onBack: () => void;
}

interface AllowlistSectionProps {
  title: string;
  description?: string;
  value: AllowlistValue[];
  onChange: (newValue: AllowlistValue[]) => void;
}

// Reusable component for allowlist checkbox sections
function AllowlistSection({ title, description, value, onChange }: AllowlistSectionProps) {
  const handleToggle = (optionKey: AllowlistValue) => {
    const newValue = privacyService.processAllowlistUpdate(value, optionKey);
    onChange(newValue);
  };

  const isNoneSelected = value.includes('none');

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description && <Text style={styles.sectionDescription}>{description}</Text>}
      <View style={styles.checkboxGroup}>
        {ALLOWLIST_OPTIONS.map((option) => {
          const isChecked = value.includes(option.key);
          const isDisabled = isNoneSelected && option.key !== 'none';

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.checkboxRow,
                isDisabled && styles.checkboxRowDisabled,
              ]}
              onPress={() => handleToggle(option.key)}
              disabled={isDisabled}
            >
              <View style={[
                styles.checkbox,
                isChecked && styles.checkboxChecked,
                isDisabled && styles.checkboxDisabled,
              ]}>
                {isChecked && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
              <Text style={[
                styles.checkboxLabel,
                isDisabled && styles.checkboxLabelDisabled,
                option.key === 'none' && styles.checkboxLabelNone,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<PrivacyPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Privacy Preferences</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Preferences</Text>
        <TouchableOpacity
          onPress={savePreferences}
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.introSection}>
          <View style={styles.introIconContainer}>
            <Ionicons name="shield-checkmark" size={32} color="#10b981" />
          </View>
          <Text style={styles.introTitle}>Control Your Privacy</Text>
          <Text style={styles.introText}>
            Choose who can see different parts of your profile. Check the boxes for each audience you want to allow.
          </Text>
        </View>

        {/* Profile Access */}
        <AllowlistSection
          title="👤 Profile Access"
          description="Who can open and view your profile page. Note: If you're a Pod creator, your base profile is always publicly accessible."
          value={preferences?.profile_access_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('profile_access_allowlist', newValue)}
        />

        {/* Social Links */}
        <AllowlistSection
          title="🔗 Social Media Links"
          description="Who can see your LinkedIn, Instagram, and other social links."
          value={preferences?.socials_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('socials_allowlist', newValue)}
        />

        {/* Reviews */}
        <AllowlistSection
          title="⭐ Teammate Reviews"
          description="Who can see reviews others have written about you."
          value={preferences?.reviews_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('reviews_allowlist', newValue)}
        />

        {/* Pods Tab */}
        <AllowlistSection
          title="🎯 Pods Tab"
          description="Who can see the list of pods you're part of (current and past)."
          value={preferences?.pods_tab_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('pods_tab_allowlist', newValue)}
        />

        {/* Connections */}
        <AllowlistSection
          title="🤝 Connections"
          description="Who can see your list of connections."
          value={preferences?.connections_allowlist || ['everyone']}
          onChange={(newValue) => updateAllowlist('connections_allowlist', newValue)}
        />

        {/* Pod Roster Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏷️ Pod Roster Privacy</Text>
          <Text style={styles.sectionDescription}>
            Control how you appear in pods you join.
          </Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Show me in public pod rosters</Text>
              <Text style={styles.switchDescription}>
                When enabled, you'll appear in the public member list of pods you join.
              </Text>
            </View>
            <Switch
              value={preferences?.pod_public_roster_listed ?? true}
              onValueChange={(value) => updateBoolean('pod_public_roster_listed', value)}
              trackColor={{ false: '#d1d5db', true: '#a78bfa' }}
              thumbColor={preferences?.pod_public_roster_listed ? '#8b5cf6' : '#f4f3f4'}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Allow profile access from roster</Text>
              <Text style={styles.switchDescription}>
                When enabled, others can tap your card in a pod roster to view your profile.
              </Text>
            </View>
            <Switch
              value={preferences?.pod_public_roster_profile_clickable ?? true}
              onValueChange={(value) => updateBoolean('pod_public_roster_profile_clickable', value)}
              trackColor={{ false: '#d1d5db', true: '#a78bfa' }}
              thumbColor={preferences?.pod_public_roster_profile_clickable ? '#8b5cf6' : '#f4f3f4'}
              disabled={!preferences?.pod_public_roster_listed}
            />
          </View>
          {!preferences?.pod_public_roster_listed && (
            <Text style={styles.switchNote}>
              Note: Profile access setting only applies when you're visible in rosters.
            </Text>
          )}
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Understanding Audience Options</Text>
          <View style={styles.helpItem}>
            <Text style={styles.helpBullet}>•</Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>Connections:</Text> Users you've connected with on the app.
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpBullet}>•</Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>Pod members:</Text> Users who share at least one pod with you.
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpBullet}>•</Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>Pod creator when applying:</Text> Creators of pods you've applied to (while your application is pending).
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpBullet}>•</Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>Everyone:</Text> Anyone, including users not logged in.
            </Text>
          </View>
          <View style={styles.helpItem}>
            <Text style={styles.helpBullet}>•</Text>
            <Text style={styles.helpText}>
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  placeholder: {
    width: 60,
  },
  saveButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  saveButtonTextDisabled: {
    color: '#9ca3af',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  introSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  introIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  checkboxGroup: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  checkboxRowDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  checkboxDisabled: {
    borderColor: '#e5e7eb',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  checkboxLabelDisabled: {
    color: '#9ca3af',
  },
  checkboxLabelNone: {
    color: '#ef4444',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  switchNote: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 8,
  },
  helpSection: {
    backgroundColor: '#f0fdf4',
    padding: 20,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 12,
  },
  helpItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  helpBullet: {
    fontSize: 14,
    color: '#10b981',
    marginRight: 8,
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    lineHeight: 18,
  },
  helpBold: {
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});
