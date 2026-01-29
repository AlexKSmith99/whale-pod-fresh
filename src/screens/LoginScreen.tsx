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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';

const { height } = Dimensions.get('window');

// Custom colors for login page (white/green/purple theme)
const loginColors = {
  accent: '#6366F1',        // Indigo/purple - primary accent
  accentLight: '#EEF2FF',   // Light indigo background
  green: '#10B981',         // Emerald green
  greenLight: '#D1FAE5',    // Light green
  purple: '#8B5CF6',        // Violet purple
  purpleLight: '#EDE9FE',   // Light purple
};

export default function LoginScreen() {
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
    <View style={styles.container}>
      {/* Decorative circles - white/green/purple theme */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      <View style={styles.decorativeCircle3} />

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
                <View style={styles.logoBadge}>
                  <Text style={styles.logoEmoji}>🐋</Text>
                </View>
              </View>
              <Text style={styles.appName}>Whale Pod</Text>
              <Text style={styles.tagline}>
                {isSignup ? 'Join the community' : 'Welcome back'}
              </Text>
            </Animated.View>

            {/* Form Section */}
            <Animated.View
              style={[
                styles.formSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Email</Text>
                <View
                  style={[
                    styles.inputContainer,
                    emailFocused && styles.inputContainerFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={emailFocused ? loginColors.accent : colors.textTertiary}
                    style={styles.inputIcon}
                  />
          <TextInput
            style={styles.input}
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
                <Text style={styles.inputLabel}>Password</Text>
                <View
                  style={[
                    styles.inputContainer,
                    passwordFocused && styles.inputContainerFocused,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={passwordFocused ? loginColors.accent : colors.textTertiary}
                    style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
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
                      rememberMe && styles.checkboxChecked,
                    ]}
                  >
                    {rememberMe && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
              </View>
                  <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>
          )}

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <Text style={styles.submitButtonText}>
                  {isSignup ? 'Create Account' : 'Sign In'}
                </Text>
                <Ionicons
                  name={isSignup ? 'person-add-outline' : 'arrow-forward'}
                  size={20}
                  color="#fff"
                  style={styles.submitButtonIcon}
                />
          </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              {/* Toggle Sign Up / Sign In */}
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleMode}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleText}>
                  {isSignup
                    ? 'Already have an account? '
                    : "Don't have an account? "}
                  <Text style={styles.toggleTextBold}>
                    {isSignup ? 'Sign In' : 'Sign Up'}
                  </Text>
            </Text>
          </TouchableOpacity>
            </Animated.View>

            {/* Footer */}
            <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
              <Text style={styles.footerText}>
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
    backgroundColor: colors.white,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: loginColors.purpleLight,
    opacity: 0.6,
  },
  decorativeCircle2: {
    position: 'absolute',
    top: height * 0.3,
    left: -120,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: loginColors.greenLight,
    opacity: 0.5,
  },
  decorativeCircle3: {
    position: 'absolute',
    bottom: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: loginColors.accentLight,
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
    backgroundColor: loginColors.accent,
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
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  formSection: {
    backgroundColor: colors.white,
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
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.base,
    height: 54,
  },
  inputContainerFocused: {
    borderColor: loginColors.accent,
    backgroundColor: colors.white,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
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
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: loginColors.accent,
    borderColor: loginColors.accent,
  },
  rememberMeText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: loginColors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    ...shadows.base,
  },
  submitButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
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
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.base,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    fontWeight: typography.fontWeight.medium,
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  toggleTextBold: {
    color: loginColors.accent,
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing['2xl'],
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
