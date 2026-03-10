import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Image, Dimensions, Animated, Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { useTheme } from '../theme/ThemeContext';
import GradientBackground from '../components/ui/GradientBackground';
import GrainTexture from '../components/ui/GrainTexture';
import { PURSUIT_TYPES } from '../constants/pursuitTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 9;

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { user } = useAuth();
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;

  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [gender, setGender] = useState('');
  const [customGender, setCustomGender] = useState('');
  const [hometown, setHometown] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [teamRolePreference, setTeamRolePreference] = useState('either');
  const [teamSizePreference, setTeamSizePreference] = useState('medium');
  const [saving, setSaving] = useState(false);

  // Font helpers
  const headlineFont = isNewTheme ? 'NothingYouCouldDo_400Regular' : 'Inter_600SemiBold';
  const bodyFont = isNewTheme ? 'KleeOne_400Regular' : 'KleeOne_400Regular';
  const bodyBoldFont = isNewTheme ? 'KleeOne_600SemiBold' : 'KleeOne_600SemiBold';
  const accentFont = isNewTheme ? 'Aboreto_400Regular' : 'Inter_500Medium';

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return profilePicture.length > 0;
      case 2: return dateOfBirth !== null;
      case 3: return true; // Gender is optional
      case 4: return hometown.trim().length > 0;
      case 5: return true; // Phone is optional
      case 6: return interests.length >= 3;
      case 7: return true; // Preferences have defaults
      case 8: return true; // Welcome screen
      default: return false;
    }
  };

  const goToStep = (step: number) => {
    scrollViewRef.current?.scrollTo({ x: step * SCREEN_WIDTH, animated: true });
    setCurrentStep(step);
    if (step === 8) {
      // Animate welcome screen
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleNext = () => {
    if (currentStep === 8) {
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

      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          profile_picture: profilePicture,
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

      if (error) throw error;
      onComplete();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save profile: ' + error.message);
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

      setProfilePicture(urlData.publicUrl);
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload photo: ' + error.message);
    } finally {
      setUploading(false);
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

  const accentColor = isNewTheme ? colors.accentGreen : '#6366F1';

  // ===== RENDER STEPS =====

  const renderNameStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <Text style={[styles.emoji]}>👋</Text>
        <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
          What should we call you?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: bodyFont }]}>
          This is how you'll appear to your pod mates
        </Text>
        <TextInput
          style={[styles.textInput, {
            backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff',
            borderColor: colors.border,
            color: colors.textPrimary,
            fontFamily: bodyFont,
          }]}
          placeholder="Your name"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => canProceed(0) && handleNext()}
        />
      </View>
    </View>
  );

  const renderPhotoStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
          Add a profile photo
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: bodyFont }]}>
          Help your pod mates recognize you
        </Text>

        <TouchableOpacity
          style={[styles.photoPlaceholder, {
            borderColor: profilePicture ? accentColor : colors.border,
            backgroundColor: isNewTheme ? colors.surfaceAlt : '#f9f9f9',
          }]}
          onPress={() => pickImage(false)}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="large" color={accentColor} />
          ) : profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.photoImage} />
          ) : (
            <View style={styles.photoPlaceholderInner}>
              <Ionicons name="camera-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.photoPlaceholderText, { color: colors.textTertiary, fontFamily: bodyFont }]}>
                Tap to add photo
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.photoButtons}>
          <TouchableOpacity
            style={[styles.photoOptionButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f0f0f0' }]}
            onPress={() => pickImage(true)}
            disabled={uploading}
          >
            <Ionicons name="camera" size={20} color={accentColor} />
            <Text style={[styles.photoOptionText, { color: colors.textPrimary, fontFamily: bodyBoldFont }]}>
              Take Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.photoOptionButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#f0f0f0' }]}
            onPress={() => pickImage(false)}
            disabled={uploading}
          >
            <Ionicons name="images" size={20} color={accentColor} />
            <Text style={[styles.photoOptionText, { color: colors.textPrimary, fontFamily: bodyBoldFont }]}>
              Choose Photo
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderBirthdayStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <Text style={[styles.emoji]}>🎂</Text>
        <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
          When's your birthday?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: bodyFont }]}>
          This helps us find age-appropriate pods for you
        </Text>

        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff', borderColor: colors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={22} color={accentColor} />
            <Text style={[styles.dateButtonText, { color: dateOfBirth ? colors.textPrimary : colors.textTertiary, fontFamily: bodyFont }]}>
              {dateOfBirth
                ? dateOfBirth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'Select your birthday'}
            </Text>
          </TouchableOpacity>
        )}

        {(showDatePicker || Platform.OS === 'ios') && (
          <View style={styles.datePickerContainer}>
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
              textColor={colors.textPrimary}
            />
          </View>
        )}

        {dateOfBirth && (
          <Text style={[styles.ageText, { color: accentColor, fontFamily: bodyBoldFont }]}>
            You're {calculateAge(dateOfBirth)} years old
          </Text>
        )}
      </View>
    </View>
  );

  const renderGenderStep = () => {
    const genderOptions = ['Male', 'Female', 'Non-binary', 'Other'];
    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        <View style={styles.stepContent}>
          <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
            How do you identify?
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: bodyFont }]}>
            Optional — skip if you prefer
          </Text>

          <View style={styles.pillContainer}>
            {genderOptions.map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.pill,
                  { borderColor: colors.border, backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff' },
                  gender === option && { borderColor: accentColor, backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : '#EEF2FF' },
                ]}
                onPress={() => setGender(gender === option ? '' : option)}
              >
                <Text style={[
                  styles.pillText,
                  { color: colors.textPrimary, fontFamily: bodyFont },
                  gender === option && { color: accentColor, fontFamily: bodyBoldFont },
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {gender === 'Other' && (
            <TextInput
              style={[styles.textInput, {
                backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff',
                borderColor: colors.border,
                color: colors.textPrimary,
                fontFamily: bodyFont,
                marginTop: 16,
              }]}
              placeholder="How do you identify?"
              placeholderTextColor={colors.textTertiary}
              value={customGender}
              onChangeText={setCustomGender}
            />
          )}
        </View>
      </View>
    );
  };

  const renderLocationStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <Text style={[styles.emoji]}>📍</Text>
        <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
          Where are you based?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: bodyFont }]}>
          Helps match you with local pods
        </Text>
        <TextInput
          style={[styles.textInput, {
            backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff',
            borderColor: colors.border,
            color: colors.textPrimary,
            fontFamily: bodyFont,
          }]}
          placeholder="City, State"
          placeholderTextColor={colors.textTertiary}
          value={hometown}
          onChangeText={setHometown}
          returnKeyType="next"
          onSubmitEditing={() => canProceed(4) && handleNext()}
        />
      </View>
    </View>
  );

  const formatPhoneDisplay = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const renderPhoneStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContent}>
        <Text style={[styles.emoji]}>📱</Text>
        <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
          What's your number?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: bodyFont }]}>
          Optional — so pod mates can reach you
        </Text>
        <View style={[styles.phoneInputRow, {
          backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff',
          borderColor: colors.border,
        }]}>
          <Text style={[styles.phonePrefix, { color: colors.textSecondary, fontFamily: bodyBoldFont }]}>+1</Text>
          <TextInput
            style={[styles.phoneTextInput, {
              color: colors.textPrimary,
              fontFamily: bodyFont,
            }]}
            placeholder="(555) 123-4567"
            placeholderTextColor={colors.textTertiary}
            value={formatPhoneDisplay(phoneNumber)}
            onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={14}
          />
        </View>
      </View>
    </View>
  );

  const renderInterestsStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.stepContentInterests}>
        <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
          What are you into?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: bodyFont }]}>
          Pick at least 3 interests that excite you
        </Text>
        <Text style={[styles.interestCount, { color: interests.length >= 3 ? accentColor : colors.textTertiary, fontFamily: bodyBoldFont }]}>
          {interests.length} selected {interests.length < 3 ? `(${3 - interests.length} more needed)` : ''}
        </Text>

        <ScrollView
          style={styles.interestsScroll}
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
                  { borderColor: colors.border, backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff' },
                  selected && { borderColor: accentColor, backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : '#EEF2FF' },
                ]}
                onPress={() => toggleInterest(type)}
              >
                <Text style={[
                  styles.interestPillText,
                  { color: colors.textSecondary, fontFamily: bodyFont },
                  selected && { color: accentColor, fontFamily: bodyBoldFont },
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  const renderPreferencesStep = () => {
    const roles = [
      { key: 'leader', label: 'Lead the way', icon: '🎯', desc: 'I want to create and lead pods' },
      { key: 'contributor', label: 'Contribute', icon: '🤝', desc: 'I prefer to join and participate' },
      { key: 'either', label: 'Flexible', icon: '🔄', desc: 'I\'m open to either role' },
    ];
    const sizes = [
      { key: 'small', label: 'Small (2-4)', icon: '👥' },
      { key: 'medium', label: 'Medium (5-8)', icon: '👥👥' },
      { key: 'large', label: 'Large (9+)', icon: '👥👥👥' },
    ];

    return (
      <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
        <ScrollView style={styles.stepContentScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
            How do you like to work?
          </Text>

          <Text style={[styles.prefSectionTitle, { color: colors.textPrimary, fontFamily: bodyBoldFont }]}>
            Team Role
          </Text>
          {roles.map(role => (
            <TouchableOpacity
              key={role.key}
              style={[
                styles.prefCard,
                { borderColor: colors.border, backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff' },
                teamRolePreference === role.key && { borderColor: accentColor, backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.1)' : '#EEF2FF' },
              ]}
              onPress={() => setTeamRolePreference(role.key)}
            >
              <Text style={styles.prefIcon}>{role.icon}</Text>
              <View style={styles.prefInfo}>
                <Text style={[styles.prefLabel, { color: colors.textPrimary, fontFamily: bodyBoldFont }]}>
                  {role.label}
                </Text>
                <Text style={[styles.prefDesc, { color: colors.textSecondary, fontFamily: bodyFont }]}>
                  {role.desc}
                </Text>
              </View>
              {teamRolePreference === role.key && (
                <Ionicons name="checkmark-circle" size={24} color={accentColor} />
              )}
            </TouchableOpacity>
          ))}

          <Text style={[styles.prefSectionTitle, { color: colors.textPrimary, fontFamily: bodyBoldFont, marginTop: 24 }]}>
            Preferred Team Size
          </Text>
          <View style={styles.sizeRow}>
            {sizes.map(size => (
              <TouchableOpacity
                key={size.key}
                style={[
                  styles.sizeCard,
                  { borderColor: colors.border, backgroundColor: isNewTheme ? colors.surfaceAlt : '#fff' },
                  teamSizePreference === size.key && { borderColor: accentColor, backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.1)' : '#EEF2FF' },
                ]}
                onPress={() => setTeamSizePreference(size.key)}
              >
                <Text style={styles.sizeIcon}>{size.icon}</Text>
                <Text style={[
                  styles.sizeLabel,
                  { color: colors.textPrimary, fontFamily: bodyFont },
                  teamSizePreference === size.key && { color: accentColor, fontFamily: bodyBoldFont },
                ]}>
                  {size.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderWelcomeStep = () => (
    <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
      <Animated.View style={[styles.stepContent, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
        <Text style={styles.welcomeEmoji}>🐳</Text>
        <Text style={[styles.welcomeHeadline, { color: colors.textPrimary, fontFamily: headlineFont }]}>
          Welcome to the pod, {name}!
        </Text>
        <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary, fontFamily: bodyFont }]}>
          You're all set to start exploring pursuits and finding your team
        </Text>
      </Animated.View>
    </View>
  );

  // ===== MAIN RENDER =====

  const buttonLabel = currentStep === 8
    ? (saving ? 'Saving...' : "Let's Go!")
    : 'Next';

  return (
    <GradientBackground style={styles.container}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} />
      {isNewTheme && <GrainTexture opacity={0.06} />}

      {/* Progress dots */}
      <View style={styles.progressContainer}>
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              { backgroundColor: colors.border },
              index === currentStep && { backgroundColor: accentColor, width: 24 },
              index < currentStep && { backgroundColor: accentColor },
            ]}
          />
        ))}
      </View>

      {/* Step content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.stepsScroll}
      >
        {renderNameStep()}
        {renderPhotoStep()}
        {renderBirthdayStep()}
        {renderGenderStep()}
        {renderLocationStep()}
        {renderPhoneStep()}
        {renderInterestsStep()}
        {renderPreferencesStep()}
        {renderWelcomeStep()}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={[styles.navContainer, { borderTopColor: colors.border }]}>
        {currentStep > 0 ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
            <Text style={[styles.backText, { color: colors.textSecondary, fontFamily: bodyFont }]}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: accentColor },
            !canProceed(currentStep) && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed(currentStep) || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={isNewTheme ? colors.background : '#fff'} />
          ) : (
            <Text style={[styles.nextText, { color: isNewTheme ? colors.background : '#fff', fontFamily: bodyBoldFont }]}>
              {buttonLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Progress
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 12,
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Steps scroll
  stepsScroll: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepContent: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  stepContentInterests: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  stepContentScroll: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  // Typography
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  // Text input
  textInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
  },
  // Photo step
  photoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  photoImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  photoPlaceholderInner: {
    alignItems: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 13,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  photoOptionText: {
    fontSize: 14,
  },
  // Birthday
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  dateButtonText: {
    fontSize: 16,
  },
  datePickerContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  ageText: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  // Gender pills
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 15,
  },
  // Phone
  phoneInputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  phonePrefix: {
    fontSize: 17,
    marginRight: 8,
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 0,
  },
  // Interests
  interestCount: {
    fontSize: 14,
    marginBottom: 16,
  },
  interestsScroll: {
    flex: 1,
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
  },
  interestPillText: {
    fontSize: 14,
  },
  // Preferences
  prefSectionTitle: {
    fontSize: 17,
    marginBottom: 12,
    marginTop: 8,
  },
  prefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  prefIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  prefInfo: {
    flex: 1,
  },
  prefLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  prefDesc: {
    fontSize: 13,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  sizeIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  sizeLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  // Welcome
  welcomeEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  welcomeHeadline: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  // Navigation
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 70,
  },
  backText: {
    fontSize: 16,
  },
  nextButton: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 28,
    minWidth: 120,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
