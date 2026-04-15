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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import GradientBackground from '../components/ui/GradientBackground';
import { colors as legacyColors } from '../theme/designSystem';

interface EditProfileScreenProps {
  onBack: () => void;
}

export default function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Profile fields
  const [name, setName] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [profilePictures, setProfilePictures] = useState<string[]>([]);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [hometown, setHometown] = useState('');
  const [college, setCollege] = useState('');
  const [work, setWork] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [facebook, setFacebook] = useState('');
  const [github, setGithub] = useState('');
  const [portfolio, setPortfolio] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setName(data.name || '');
        setProfilePicture(data.profile_picture || '');
        setProfilePictures(data.profile_pictures || (data.profile_picture ? [data.profile_picture] : []));
        setAge(data.age?.toString() || '');
        setGender(data.gender || '');
        setHometown(data.hometown || '');
        setCollege(data.college || '');
        setWork(data.work || '');
        setBio(data.bio || '');
        setInstagram(data.instagram || '');
        setLinkedin(data.linkedin || '');
        setFacebook(data.facebook || '');
        setGithub(data.github || '');
        setPortfolio(data.portfolio_website || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to access your photos/camera');
        return;
      }

      const remaining = 6 - profilePictures.length;
      if (remaining <= 0) {
        Alert.alert('Maximum reached', 'You can upload up to 6 photos.');
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.5,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            quality: 0.5,
          });

      if (!result.canceled && result.assets.length > 0) {
        setUploading(true);
        for (const asset of result.assets) {
          await uploadImage(asset.uri);
        }
        setUploading(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;

    try {
      const formData = new FormData();
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      formData.append('file', {
        uri: uri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Upload directly to Supabase Storage
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/profile-pictures/${fileName}`,
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
        .from('profile-pictures')
        .getPublicUrl(fileName);

      const newUrl = urlData.publicUrl;
      setProfilePictures(prev => [...prev, newUrl]);
      if (!profilePicture) setProfilePicture(newUrl);
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload photo: ' + error.message);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          profile_picture: profilePictures[0] || profilePicture || null,
          profile_pictures: profilePictures,
          age: age ? parseInt(age) : null,
          gender: gender || null,
          hometown: hometown || null,
          college: college || null,
          work: work || null,
          bio: bio || null,
          instagram: instagram || null,
          linkedin: linkedin || null,
          facebook: facebook || null,
          github: github || null,
          portfolio_website: portfolio || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated!', [
        { text: 'OK', onPress: onBack }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <GradientBackground style={styles.loadingContainer}>
        <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {isNewTheme && <GrainTexture opacity={0.06} />}
        <ActivityIndicator size="large" color={isNewTheme ? colors.accentGreen : legacyColors.primary} />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground style={styles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <Text style={[styles.saveButtonText, { color: isNewTheme ? colors.accentGreen : legacyColors.primary }]}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Photos</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {profilePictures.map((pic, i) => (
              <View key={i} style={{ width: (Dimensions.get('window').width - 56) / 3, aspectRatio: 0.85, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F2F0EB' }}>
                <Image source={{ uri: pic }} style={{ width: '100%', height: '100%' }} />
                <TouchableOpacity
                  style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setProfilePictures(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
                {i === 0 && (
                  <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: '#2D5016', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, color: '#fff', fontWeight: '600' }}>Default</Text>
                  </View>
                )}
              </View>
            ))}
            {profilePictures.length < 6 && (
              <TouchableOpacity
                style={{ width: (Dimensions.get('window').width - 56) / 3, aspectRatio: 0.85, borderRadius: 10, backgroundColor: '#F2F0EB', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D6D3CC', borderStyle: 'dashed' }}
                onPress={() => pickImage(false)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#8A8A85" />
                ) : (
                  <Ionicons name="add" size={24} color="#8A8A85" />
                )}
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F2F0EB', marginBottom: 8 }}
            onPress={() => pickImage(true)}
            disabled={uploading}
          >
            <Ionicons name="camera-outline" size={16} color="#1B1B18" />
            <Text style={{ fontSize: 14, color: '#1B1B18' }}>Take Photo</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="e.g., John Smith"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Age</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="e.g., 25"
            placeholderTextColor={colors.textTertiary}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Gender</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="e.g., Male, Female, Non-binary"
            placeholderTextColor={colors.textTertiary}
            value={gender}
            onChangeText={setGender}
          />

          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Location</Text>

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Hometown</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="e.g., San Francisco, CA"
            placeholderTextColor={colors.textTertiary}
            value={hometown}
            onChangeText={setHometown}
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>College</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="e.g., NYU, UCLA"
            placeholderTextColor={colors.textTertiary}
            value={college}
            onChangeText={setCollege}
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Work</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="e.g., Software Engineer at Google"
            placeholderTextColor={colors.textTertiary}
            value={work}
            onChangeText={setWork}
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="Tell us about yourself..."
            placeholderTextColor={colors.textTertiary}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
          />

          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Social Links</Text>

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Instagram</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="@username or full URL"
            placeholderTextColor={colors.textTertiary}
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>LinkedIn</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="linkedin.com/in/username"
            placeholderTextColor={colors.textTertiary}
            value={linkedin}
            onChangeText={setLinkedin}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Facebook</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="facebook.com/username"
            placeholderTextColor={colors.textTertiary}
            value={facebook}
            onChangeText={setFacebook}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>GitHub</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="github.com/username"
            placeholderTextColor={colors.textTertiary}
            value={github}
            onChangeText={setGithub}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: isNewTheme ? 'JuliusSansOne_400Regular' : undefined }]}>Portfolio Website</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontFamily: isNewTheme ? 'KleeOne_400Regular' : undefined }]}
            placeholder="https://yourwebsite.com"
            placeholderTextColor={colors.textTertiary}
            value={portfolio}
            onChangeText={setPortfolio}
            autoCapitalize="none"
          />
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 60, 
    paddingBottom: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb' 
  },
  backButton: { padding: 8 },
  backButtonText: { fontSize: 16, color: '#0ea5e9', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  saveButton: { padding: 8 },
  saveButtonText: { fontSize: 16, color: '#0ea5e9', fontWeight: '600' },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginTop: 20, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 8 },
  input: { 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    padding: 12, 
    fontSize: 16, 
    marginBottom: 16, 
    backgroundColor: '#fff' 
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  previewImage: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    marginBottom: 16, 
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#0ea5e9',
  },
  placeholderImage: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    backgroundColor: '#e5e7eb', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  placeholderText: { fontSize: 12, color: '#9ca3af' },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
