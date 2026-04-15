import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Image, Dimensions, Animated, Platform, StatusBar, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { PURSUIT_TYPES } from '../constants/pursuitTypes';
import { US_CITIES } from '../constants/usCities';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 11;

// Design tokens
const C = {
  bg: '#F6FAF8',
  ink: '#1B1B18',
  muted: '#8A8A85',
  accent: '#2D5016',
  accentLine: '#A8D4B8',
  border: '#CCD6D0',
  white: '#FFFFFF',
  gradientTop: '#DCE8E0',
};

const F = {
  header: 'PlayfairDisplay_700Bold',
  body: 'Sora_400Regular',
  bodyMedium: 'Sora_600SemiBold',
};

// Section groups for progress dots
const SECTION_MAP: Record<number, number> = {
  0: 0, 1: 0,           // Set up your profile
  2: 1, 3: 1, 4: 1,     // The Basics
  5: 2, 6: 2,            // Your Details
  7: 3,                  // Your interests
  8: 4,                  // Preferences
  9: 5,                  // Notifications
  10: 6,                 // Welcome
};
const NUM_SECTIONS = 7;

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { user } = useAuth();

  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [currentStep, setCurrentStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profilePictures, setProfilePictures] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [gender, setGender] = useState('');
  const [customGender, setCustomGender] = useState('');
  const [hometown, setHometown] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [teamRolePreference, setTeamRolePreference] = useState('either');
  const [teamSizePreference, setTeamSizePreference] = useState('medium');
  const [saving, setSaving] = useState(false);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: return firstName.trim().length > 0;
      case 1: return profilePictures.length >= 3;
      case 2: return dateOfBirth !== null;
      case 3: return gender.length > 0;
      case 4: return hometown.trim().length > 0;
      case 5: return true; // Phone is optional
      case 6: return true; // Socials are optional
      case 7: return interests.length >= 3;
      case 8: return true; // Preferences have defaults
      case 9: return true; // Notifications (optional)
      case 10: return true; // Welcome screen
      default: return false;
    }
  };

  const goToStep = (step: number) => {
    scrollViewRef.current?.scrollTo({ x: step * SCREEN_WIDTH, animated: true });
    setCurrentStep(step);
    if (step === 10) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleNext = () => {
    if (currentStep === 10) {
      handleComplete();
    } else if (canProceed(currentStep)) {
      goToStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const age = dateOfBirth ? calculateAge(dateOfBirth) : null;
      const finalGender = gender === 'Other' ? customGender : gender;
      const fullName = (firstName.trim() + ' ' + lastName.trim()).trim();

      const updateData: Record<string, any> = {
        name: fullName,
        profile_picture: profilePictures[0] || '',
        profile_pictures: profilePictures,
        date_of_birth: dateOfBirth?.toISOString().split('T')[0],
        age,
        gender: finalGender || null,
        hometown: hometown.trim(),
        phone: phoneNumber.replace(/\D/g, '') || null,
        interests,
        team_role_preference: teamRolePreference,
        team_size_preference: teamSizePreference,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      // Add socials - columns may not exist yet, so we include them
      // and let Supabase ignore unknown columns or handle gracefully
      if (instagram.trim()) updateData.instagram = instagram.trim();
      if (linkedin.trim()) updateData.linkedin = linkedin.trim();

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;
      onComplete();
    } catch (error: any) {
      // If error is about instagram/linkedin columns not existing, retry without them
      if (error.message?.includes('instagram') || error.message?.includes('linkedin')) {
        try {
          const age = dateOfBirth ? calculateAge(dateOfBirth) : null;
          const finalGender = gender === 'Other' ? customGender : gender;
          const fullName = (firstName.trim() + ' ' + lastName.trim()).trim();

          const { error: retryError } = await supabase
            .from('profiles')
            .update({
              name: fullName,
              profile_picture: profilePictures[0] || '',
        profile_pictures: profilePictures,
              date_of_birth: dateOfBirth?.toISOString().split('T')[0],
              age,
              gender: finalGender || null,
              hometown: hometown.trim(),
              phone: phoneNumber.replace(/\D/g, '') || null,
              interests,
              team_role_preference: teamRolePreference,
              team_size_preference: teamSizePreference,
              onboarding_completed: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (retryError) throw retryError;
          onComplete();
          return;
        } catch (retryErr: any) {
          Alert.alert('Error', 'Failed to save profile: ' + retryErr.message);
        }
      } else {
        Alert.alert('Error', 'Failed to save profile: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // Image picker
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
      setUploading(false);
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
        uri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/profile-pictures/${fileName}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      setProfilePictures(prev => [...prev, urlData.publicUrl]);
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload photo: ' + error.message);
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  // Max date for birthday: 13 years ago
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 13);

  const formatPhoneDisplay = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handleEnableNotifications = async () => {
    try {
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationPermissionGranted(true);
        if (user) {
          const { notificationService } = await import('../services/notificationService');
          notificationService.registerPushToken(user.id).catch(() => {});
        }
      }
    } catch (err) {
      console.log('Notification permission request failed:', err);
    }
  };

  // ===== SHARED LAYOUT COMPONENTS =====

  const getSectionTitle = (step: number): string => {
    if (step <= 1) return 'Set up your profile';
    if (step <= 4) return 'The Basics';
    if (step <= 6) return 'Your Details';
    if (step === 7) return 'Your interests';
    if (step === 8) return 'Preferences';
    if (step === 9) return 'Notifications';
    return 'Welcome';
  };

  const getStepLabel = (step: number): string => {
    switch (step) {
      case 0: return 'You';
      case 1: return 'Your photo';
      case 2: return 'Your Birthday';
      case 3: return 'How do you identify?';
      case 4: return 'Where are you based?';
      case 5: return 'Your phone number';
      case 6: return 'Drop your socials';
      case 7: return 'Pick at least 3';
      case 8: return 'How do you like to work?';
      case 9: return 'Stay connected';
      case 10: return '';
      default: return '';
    }
  };

  const renderProgressDots = () => {
    const currentSection = SECTION_MAP[currentStep] ?? 0;
    return (
      <View style={styles.progressDots}>
        {Array.from({ length: NUM_SECTIONS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentSection && styles.dotActive,
              i < currentSection && styles.dotCompleted,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderStepHeader = (step: number) => (
    <View style={styles.headerArea}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{getSectionTitle(step)}</Text>
        {renderProgressDots()}
      </View>
      <View style={styles.accentLine} />
      {getStepLabel(step) ? (
        <Text style={styles.stepLabel}>{getStepLabel(step)}</Text>
      ) : null}
    </View>
  );

  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      {currentStep > 0 ? (
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={28} color={C.ink} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 28 }} />
      )}

      <TouchableOpacity
        style={[
          styles.forwardButton,
          !canProceed(currentStep) && { opacity: 0.3 },
        ]}
        onPress={handleNext}
        disabled={!canProceed(currentStep) || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={C.white} />
        ) : (
          <Ionicons name="chevron-forward" size={24} color={C.white} />
        )}
      </TouchableOpacity>
    </View>
  );

  // ===== RENDER STEPS =====

  const renderNameStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepInner}>
        {renderStepHeader(0)}
        <View style={styles.contentArea}>
          <TextInput
            style={styles.largeInput}
            placeholder="First name"
            placeholderTextColor={C.border}
            value={firstName}
            onChangeText={setFirstName}
            autoFocus
            returnKeyType="next"
          />
          <View style={styles.thinDivider} />
          <TextInput
            style={styles.largeInput}
            placeholder="Last name"
            placeholderTextColor={C.border}
            value={lastName}
            onChangeText={setLastName}
            returnKeyType="next"
            onSubmitEditing={() => canProceed(0) && handleNext()}
          />
        </View>
        <Text style={styles.helperText}>This is how you'll appear to your pod mates</Text>
        {renderBottomNav()}
      </View>
    </View>
  );

  const removePhoto = (index: number) => {
    setProfilePictures(prev => prev.filter((_, i) => i !== index));
  };

  const renderPhotoStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepInner}>
        {renderStepHeader(1)}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}>
          <Text style={{ fontSize: 13, color: C.muted, fontFamily: F.body, marginBottom: 16 }}>
            Add at least 3 photos of yourself ({profilePictures.length}/3 minimum)
          </Text>

          {/* Photo grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {profilePictures.map((pic, i) => (
              <View key={i} style={{ width: (SCREEN_WIDTH - 68) / 3, aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F2F0EB' }}>
                <Image source={{ uri: pic }} style={{ width: '100%', height: '100%' }} />
                <TouchableOpacity
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => removePhoto(i)}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
                {i === 0 && (
                  <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: C.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>Default</Text>
                  </View>
                )}
              </View>
            ))}
            {/* Add photo button */}
            {profilePictures.length < 6 && (
              <TouchableOpacity
                style={{ width: (SCREEN_WIDTH - 68) / 3, aspectRatio: 0.8, borderRadius: 12, backgroundColor: '#F2F0EB', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' }}
                onPress={() => pickImage(false)}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={C.muted} />
                ) : (
                  <>
                    <Ionicons name="add" size={28} color={C.muted} />
                    <Text style={{ fontSize: 11, color: C.muted, fontFamily: F.body, marginTop: 4 }}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F2F0EB' }}
              onPress={() => pickImage(true)}
              disabled={uploading}
            >
              <Ionicons name="camera-outline" size={18} color={C.ink} />
              <Text style={{ fontSize: 14, color: C.ink, fontFamily: F.body }}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F2F0EB' }}
              onPress={() => pickImage(false)}
              disabled={uploading}
            >
              <Ionicons name="images-outline" size={18} color={C.ink} />
              <Text style={{ fontSize: 14, color: C.ink, fontFamily: F.body }}>Library</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <Text style={styles.helperText}>Your first photo will be your default profile image</Text>
        {renderBottomNav()}
      </View>
    </View>
  );

  const renderBirthdayStep = () => {
    const mm = dateOfBirth ? String(dateOfBirth.getMonth() + 1).padStart(2, '0') : 'MM';
    const dd = dateOfBirth ? String(dateOfBirth.getDate()).padStart(2, '0') : 'DD';
    const yyyy = dateOfBirth ? String(dateOfBirth.getFullYear()) : 'YYYY';

    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        <View style={styles.stepInner}>
          {renderStepHeader(2)}
          <View style={styles.contentArea}>
            {/* Large date display */}
            <TouchableOpacity
              onPress={() => { if (Platform.OS === 'android') setShowDatePicker(true); }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.largeDateDisplay,
                !dateOfBirth && { color: C.border },
              ]}>
                {mm}  {dd}  {yyyy}
              </Text>
            </TouchableOpacity>

            {(showDatePicker || Platform.OS === 'ios') && (
              <View style={{ marginTop: 16 }}>
                <DateTimePicker
                  value={dateOfBirth || maxDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={maxDate}
                  minimumDate={new Date(1920, 0, 1)}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (selectedDate) setDateOfBirth(selectedDate);
                  }}
                  textColor={C.ink}
                />
              </View>
            )}
          </View>
          <Text style={styles.helperText}>We only show your age on your profile.</Text>
          {renderBottomNav()}
        </View>
      </View>
    );
  };

  const renderGenderStep = () => {
    const genderOptions = ['Male', 'Female', 'Non-binary', 'Other'];
    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        <View style={styles.stepInner}>
          {renderStepHeader(3)}
          <View style={styles.contentArea}>
            <View style={styles.genderPills}>
              {genderOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderPill,
                    gender === option && styles.genderPillActive,
                  ]}
                  onPress={() => setGender(gender === option ? '' : option)}
                >
                  <Text style={[
                    styles.genderPillText,
                    gender === option && styles.genderPillTextActive,
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {gender === 'Other' && (
              <TextInput
                style={[styles.largeInput, { marginTop: 24 }]}
                placeholder="How do you identify?"
                placeholderTextColor={C.border}
                value={customGender}
                onChangeText={setCustomGender}
              />
            )}
          </View>
          <Text style={styles.helperText}>Used for personalizing your experience</Text>
          {renderBottomNav()}
        </View>
      </View>
    );
  };

  const locationSuggestions = hometown.trim().length >= 2
    ? US_CITIES.filter(c => c.toLowerCase().startsWith(hometown.toLowerCase())).slice(0, 5)
    : [];

  const renderLocationStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepInner}>
        {renderStepHeader(4)}
        <View style={styles.contentArea}>
          <TextInput
            style={styles.largeInput}
            placeholder="City, State"
            placeholderTextColor={C.border}
            value={hometown}
            onChangeText={setHometown}
            returnKeyType="next"
            onSubmitEditing={() => canProceed(4) && handleNext()}
          />
          {locationSuggestions.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {locationSuggestions.map(city => (
                <TouchableOpacity
                  key={city}
                  style={{ paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}
                  onPress={() => setHometown(city)}
                >
                  <Text style={{ fontSize: 17, color: C.ink, fontFamily: F.body }}>{city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <Text style={styles.helperText}>Helps match you with local pods.</Text>
        {renderBottomNav()}
      </View>
    </View>
  );

  const renderPhoneStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepInner}>
        {renderStepHeader(5)}
        <View style={styles.contentArea}>
          <View style={styles.phoneRow}>
            <Text style={styles.phonePrefix}>+1</Text>
            <TextInput
              style={styles.phoneLargeInput}
              placeholder="(555) 123-4567"
              placeholderTextColor={C.border}
              value={formatPhoneDisplay(phoneNumber)}
              onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={14}
            />
          </View>
        </View>
        <Text style={styles.helperText}>We use your phone number to sign you in.</Text>
        {renderBottomNav()}
      </View>
    </View>
  );

  const renderSocialsStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepInner}>
        {renderStepHeader(6)}
        <View style={styles.contentArea}>
          <View style={styles.socialRow}>
            <Text style={styles.socialLabel}>Instagram</Text>
            <TextInput
              style={styles.socialInput}
              placeholder="@handle"
              placeholderTextColor={C.border}
              value={instagram}
              onChangeText={setInstagram}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.thinDivider} />
          <View style={styles.socialRow}>
            <Text style={styles.socialLabel}>LinkedIn</Text>
            <TextInput
              style={styles.socialInput}
              placeholder="linkedin.com/in/you"
              placeholderTextColor={C.border}
              value={linkedin}
              onChangeText={setLinkedin}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
        <Text style={styles.helperText}>
          Socials are used to ensure every person on Whale Pod is real. This is required for verification, but will not be shown on your profile.
        </Text>
        {renderBottomNav()}
      </View>
    </View>
  );

  const renderInterestsStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={[styles.stepInner, { flex: 1 }]}>
        {renderStepHeader(7)}
        <Text style={[styles.interestCount, {
          color: interests.length >= 3 ? C.accent : C.muted,
        }]}>
          {interests.length} selected {interests.length < 3 ? `(${3 - interests.length} more needed)` : ''}
        </Text>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.interestsGrid}
        >
          {PURSUIT_TYPES.map(type => {
            const selected = interests.includes(type);
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.interestPill,
                  selected && styles.interestPillActive,
                ]}
                onPress={() => toggleInterest(type)}
              >
                <Text style={[
                  styles.interestPillText,
                  selected && styles.interestPillTextActive,
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {renderBottomNav()}
      </View>
    </View>
  );

  const renderPreferencesStep = () => {
    const roles = [
      { key: 'leader', label: 'Lead the way', desc: 'I want to create and lead pods' },
      { key: 'contributor', label: 'Contribute', desc: 'I prefer to join and participate' },
      { key: 'either', label: 'Flexible', desc: "I'm open to either role" },
    ];
    const sizes = [
      { key: 'small', label: 'Small (2-4)' },
      { key: 'medium', label: 'Medium (5-8)' },
      { key: 'large', label: 'Large (9+)' },
    ];

    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        <View style={[styles.stepInner, { flex: 1 }]}>
          {renderStepHeader(8)}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.prefSection}>Team Role</Text>
            {roles.map(role => (
              <TouchableOpacity
                key={role.key}
                style={[
                  styles.prefCard,
                  teamRolePreference === role.key && styles.prefCardActive,
                ]}
                onPress={() => setTeamRolePreference(role.key)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefCardLabel}>{role.label}</Text>
                  <Text style={styles.prefCardDesc}>{role.desc}</Text>
                </View>
                {teamRolePreference === role.key && (
                  <Ionicons name="checkmark-circle" size={22} color={C.accent} />
                )}
              </TouchableOpacity>
            ))}

            <Text style={[styles.prefSection, { marginTop: 28 }]}>Preferred Team Size</Text>
            <View style={styles.sizeRow}>
              {sizes.map(size => (
                <TouchableOpacity
                  key={size.key}
                  style={[
                    styles.sizeCard,
                    teamSizePreference === size.key && styles.sizeCardActive,
                  ]}
                  onPress={() => setTeamSizePreference(size.key)}
                >
                  <Text style={[
                    styles.sizeLabel,
                    teamSizePreference === size.key && { color: C.accent, fontFamily: F.bodyMedium },
                  ]}>
                    {size.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {renderBottomNav()}
        </View>
      </View>
    );
  };

  const renderNotificationStep = () => {
    const notifItems = [
      { icon: 'chatbubble-ellipses-outline' as const, text: 'New messages from pod mates' },
      { icon: 'people-outline' as const, text: 'Pod updates and applications' },
      { icon: 'calendar-outline' as const, text: 'Meeting reminders' },
      { icon: 'hand-right-outline' as const, text: 'Connection requests' },
    ];

    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        <View style={styles.stepInner}>
          {renderStepHeader(9)}
          <View style={styles.contentArea}>
            {notificationPermissionGranted ? (
              <Ionicons name="checkmark-circle" size={48} color={C.accent} style={{ marginBottom: 20 }} />
            ) : null}

            <View style={styles.notifList}>
              {notifItems.map(item => (
                <View key={item.text} style={styles.notifItem}>
                  <Ionicons name={item.icon} size={20} color={C.muted} />
                  <Text style={styles.notifText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {notificationPermissionGranted ? (
              <Text style={[styles.helperText, { color: C.accent, fontFamily: F.bodyMedium }]}>
                Notifications enabled!
              </Text>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.enableNotifBtn}
                  onPress={handleEnableNotifications}
                >
                  <Ionicons name="notifications" size={18} color={C.white} />
                  <Text style={styles.enableNotifText}>Enable Notifications</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => goToStep(currentStep + 1)}>
                  <Text style={[styles.helperText, { marginTop: 16 }]}>Maybe later</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          {renderBottomNav()}
        </View>
      </View>
    );
  };

  const renderWelcomeStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <Animated.View style={[styles.stepInner, {
        opacity: fadeAnim,
        transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
      }]}>
        {renderStepHeader(10)}
        <View style={[styles.contentArea, { alignItems: 'center' }]}>
          <Text style={styles.welcomeTitle}>
            Welcome to the pod, {firstName}!
          </Text>
          <Text style={[styles.helperText, { textAlign: 'center', marginTop: 12, fontSize: 16 }]}>
            You're all set to start exploring pursuits and finding your team
          </Text>
        </View>
        <View style={styles.bottomNav}>
          <View style={{ width: 28 }} />
          <TouchableOpacity
            style={styles.forwardButton}
            onPress={handleComplete}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <Ionicons name="chevron-forward" size={24} color={C.white} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );

  // ===== MAIN RENDER =====

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Subtle peach gradient at top */}
      <LinearGradient
        colors={[C.gradientTop, C.bg]}
        style={styles.topGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {renderNameStep()}
          {renderPhotoStep()}
          {renderBirthdayStep()}
          {renderGenderStep()}
          {renderLocationStep()}
          {renderPhoneStep()}
          {renderSocialsStep()}
          {renderInterestsStep()}
          {renderPreferencesStep()}
          {renderNotificationStep()}
          {renderWelcomeStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },

  // Step layout
  stepContainer: {
    flex: 1,
  },
  stepInner: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 72 : 48,
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },

  // Header area
  headerArea: {
    marginBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: F.header,
    fontSize: 22,
    color: C.ink,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  dotActive: {
    backgroundColor: C.ink,
    width: 20,
    borderRadius: 4,
  },
  dotCompleted: {
    backgroundColor: C.ink,
  },
  accentLine: {
    height: 2,
    backgroundColor: C.accentLine,
    marginBottom: 16,
  },
  stepLabel: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.muted,
    letterSpacing: 0.3,
  },

  // Content
  contentArea: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },

  // Large text input (no box, just big text)
  largeInput: {
    fontFamily: F.bodyMedium,
    fontSize: 40,
    color: C.ink,
    paddingVertical: 8,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  thinDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 8,
  },

  // Helper text
  helperText: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.muted,
    lineHeight: 19,
    marginBottom: 8,
  },

  // Bottom navigation
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 4,
  },
  forwardButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Photo step
  photoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 24,
  },
  photoImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 16,
  },
  photoActionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  photoActionText: {
    fontFamily: F.bodyMedium,
    fontSize: 14,
    color: C.ink,
  },

  // Birthday large display
  largeDateDisplay: {
    fontFamily: F.bodyMedium,
    fontSize: 40,
    color: C.ink,
    letterSpacing: 2,
  },

  // Gender pills
  genderPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genderPill: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  genderPillActive: {
    borderColor: C.ink,
    backgroundColor: C.ink,
  },
  genderPillText: {
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
  },
  genderPillTextActive: {
    color: C.white,
    fontFamily: F.bodyMedium,
  },

  // Phone
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  phonePrefix: {
    fontFamily: F.bodyMedium,
    fontSize: 40,
    color: C.ink,
    marginRight: 8,
  },
  phoneLargeInput: {
    flex: 1,
    fontFamily: F.bodyMedium,
    fontSize: 40,
    color: C.ink,
    paddingVertical: 0,
  },

  // Socials
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  socialLabel: {
    fontFamily: F.bodyMedium,
    fontSize: 17,
    color: C.ink,
    width: 100,
  },
  socialInput: {
    flex: 1,
    fontFamily: F.body,
    fontSize: 17,
    color: C.ink,
    paddingVertical: 4,
  },

  // Interests
  interestCount: {
    fontFamily: F.bodyMedium,
    fontSize: 13,
    marginBottom: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 20,
  },
  interestPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  interestPillActive: {
    borderColor: C.ink,
    backgroundColor: C.ink,
  },
  interestPillText: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.ink,
  },
  interestPillTextActive: {
    color: C.white,
    fontFamily: F.bodyMedium,
  },

  // Preferences
  prefSection: {
    fontFamily: F.bodyMedium,
    fontSize: 16,
    color: C.ink,
    marginBottom: 12,
  },
  prefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
    marginBottom: 10,
  },
  prefCardActive: {
    borderColor: C.accent,
    backgroundColor: '#F0F5EC',
  },
  prefCardLabel: {
    fontFamily: F.bodyMedium,
    fontSize: 15,
    color: C.ink,
    marginBottom: 2,
  },
  prefCardDesc: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.muted,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  sizeCardActive: {
    borderColor: C.accent,
    backgroundColor: '#F0F5EC',
  },
  sizeLabel: {
    fontFamily: F.body,
    fontSize: 13,
    color: C.ink,
    textAlign: 'center',
  },

  // Notifications
  notifList: {
    gap: 16,
    marginBottom: 28,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifText: {
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
    lineHeight: 22,
  },
  enableNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: C.ink,
  },
  enableNotifText: {
    fontFamily: F.bodyMedium,
    fontSize: 15,
    color: C.white,
  },

  // Welcome
  welcomeTitle: {
    fontFamily: F.header,
    fontSize: 32,
    color: C.ink,
    textAlign: 'center',
    lineHeight: 42,
  },
});
