import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';

const { height } = Dimensions.get('window');

// Custom colors for login page (white/green/purple theme) - light mode fallback
const loginColorsLight = {
  accent: '#6366F1',        // Indigo/purple - primary accent
  accentLight: '#EEF2FF',   // Light indigo background
  green: '#10B981',         // Emerald green
  greenLight: '#D1FAE5',    // Light green
  purple: '#8B5CF6',        // Violet purple
  purpleLight: '#EDE9FE',   // Light purple
};

// Dark mode login colors
const loginColorsDark = {
  accent: '#A8E6A3',        // Green accent for dark mode
  accentLight: 'rgba(168, 230, 163, 0.15)',
  green: '#A8E6A3',
  greenLight: 'rgba(168, 230, 163, 0.15)',
  purple: '#818CF8',
  purpleLight: 'rgba(129, 140, 248, 0.15)',
};

export default function LoginScreen() {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const loginColors = isNewTheme ? loginColorsDark : loginColorsLight;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { signIn, signUp } = useAuth();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    loadSavedCredentials();
    // Start entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('saved_email');
      const savedPassword = await AsyncStorage.getItem('saved_password');
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }

    try {
      if (isSignup) {
        await signUp(email, password);
        // Verification screen will be shown automatically by App.tsx
      } else {
        await signIn(email, password);

        if (rememberMe) {
          await AsyncStorage.setItem('saved_email', email);
          await AsyncStorage.setItem('saved_password', password);
        } else {
          await AsyncStorage.removeItem('saved_email');
          await AsyncStorage.removeItem('saved_password');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    // Subtle animation on mode switch
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={[styles.container, { backgroundColor: isNewTheme ? colors.background : legacyColors.white }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={isNewTheme ? colors.background : legacyColors.white} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Decorative circles - white/green/purple theme */}
      <View style={[styles.decorativeCircle1, { backgroundColor: loginColorsLight.purpleLight }]} />
      <View style={[styles.decorativeCircle2, { backgroundColor: loginColorsLight.greenLight }]} />
      <View style={[styles.decorativeCircle3, { backgroundColor: loginColorsLight.accentLight }]} />

    <KeyboardAvoidingView
        style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
            {/* Logo Section */}
            <Animated.View
              style={[
                styles.logoSection,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <View style={styles.logoContainer}>
                <View style={[styles.logoBadge, { backgroundColor: loginColorsLight.accent }]}>
                  <Text style={styles.logoEmoji}>🐋</Text>
                </View>
              </View>
              <Text style={[styles.appName, { color: legacyColors.textPrimary }]}>Whale Pod</Text>
              <Text style={[styles.tagline, { color: legacyColors.textSecondary }]}>
                {isSignup ? 'Join the community' : 'Welcome back'}
              </Text>
            </Animated.View>

            {/* Form Section */}
            <Animated.View
              style={[
                styles.formSection,
                { backgroundColor: isNewTheme ? colors.surface : legacyColors.white },
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: legacyColors.textPrimary }]}>Email</Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary },
                    emailFocused && [styles.inputContainerFocused, { borderColor: loginColors.accent, backgroundColor: isNewTheme ? colors.surface : legacyColors.white }],
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={emailFocused ? loginColors.accent : colors.textTertiary}
                    style={styles.inputIcon}
                  />
          <TextInput
            style={[styles.input, { color: legacyColors.textPrimary }]}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: legacyColors.textPrimary }]}>Password</Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary },
                    passwordFocused && [styles.inputContainerFocused, { borderColor: loginColors.accent, backgroundColor: isNewTheme ? colors.surface : legacyColors.white }],
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={passwordFocused ? loginColors.accent : colors.textTertiary}
                    style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, { color: legacyColors.textPrimary }]}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
                    secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Me - Only on Login */}
          {!isSignup && (
            <TouchableOpacity
                  style={styles.rememberMeContainer}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: legacyColors.border, backgroundColor: isNewTheme ? colors.surface : legacyColors.white },
                      rememberMe && [styles.checkboxChecked, { backgroundColor: loginColorsLight.accent, borderColor: loginColors.accent }],
                    ]}
                  >
                    {rememberMe && (
                      <Ionicons name="checkmark" size={14} color={isNewTheme ? colors.background : '#fff'} />
                    )}
              </View>
                  <Text style={[styles.rememberMeText, { color: legacyColors.textSecondary }]}>Remember me</Text>
            </TouchableOpacity>
          )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: loginColorsLight.accent }]}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <Text style={[styles.submitButtonText, { color: isNewTheme ? colors.background : legacyColors.white }]}>
                  {isSignup ? 'Create Account' : 'Sign In'}
                </Text>
                <Ionicons
                  name={isSignup ? 'person-add-outline' : 'arrow-forward'}
                  size={20}
                  color={isNewTheme ? colors.background : '#fff'}
                  style={styles.submitButtonIcon}
                />
          </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: legacyColors.textTertiary }]}>or</Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              </View>

              {/* Toggle Sign Up / Sign In */}
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleMode}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, { color: legacyColors.textSecondary }]}>
                  {isSignup
                    ? 'Already have an account? '
                    : "Don't have an account? "}
                  <Text style={[styles.toggleTextBold, { color: loginColors.accent }]}>
                    {isSignup ? 'Sign In' : 'Sign Up'}
                  </Text>
            </Text>
          </TouchableOpacity>
            </Animated.View>

            {/* Footer */}
            <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
              <Text style={[styles.footerText, { color: legacyColors.textTertiary }]}>
                By continuing, you agree to our Terms of Service
              </Text>
            </Animated.View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: legacyColors.white,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: loginColorsLight.purpleLight,
    opacity: 0.6,
  },
  decorativeCircle2: {
    position: 'absolute',
    top: height * 0.3,
    left: -120,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: loginColorsLight.greenLight,
    opacity: 0.5,
  },
  decorativeCircle3: {
    position: 'absolute',
    bottom: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: loginColorsLight.accentLight,
    opacity: 0.4,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: height * 0.08,
    paddingBottom: spacing['3xl'],
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: loginColorsLight.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  logoEmoji: {
    fontSize: 44,
  },
  appName: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: typography.fontSize.lg,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  formSection: {
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing.xl,
    ...shadows.md,
  },
  inputWrapper: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: legacyColors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.base,
    height: 54,
  },
  inputContainerFocused: {
    borderColor: loginColorsLight.accent,
    backgroundColor: legacyColors.white,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: legacyColors.textPrimary,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: legacyColors.border,
    backgroundColor: legacyColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: loginColorsLight.accent,
    borderColor: loginColorsLight.accent,
  },
  rememberMeText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: loginColorsLight.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    ...shadows.base,
  },
  submitButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.white,
    letterSpacing: 0.3,
  },
  submitButtonIcon: {
    marginLeft: spacing.sm,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: legacyColors.border,
  },
  dividerText: {
    marginHorizontal: spacing.base,
    fontSize: typography.fontSize.sm,
    color: legacyColors.textTertiary,
    fontWeight: typography.fontWeight.medium,
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
  },
  toggleTextBold: {
    color: loginColorsLight.accent,
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing['2xl'],
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSize.xs,
    color: legacyColors.textTertiary,
    textAlign: 'center',
  },
});
