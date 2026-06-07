import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { editorial } from '../../theme/designSystem';

interface Props {
  value?: string | null;             // Current cover image URL
  onChange: (url: string | null) => void;
  height?: number;
  /** Optional label/placeholder when empty */
  placeholderText?: string;
}

/**
 * Cover-image picker for pods.
 * - Tap empty → action sheet (Camera / Library / Cancel)
 * - Tap existing image → action sheet (Replace / Remove / Cancel)
 * - Uploads to the `pod-covers` Supabase bucket under `<userId>/<timestamp>.jpg`
 */
export default function PodCoverImagePicker({ value, onChange, height = 220, placeholderText }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const [uploading, setUploading] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const accent = isNewTheme ? colors.accentGreen : editorial.carolina;
  const surface = isNewTheme ? colors.surfaceAlt : '#F2F0EB';
  const inkOnAccent = isNewTheme ? '#000000' : '#FFFFFF';
  const bodyFont = isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold';

  async function pickFromLibrary() {
    setShowActions(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('photo access needed', 'enable photo library access in settings to add a cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) await upload(result.assets[0].uri);
  }

  async function pickFromCamera() {
    setShowActions(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('camera access needed', 'enable camera access in settings to snap a pic.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) await upload(result.assets[0].uri);
  }

  async function upload(uri: string) {
    if (!user) return;
    setUploading(true);
    try {
      const res = await fetch(uri);
      const arrayBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const ext = (uri.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const { error: uploadErr } = await supabase
        .storage
        .from('pod-covers')
        .upload(path, bytes, { contentType, upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from('pod-covers').getPublicUrl(path);
      onChange(pub.publicUrl);
    } catch (err: any) {
      console.error('cover upload failed', err);
      Alert.alert('upload failed', err?.message || 'try again in a sec.');
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    setShowActions(false);
    onChange(null);
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.frame, { height, backgroundColor: surface, borderColor: colors.border }]}
        activeOpacity={0.85}
        onPress={() => setShowActions(true)}
        disabled={uploading}
      >
        {value ? (
          <Image source={{ uri: value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <View style={[styles.cameraBadge, { backgroundColor: accent }]}>
              <Ionicons name="camera" size={22} color={inkOnAccent} />
            </View>
            <Text style={[styles.placeholderText, { color: colors.textSecondary, fontFamily: bodyFont }]}>
              {placeholderText || 'add a cover photo'}
            </Text>
          </View>
        )}

        {value && !uploading && (
          <View style={[styles.editPill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
            <Ionicons name="create-outline" size={14} color="#FFFFFF" />
            <Text style={styles.editPillText}>edit</Text>
          </View>
        )}

        {uploading && (
          <View style={[StyleSheet.absoluteFill, styles.uploadingOverlay]}>
            <ActivityIndicator color={accent} size="large" />
            <Text style={styles.uploadingText}>uploading…</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowActions(false)}
        >
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary, fontFamily: bodyFont }]}>cover photo</Text>
            <TouchableOpacity style={styles.sheetRow} onPress={pickFromCamera}>
              <Ionicons name="camera" size={20} color={colors.textPrimary} />
              <Text style={[styles.sheetRowText, { color: colors.textPrimary, fontFamily: bodyFont }]}>take a pic</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetRow} onPress={pickFromLibrary}>
              <Ionicons name="images" size={20} color={colors.textPrimary} />
              <Text style={[styles.sheetRowText, { color: colors.textPrimary, fontFamily: bodyFont }]}>pick from library</Text>
            </TouchableOpacity>
            {value && (
              <TouchableOpacity style={styles.sheetRow} onPress={clear}>
                <Ionicons name="trash" size={20} color={colors.error} />
                <Text style={[styles.sheetRowText, { color: colors.error, fontFamily: bodyFont }]}>remove cover</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.sheetCancel, { backgroundColor: colors.surfaceAlt }]}
              onPress={() => setShowActions(false)}
            >
              <Text style={[styles.sheetCancelText, { color: colors.textPrimary, fontFamily: bodyFont }]}>nvm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  cameraBadge: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  editPill: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  editPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  uploadingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  uploadingText: { color: '#FFFFFF', fontSize: 13 },
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 18, paddingBottom: 30, paddingHorizontal: 20,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, fontFamily: 'Sora_600SemiBold' },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16,
  },
  sheetRowText: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  sheetCancel: { marginTop: 10, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  sheetCancelText: { fontSize: 15, fontWeight: '600' },
});
