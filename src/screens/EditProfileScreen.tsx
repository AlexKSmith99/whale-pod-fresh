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
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

interface EditProfileScreenProps {
  onBack: () => void;
}

export default function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Profile fields
  const [name, setName] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [hometown, setHometown] = useState('');
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
        setAge(data.age?.toString() || '');
        setGender(data.gender || '');
        setHometown(data.hometown || '');
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
      // Request permissions
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to access your photos/camera');
        return;
      }

      // Launch picker
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
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
    if (!user) return;

    setUploading(true);
    try {
      // Create form data
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

      setProfilePicture(urlData.publicUrl);
      Alert.alert('Success', 'Photo uploaded!');
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload photo: ' + error.message);
    } finally {
      setUploading(false);
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
          profile_picture: profilePicture || null,
          age: age ? parseInt(age) : null,
          gender: gender || null,
          hometown: hometown || null,
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>No photo yet</Text>
            </View>
          )}

          <View style={styles.photoButtons}>
            <TouchableOpacity 
              style={styles.photoButton}
              onPress={() => pickImage(true)}
              disabled={uploading}
            >
              <Text style={styles.photoButtonText}>
                {uploading ? 'Uploading...' : '📷 Take Photo'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.photoButton}
              onPress={() => pickImage(false)}
              disabled={uploading}
            >
              <Text style={styles.photoButtonText}>
                {uploading ? 'Uploading...' : '🖼️ Choose Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Basic Info</Text>
          
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., John Smith"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 25"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Gender</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Male, Female, Non-binary"
            value={gender}
            onChangeText={setGender}
          />

          <Text style={styles.label}>Hometown</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., San Francisco, CA"
            value={hometown}
            onChangeText={setHometown}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about yourself..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.sectionTitle}>Social Links</Text>

          <Text style={styles.label}>Instagram</Text>
          <TextInput
            style={styles.input}
            placeholder="@username or full URL"
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
          />

          <Text style={styles.label}>LinkedIn</Text>
          <TextInput
            style={styles.input}
            placeholder="linkedin.com/in/username"
            value={linkedin}
            onChangeText={setLinkedin}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Facebook</Text>
          <TextInput
            style={styles.input}
            placeholder="facebook.com/username"
            value={facebook}
            onChangeText={setFacebook}
            autoCapitalize="none"
          />

          <Text style={styles.label}>GitHub</Text>
          <TextInput
            style={styles.input}
            placeholder="github.com/username"
            value={github}
            onChangeText={setGithub}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Portfolio Website</Text>
          <TextInput
            style={styles.input}
            placeholder="https://yourwebsite.com"
            value={portfolio}
            onChangeText={setPortfolio}
            autoCapitalize="none"
          />
        </View>
      </ScrollView>
    </View>
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
