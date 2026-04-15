import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../config/supabase';
import { pursuitService } from '../services/pursuitService';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

interface Props {
  pursuit: any;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export default function EditPursuitScreen({ pursuit, onClose, onSaved, onDeleted }: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);

  const primaryColor = isNewTheme ? colors.accentGreen : '#2D5016';

  const [title, setTitle] = useState(pursuit.title || '');
  const [description, setDescription] = useState(pursuit.description || '');
  const [teamSizeMin, setTeamSizeMin] = useState(String(pursuit.team_size_min || 2));
  const [teamSizeMax, setTeamSizeMax] = useState(String(pursuit.team_size_max || 8));
  const [meetingCadence, setMeetingCadence] = useState(pursuit.meeting_cadence || '');
  const [location, setLocation] = useState(pursuit.location || '');
  const [defaultPicture, setDefaultPicture] = useState(pursuit.default_picture || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleSave = async () => {
    // Validation
    if (!title || !description || !meetingCadence) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }

    if (description.length < 50) {
      Alert.alert('Description Too Short', 'Description must be at least 50 characters');
      return;
    }

    const minSize = parseInt(teamSizeMin);
    const maxSize = parseInt(teamSizeMax);

    if (minSize > maxSize) {
      Alert.alert('Invalid Team Size', 'Minimum team size cannot be greater than maximum');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('pursuits')
        .update({
          title,
          description,
          team_size_min: minSize,
          team_size_max: maxSize,
          meeting_cadence: meetingCadence,
          location,
          default_picture: defaultPicture || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pursuit.id);

      if (error) throw error;

      Alert.alert('Success', 'Pursuit updated successfully!', [
        {
          text: 'OK',
          onPress: () => {
            onSaved();
            onClose();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error updating pursuit:', error);
      Alert.alert('Error', error.message || 'Failed to update pursuit');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Pursuit',
      'Are you sure you want to delete this pursuit? This action cannot be undone. All team members will be removed and all data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await pursuitService.deletePursuit(pursuit.id);
              Alert.alert('Deleted', 'Pursuit deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => {
                    onDeleted();
                    onClose();
                  },
                },
              ]);
            } catch (error: any) {
              console.error('Error deleting pursuit:', error);
              Alert.alert('Error', error.message || 'Failed to delete pursuit');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photo library to set a pod picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    setUploadingImage(true);
    try {
      // Create form data for upload (same pattern as galleryService)
      const formData = new FormData();
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `pod-pictures/${pursuit.id}_${Date.now()}.${fileExt}`;

      formData.append('file', {
        uri: uri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Upload to team-gallery bucket (which we know works)
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/team-gallery/${fileName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('team-gallery')
        .getPublicUrl(fileName);

      setDefaultPicture(urlData.publicUrl);

      Alert.alert('Success', 'Pod picture uploaded! Remember to save your changes.');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    Alert.alert(
      'Remove Picture',
      'Are you sure you want to remove the pod picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setDefaultPicture(''),
        },
      ]
    );
  };

  if (deleting) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Deleting pursuit...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Pursuit</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Title */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Weekly Book Club"
            placeholderTextColor={colors.textTertiary}
            maxLength={100}
          />
        </View>

        {/* Pod Picture */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Pod Picture</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>This picture will appear in the pod header and chat</Text>
          <View style={styles.pictureContainer}>
            {defaultPicture ? (
              <View style={styles.picturePreview}>
                <Image source={{ uri: defaultPicture }} style={styles.pictureImage} />
                <View style={styles.pictureActions}>
                  <TouchableOpacity
                    style={[styles.changePictureButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f3f4f6' }]}
                    onPress={pickImage}
                    disabled={uploadingImage}
                  >
                    <Ionicons name="camera-outline" size={18} color={primaryColor} />
                    <Text style={[styles.changePictureText, { color: primaryColor }]}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.removePictureButton, { backgroundColor: isNewTheme ? colors.errorLight : '#fef2f2' }]}
                    onPress={removeImage}
                    disabled={uploadingImage}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <Text style={[styles.removePictureText, { color: colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addPictureButton, { backgroundColor: isNewTheme ? colors.secondaryLight : '#f5f3ff', borderColor: primaryColor }]}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator color={primaryColor} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color={primaryColor} />
                    <Text style={[styles.addPictureText, { color: primaryColor }]}>Add Pod Picture</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Minimum 50 characters</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your pursuit in detail..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: colors.textTertiary }]}>{description.length} / 50 min</Text>
        </View>

        {/* Team Size */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Team Size</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Current members: {pursuit.current_members_count} (cannot be edited)
          </Text>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Min</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={teamSizeMin}
                onChangeText={setTeamSizeMin}
                keyboardType="numeric"
                placeholder="2"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Max</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={teamSizeMax}
                onChangeText={setTeamSizeMax}
                keyboardType="numeric"
                placeholder="8"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>
        </View>

        {/* Meeting Cadence */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Meeting Cadence <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            value={meetingCadence}
            onChangeText={setMeetingCadence}
            placeholder="e.g., Weekly on Mondays at 7pm"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Location</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g., San Francisco, CA or Remote"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: primaryColor }, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={isNewTheme ? colors.background : '#fff'} />
          ) : (
            <Text style={[styles.saveButtonText, { color: isNewTheme ? colors.background : '#fff' }]}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteButtonText}>Delete Pursuit</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
  },
  saveButton: {
    backgroundColor: '#2D5016',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pictureContainer: {
    marginTop: 8,
  },
  picturePreview: {
    alignItems: 'center',
  },
  pictureImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  pictureActions: {
    flexDirection: 'row',
    gap: 16,
  },
  changePictureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  changePictureText: {
    color: '#2D5016',
    fontSize: 14,
    fontWeight: '600',
  },
  removePictureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  removePictureText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  addPictureButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f3ff',
    borderWidth: 2,
    borderColor: '#2D5016',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    gap: 8,
  },
  addPictureText: {
    color: '#2D5016',
    fontSize: 14,
    fontWeight: '600',
  },
});
