/**
 * Settings — full-screen, Pie-style, tailored to Whale Pod ("join the pod").
 *
 * Layout mirrors Pie: big lowercase title, icon rows with chevrons and
 * hairline separators, sub-screens for notifications/share/about, bottom
 * sheets for feedback and account deletion, and a logout pill + version
 * at the bottom. Whale Pod additions: a dark mode toggle row.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  Linking,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { AppAlert } from '../../components/ui/AppAlert';
import KeyboardAwareScreen from '../../components/ui/KeyboardAwareScreen';
import NotificationPrefsScreen from './NotificationPrefsScreen';
import ShareWhalePodScreen from './ShareWhalePodScreen';
import AboutScreen from './AboutScreen';
import { settingsTheme, SUPPORT_EMAIL } from './settingsShared';

interface Props {
  onBack: () => void;
  onAccountDetails: () => void;
  onVisibility: () => void;
  onOpenLegal: (doc: 'terms' | 'privacy' | 'support') => void;
  isAdmin?: boolean;
  onReviewApplications?: () => void;
}

type SubScreen = null | 'notifications' | 'share' | 'about';

export default function SettingsScreen({ onBack, onAccountDetails, onVisibility, onOpenLegal, isAdmin, onReviewApplications }: Props) {
  const { isNewTheme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const t = settingsTheme(isNewTheme);

  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canDelete = deleteConfirmText.trim().toUpperCase() === 'DELETE' && !deleting;
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState(user?.email || '');

  const version = Constants.expoConfig?.version ?? '1.0.0';

  if (subScreen === 'notifications') return <NotificationPrefsScreen onBack={() => setSubScreen(null)} />;
  if (subScreen === 'share') return <ShareWhalePodScreen onBack={() => setSubScreen(null)} />;
  if (subScreen === 'about') return <AboutScreen onBack={() => setSubScreen(null)} onOpenLegal={onOpenLegal} />;

  const sendFeedback = () => {
    const body = encodeURIComponent(`${feedbackText}\n\nfrom: ${feedbackEmail}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('whale pod — idea or bug')}&body=${body}`).catch(() => {});
    setShowFeedback(false);
    setFeedbackText('');
    setTimeout(() => AppAlert.alert('Sent!', "Thanks for helping shape the pod — we're listening and always building."), 600);
  };

  /**
   * Deletes the account for real, in the app.
   *
   * This used to open a mailto to support. App Store guideline 5.1.1(v)
   * requires in-app deletion for any app with account creation and explicitly
   * rejects "email us" as a substitute — so the old flow made the app
   * unsubmittable, and our own privacy policy already claimed this existed.
   *
   * Typing DELETE is deliberate friction. There is no undo, and the sheet it
   * sits in is two taps from the settings list.
   */
  const confirmDeletion = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deleting) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_own_account');
      if (error) throw error;

      // Signing out after the row is gone clears the local session; without
      // this the app holds a token for a user that no longer exists and every
      // subsequent query fails silently.
      await signOut();

      const reassigned = (data as any)?.pods_reassigned ?? 0;
      setShowDelete(false);
      if (reassigned > 0) {
        AppAlert.alert(
          'Account deleted',
          `${reassigned === 1 ? 'One pod you led was' : `${reassigned} pods you led were`} handed to the longest-standing member so nobody lost their work.`
        );
      }
    } catch (e: any) {
      console.error('Account deletion failed:', e?.message);
      AppAlert.alert(
        'Could not delete your account',
        e?.message || 'Something went wrong. Nothing was deleted — please try again.'
      );
    } finally {
      setDeleting(false);
      setDeleteConfirmText('');
    }
  };

  const rows: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; onPress: () => void }[] = [
    { key: 'account', icon: 'person-circle-outline', label: 'account details', sub: 'your profile, photos & info', onPress: onAccountDetails },
    { key: 'notifications', icon: 'notifications-outline', label: 'notifications', onPress: () => setSubScreen('notifications') },
    { key: 'visibility', icon: 'eye-outline', label: 'visibility', sub: 'control who can see what', onPress: onVisibility },
    { key: 'share', icon: 'paper-plane-outline', label: 'share whale pod', onPress: () => setSubScreen('share') },
    { key: 'about', icon: 'information-circle-outline', label: 'about', onPress: () => setSubScreen('about') },
    { key: 'feedback', icon: 'chatbubble-ellipses-outline', label: 'share an idea or bug', onPress: () => setShowFeedback(true) },
    ...(isAdmin && onReviewApplications
      ? [{ key: 'admin', icon: 'shield-checkmark-outline' as keyof typeof Ionicons.glyphMap, label: 'review applications', sub: 'approve waitlisted members', onPress: onReviewApplications }]
      : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.backBtn, isNewTheme && { backgroundColor: '#1F1F1F' }]}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { letterSpacing: -1 }]}>settings</Text>

        {rows.map(row => (
          <TouchableOpacity
            key={row.key}
            style={[styles.row, { borderBottomColor: t.hairline }]}
            onPress={row.onPress}
            activeOpacity={0.6}
          >
            <Ionicons name={row.icon} size={24} color={t.text} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: t.text, fontFamily: t.bodyFont }]}>{row.label}</Text>
              {row.sub ? <Text style={[styles.rowSub, { color: t.muted, fontFamily: t.bodyFont }]}>{row.sub}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.muted} />
          </TouchableOpacity>
        ))}

        {/* Whale Pod extra: theme toggle */}
        <View style={[styles.row, { borderBottomColor: t.hairline }]}>
          <Ionicons name="moon-outline" size={24} color={t.text} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: t.text, fontFamily: t.bodyFont }]}>dark mode</Text>
          </View>
          <Switch
            value={isNewTheme}
            onValueChange={toggleTheme}
            trackColor={{ false: '#D6D3CC', true: t.accent }}
            thumbColor={isNewTheme ? '#555555' : '#f4f3f4'}
          />
        </View>

        {/* Danger zone */}
        <TouchableOpacity
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={() => setShowDelete(true)}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={24} color={t.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: t.danger, fontFamily: t.bodyFont }]}>delete account</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.logoutPill, { backgroundColor: t.pill }]} onPress={signOut} activeOpacity={0.85}>
          <Text style={[styles.logoutText, { color: t.pillText, fontFamily: t.bodyFont }]}>logout</Text>
        </TouchableOpacity>
        <Text style={[styles.version, { color: t.muted, fontFamily: t.bodyFont }]}>version {version}</Text>
      </ScrollView>

      {/* ── share an idea or bug — bottom sheet ───────────────────────── */}
      <Modal visible={showFeedback} transparent animationType="slide" onRequestClose={() => setShowFeedback(false)}>
        <KeyboardAwareScreen mode="pinned" style={styles.sheetWrap}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowFeedback(false)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: isNewTheme ? '#161616' : '#FFFFFF' }, !isNewTheme && { borderWidth: 1, borderColor: t.hairline }]}>
            <Text style={[styles.sheetTitle, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { letterSpacing: -0.5 }]}>share an idea or bug</Text>
            <Text style={[styles.sheetCopy, { color: t.textSecondary, fontFamily: t.bodyFont }]}>
              something feel off? got a genius idea? we're listening and always building.
            </Text>
            <TextInput
              style={[styles.sheetTextarea, { backgroundColor: t.cardAlt, color: t.text, borderColor: t.hairline, fontFamily: t.bodyFont }]}
              placeholder="what's the idea or issue?"
              placeholderTextColor={t.muted}
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              textAlignVertical="top"
            />
            <View style={[styles.sheetEmailBox, { backgroundColor: t.cardAlt, borderColor: t.hairline }]}>
              <Text style={[styles.sheetEmailLabel, { color: t.muted, fontFamily: t.bodyFont }]}>your email</Text>
              <TextInput
                style={[styles.sheetEmailInput, { color: t.text, fontFamily: t.bodyFont }]}
                value={feedbackEmail}
                onChangeText={setFeedbackEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <View style={styles.sheetButtonRow}>
              <TouchableOpacity style={[styles.sheetPill, { backgroundColor: t.pill }]} onPress={() => setShowFeedback(false)} activeOpacity={0.85}>
                <Text style={[styles.sheetPillText, { color: t.pillText, fontFamily: t.bodyFont }]}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetPill, { backgroundColor: t.accent, opacity: feedbackText.trim() ? 1 : 0.4 }]}
                onPress={sendFeedback}
                disabled={!feedbackText.trim()}
                activeOpacity={0.85}
              >
                <Text style={[styles.sheetPillText, { color: isNewTheme ? '#000000' : '#FFFFFF', fontFamily: t.bodyFont }]}>send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareScreen>
      </Modal>

      {/* ── delete account — bottom sheet ──────────────────────────────── */}
      <Modal visible={showDelete} transparent animationType="slide" onRequestClose={() => setShowDelete(false)}>
        <View style={styles.sheetWrap}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowDelete(false)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: isNewTheme ? '#161616' : '#FFFFFF' }, !isNewTheme && { borderWidth: 1, borderColor: t.hairline }]}>
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: t.text, fontFamily: t.titleFont }, !isNewTheme && { letterSpacing: -0.5 }]}>whoa, big decision!</Text>
              <TouchableOpacity onPress={() => setShowDelete(false)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.sheetClose, { backgroundColor: t.cardAlt }]}>
                <Ionicons name="close" size={20} color={t.text} />
              </TouchableOpacity>
            </View>
            {/* Specific about what goes, because the old copy promised
                "no coming back" without saying what that covered. */}
            <Text style={[styles.sheetCopy, { color: t.textSecondary, fontFamily: t.bodyFont, marginTop: 12 }]}>
              this deletes your profile, photos, messages, applications and saved pods. it can't be undone.
            </Text>
            <Text style={[styles.sheetCopy, { color: t.textSecondary, fontFamily: t.bodyFont, marginTop: 10 }]}>
              pods you lead are handed to the longest-standing member, so nobody else loses their work. pods where you're the only member are deleted with you.
            </Text>

            <TextInput
              style={[
                styles.deleteConfirmInput,
                {
                  borderColor: t.hairline,
                  color: t.text,
                  backgroundColor: isNewTheme ? '#0A0A0A' : '#FAF9F6',
                  fontFamily: t.bodyFont,
                },
              ]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="type DELETE to confirm"
              placeholderTextColor={t.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />

            <TouchableOpacity
              style={[
                styles.deletePill,
                { backgroundColor: canDelete ? '#DC2626' : t.cardAlt },
              ]}
              onPress={confirmDeletion}
              activeOpacity={0.85}
              disabled={!canDelete}
              accessibilityRole="button"
              accessibilityLabel="Permanently delete my account"
            >
              {deleting ? (
                <ActivityIndicator color={canDelete ? '#FFFFFF' : t.textSecondary} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color={canDelete ? '#FFFFFF' : t.textSecondary} />
                  <Text style={[styles.sheetPillText, { color: canDelete ? '#FFFFFF' : t.textSecondary, fontFamily: t.bodyFont }]}>
                    delete my account
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  backBtn: {
    marginTop: 58,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 44,
    marginTop: 24,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 18 },
  rowSub: { fontSize: 13, marginTop: 2 },
  logoutPill: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  logoutText: { fontSize: 17 },
  version: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 14,
  },
  // Bottom sheets
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 44,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 26 },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCopy: { fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 18 },
  sheetTextarea: {
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 15,
    marginBottom: 14,
  },
  sheetEmailBox: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 22,
  },
  sheetEmailLabel: { fontSize: 12, marginBottom: 2 },
  sheetEmailInput: { fontSize: 15, padding: 0 },
  sheetButtonRow: { flexDirection: 'row', gap: 14 },
  sheetPill: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPillText: { fontSize: 16 },
  deleteConfirmInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    letterSpacing: 1,
    marginTop: 18,
  },
  deletePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 999,
    marginTop: 10,
  },
});
