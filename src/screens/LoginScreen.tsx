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
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import {
  useFonts,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Sora_400Regular,
  Sora_600SemiBold,
} from '@expo-google-fonts/sora';

const { height } = Dimensions.get('window');

// Design palette
const C = {
  bg: '#FAF9F6',
  text: '#1B1B18',
  textSecondary: '#52524E',
  textMuted: '#8A8A85',
  accent: '#2D5016',
  inputBg: '#F2F0EB',
  border: '#D6D3CC',
  accentLight: '#E4EDDE',
};

type AuthMode = 'main' | 'email' | 'phone';

const whaleLogo = require('../../assets/whale-logo.png');

export default function LoginScreen() {
  const auth = useAuth();

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    Sora_400Regular,
    Sora_600SemiBold,
  });

  // Mode
  const [authMode, setAuthMode] = useState<AuthMode>('main');

  // Email/password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  // Phone auth state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState(['', '', '', '', '', '']);
  const [awaitingPhoneCode, setAwaitingPhoneCode] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const phoneInputRefs = useRef<(TextInput | null)[]>([]);

  // Social auth loading
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    loadSavedCredentials();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (phoneCooldown > 0) {
      const timer = setTimeout(() => setPhoneCooldown(phoneCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneCooldown]);

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

  // ── Email/Password handlers ──

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    setSendingReset(true);
    try {
      await auth.resetPassword(resetEmail);
      Alert.alert('Reset Email Sent', 'If an account exists with this email, you will receive a password reset link.', [
        { text: 'OK', onPress: () => setShowForgotPassword(false) },
      ]);
      setResetEmail('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email');
    } finally {
      setSendingReset(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }
    try {
      if (isSignup) {
        await auth.signUp(email, password);
      } else {
        await auth.signIn(email, password);
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
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.7, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // ── Social auth handlers ──

  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    try {
      await auth.signInWithApple();
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert('Apple Sign In Failed', error.message || 'Something went wrong');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    try {
      await auth.signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Google Sign In Failed', error.message || 'Something went wrong');
    } finally {
      setSocialLoading(null);
    }
  };

  // ── Phone auth handlers ──

  const handleSendPhoneCode = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setPhoneLoading(true);
    try {
      await auth.sendPhoneVerificationCode(digits);
      setAwaitingPhoneCode(true);
      setPhoneCooldown(60);
      setTimeout(() => phoneInputRefs.current[0]?.focus(), 500);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneCodeChange = (text: string, index: number) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    if (cleanText.length <= 1) {
      const newCode = [...phoneCode];
      newCode[index] = cleanText;
      setPhoneCode(newCode);
      if (cleanText.length === 1 && index < 5) {
        phoneInputRefs.current[index + 1]?.focus();
      }
      if (cleanText.length === 1 && index === 5) {
        const fullCode = [...newCode.slice(0, 5), cleanText].join('');
        if (fullCode.length === 6) handleVerifyPhone(fullCode);
      }
    } else if (cleanText.length === 6) {
      setPhoneCode(cleanText.split(''));
      phoneInputRefs.current[5]?.focus();
      handleVerifyPhone(cleanText);
    }
  };

  const handlePhoneKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && phoneCode[index] === '' && index > 0) {
      phoneInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyPhone = async (fullCode?: string) => {
    const code = fullCode || phoneCode.join('');
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter all 6 digits.');
      return;
    }
    setPhoneLoading(true);
    try {
      const digits = phoneNumber.replace(/\D/g, '');
      const success = await auth.verifyPhoneCode(digits, code);
      if (!success) {
        Alert.alert('Verification Failed', 'The code you entered is incorrect. Please try again.');
        setPhoneCode(['', '', '', '', '', '']);
        phoneInputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Verification failed');
      setPhoneCode(['', '', '', '', '', '']);
      phoneInputRefs.current[0]?.focus();
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleResendPhoneCode = async () => {
    if (phoneCooldown > 0) return;
    setPhoneLoading(true);
    try {
      const digits = phoneNumber.replace(/\D/g, '');
      await auth.sendPhoneVerificationCode(digits);
      setPhoneCooldown(60);
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code');
    } finally {
      setPhoneLoading(false);
    }
  };

  const formatPhoneDisplay = (num: string) => {
    const digits = num.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const goBackToMain = () => {
    setAuthMode('main');
    setAwaitingPhoneCode(false);
    setPhoneCode(['', '', '', '', '', '']);
    setPhoneLoading(false);
    auth.clearPhoneVerification();
  };

  // ── Render sections ──

  const renderMainMode = () => (
    <Animated.View
      style={[
        styles.formSection,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Apple Sign In - iOS only */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={styles.appleButton}
          onPress={handleAppleSignIn}
          disabled={socialLoading !== null}
          activeOpacity={0.85}
        >
          {socialLoading === 'apple' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={20} color="#fff" style={styles.btnIcon} />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Google Sign In */}
      <TouchableOpacity
        style={styles.outlineButton}
        onPress={handleGoogleSignIn}
        disabled={socialLoading !== null}
        activeOpacity={0.85}
      >
        {socialLoading === 'google' ? (
          <ActivityIndicator color={C.text} />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color="#4285F4" style={styles.btnIcon} />
            <Text style={styles.outlineButtonText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Phone Sign In */}
      <TouchableOpacity
        style={styles.outlineButton}
        onPress={() => setAuthMode('phone')}
        disabled={socialLoading !== null}
        activeOpacity={0.85}
      >
        <Ionicons name="phone-portrait-outline" size={18} color={C.accent} style={styles.btnIcon} />
        <Text style={styles.outlineButtonText}>Continue with Phone</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Email option */}
      <TouchableOpacity
        style={styles.outlineButton}
        onPress={() => setAuthMode('email')}
        activeOpacity={0.85}
      >
        <Ionicons name="mail-outline" size={18} color={C.accent} style={styles.btnIcon} />
        <Text style={styles.outlineButtonText}>Continue with Email</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmailMode = () => (
    <Animated.View
      style={[
        styles.formSection,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={goBackToMain} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={24} color={C.text} />
      </TouchableOpacity>

      {/* Email Input */}
      <View style={styles.fieldGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <View
          style={[
            styles.inputContainer,
            emailFocused && styles.inputContainerFocused,
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={C.textMuted}
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
      <View style={styles.fieldGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <View
          style={[
            styles.inputContainer,
            passwordFocused && styles.inputContainerFocused,
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={C.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleEmailSubmit}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Remember Me & Forgot Password - Only on Login */}
      {!isSignup && (
        <View style={styles.loginOptionsRow}>
          <TouchableOpacity style={styles.rememberMeRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.7}>
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.rememberMeText}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setResetEmail(email); setShowForgotPassword(true); }} activeOpacity={0.7}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity style={styles.accentButton} onPress={handleEmailSubmit} activeOpacity={0.85}>
        <Text style={styles.accentButtonText}>
          {isSignup ? 'Create Account' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Toggle Sign Up / Sign In */}
      <TouchableOpacity style={styles.toggleButton} onPress={toggleMode} activeOpacity={0.7}>
        <Text style={styles.toggleText}>
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <Text style={styles.toggleTextBold}>
            {isSignup ? 'Sign In' : 'Sign Up'}
          </Text>
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderPhoneMode = () => (
    <Animated.View
      style={[
        styles.formSection,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={goBackToMain} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={24} color={C.text} />
      </TouchableOpacity>

      {!awaitingPhoneCode ? (
        <>
          {/* Phone number entry */}
          <View style={styles.phoneHeader}>
            <Text style={styles.phoneSectionTitle}>Enter your phone number</Text>
            <Text style={styles.phoneSectionSub}>
              We'll send you a verification code via SMS
            </Text>
          </View>

          <View style={styles.phoneDisplayRow}>
            <View style={styles.phonePrefixBox}>
              <Text style={styles.phonePrefixText}>+1</Text>
            </View>
            <View style={styles.phoneInputBox}>
              <TextInput
                style={styles.phoneTextInput}
                placeholder="(555) 555-5555"
                placeholderTextColor={C.textMuted}
                value={formatPhoneDisplay(phoneNumber)}
                onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={14}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.accentButton, phoneNumber.replace(/\D/g, '').length < 10 && styles.buttonDisabled]}
            onPress={handleSendPhoneCode}
            disabled={phoneLoading || phoneNumber.replace(/\D/g, '').length < 10}
            activeOpacity={0.85}
          >
            {phoneLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.accentButtonText}>Send Code</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* OTP verification */}
          <View style={styles.phoneHeader}>
            <Text style={styles.phoneSectionTitle}>Enter verification code</Text>
            <Text style={styles.phoneSectionSub}>
              Sent to +1 {formatPhoneDisplay(phoneNumber)}
            </Text>
          </View>

          <View style={styles.codeRow}>
            {phoneCode.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { phoneInputRefs.current[index] = ref; }}
                style={[
                  styles.codeBox,
                  digit !== '' && styles.codeBoxFilled,
                ]}
                value={digit}
                onChangeText={(text) => handlePhoneCodeChange(text, index)}
                onKeyPress={(e) => handlePhoneKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!phoneLoading}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.accentButton, phoneLoading && styles.buttonDisabled]}
            onPress={() => handleVerifyPhone()}
            disabled={phoneLoading}
            activeOpacity={0.85}
          >
            {phoneLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.accentButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't receive a code? </Text>
            <TouchableOpacity onPress={handleResendPhoneCode} disabled={phoneCooldown > 0 || phoneLoading}>
              {phoneCooldown > 0 ? (
                <Text style={styles.resendCooldown}>Resend in {phoneCooldown}s</Text>
              ) : (
                <Text style={styles.resendLink}>Resend Code</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </Animated.View>
  );

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Logo Section */}
            <Animated.View style={[styles.logoSection, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
              <Image source={whaleLogo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.appName}>Whale Pod</Text>
              <Text style={styles.tagline}>
                {authMode === 'email' ? (isSignup ? 'Join the community' : 'Welcome back') : 'Find your pod'}
              </Text>
            </Animated.View>

            {/* Mode-specific content */}
            {authMode === 'main' && renderMainMode()}
            {authMode === 'email' && renderEmailMode()}
            {authMode === 'phone' && renderPhoneMode()}

            {/* Footer */}
            <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
              <Text style={styles.footerText}>
                By continuing, you agree to our Terms of Service{'\n'}and Privacy Policy
              </Text>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal visible={showForgotPassword} animationType="fade" transparent onRequestClose={() => setShowForgotPassword(false)}>
        <TouchableWithoutFeedback onPress={() => setShowForgotPassword(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <TouchableOpacity onPress={() => setShowForgotPassword(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={24} color={C.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalDesc}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={C.textMuted}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <TouchableOpacity style={styles.accentButton} onPress={handleForgotPassword} disabled={sendingReset}>
                  {sendingReset ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.accentButtonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.1,
    paddingBottom: 40,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 220,
    height: 132,
  },
  appName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    color: C.text,
    marginTop: 14,
    letterSpacing: -0.3,
  },
  tagline: {
    fontFamily: 'Sora_400Regular',
    fontSize: 15,
    color: C.textMuted,
    marginTop: 6,
  },

  // Form section (shared wrapper)
  formSection: {
    marginBottom: 8,
  },

  // Buttons
  appleButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  appleButtonText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  outlineButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 16,
    marginBottom: 12,
  },
  outlineButtonText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
    color: C.text,
  },
  btnIcon: {
    marginRight: 10,
  },
  accentButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 16,
  },
  accentButtonText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.45,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    color: C.textMuted,
    marginHorizontal: 14,
  },

  // Back button
  backButton: {
    marginBottom: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Input fields
  fieldGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
    color: C.textMuted,
    marginBottom: 8,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    height: 52,
  },
  inputContainerFocused: {
    borderColor: C.accent,
  },
  input: {
    flex: 1,
    fontFamily: 'Sora_400Regular',
    fontSize: 15,
    color: C.text,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },

  // Remember me / Forgot
  loginOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    marginTop: 2,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  rememberMeText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    color: C.textSecondary,
  },
  forgotText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
    color: C.accent,
  },

  // Toggle sign up / sign in
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    color: C.textSecondary,
  },
  toggleTextBold: {
    fontFamily: 'Sora_600SemiBold',
    color: C.accent,
  },

  // Phone auth
  phoneHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  phoneSectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  phoneSectionSub: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
  },
  phoneDisplayRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 10,
  },
  phonePrefixBox: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
  },
  phonePrefixText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
    color: C.textSecondary,
  },
  phoneInputBox: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 52,
  },
  phoneTextInput: {
    fontFamily: 'Sora_400Regular',
    fontSize: 17,
    color: C.text,
    paddingVertical: 0,
  },

  // OTP code inputs
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: C.inputBg,
    fontFamily: 'Sora_600SemiBold',
    fontSize: 22,
    color: C.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  codeBoxFilled: {
    borderColor: C.accent,
    backgroundColor: C.accentLight,
  },

  // Resend
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  resendText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    color: C.textSecondary,
  },
  resendLink: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    color: C.accent,
  },
  resendCooldown: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    color: C.textMuted,
  },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    backgroundColor: C.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.text,
  },
  modalDesc: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
});
