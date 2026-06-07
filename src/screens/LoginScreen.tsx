import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  useFonts,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Sora_400Regular,
  Sora_600SemiBold,
} from '@expo-google-fonts/sora';
import { editorial } from '../theme/designSystem';
import { AppAlert } from '../components/ui/AppAlert';

const { height } = Dimensions.get('window');

// Editorial light-mode palette (matches FeedScreen ground truth).
const C = {
  bg: editorial.bg,
  text: editorial.ink,
  textSecondary: '#52524E',
  textMuted: editorial.muted,
  accent: editorial.ink,           // ink-filled primary CTAs
  link: editorial.carolinaDeep,    // discreet Carolina links
  carolina: editorial.carolina,    // active/focus accent
  border: editorial.hairline,      // hairline underlines/dividers
  surface: editorial.surface,
  carolinaTint: editorial.carolinaTint,
};

const whaleLogo = require('../../assets/whale-logo.png');

export default function LoginScreen() {
  const auth = useAuth();

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    Sora_400Regular,
    Sora_600SemiBold,
  });

  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState(['', '', '', '', '', '']);
  const [awaitingPhoneCode, setAwaitingPhoneCode] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const phoneInputRefs = useRef<(TextInput | null)[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // Which underline input is focused — drives the Carolina focus rule.
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [focusedCode, setFocusedCode] = useState<number | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // This screen always renders in the light editorial style regardless of the
  // saved theme — keep pop-up alerts matching it while mounted.
  useEffect(() => {
    AppAlert.setThemeOverride('light');
    return () => AppAlert.setThemeOverride(null);
  }, []);

  useEffect(() => {
    if (phoneCooldown > 0) {
      const timer = setTimeout(() => setPhoneCooldown(phoneCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneCooldown]);

  const handleSendPhoneCode = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      AppAlert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setPhoneLoading(true);
    try {
      await auth.sendPhoneVerificationCode(digits);
      setAwaitingPhoneCode(true);
      setPhoneCooldown(60);
      setTimeout(() => phoneInputRefs.current[0]?.focus(), 400);
    } catch (error: any) {
      AppAlert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneCodeChange = (text: string, index: number) => {
    const cleanText = text.replace(/[^0-9]/g, '');

    if (cleanText.length >= 6) {
      const sixDigits = cleanText.slice(0, 6);
      setPhoneCode(sixDigits.split(''));
      phoneInputRefs.current[5]?.focus();
      handleVerifyPhone(sixDigits);
      return;
    }

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
      return;
    }

    const newCode = [...phoneCode];
    for (let i = 0; i < cleanText.length && index + i < 6; i++) {
      newCode[index + i] = cleanText[i];
    }
    setPhoneCode(newCode);
    const nextFocus = Math.min(index + cleanText.length, 5);
    phoneInputRefs.current[nextFocus]?.focus();
    const joined = newCode.join('');
    if (joined.length === 6 && newCode.every((c) => c !== '')) {
      handleVerifyPhone(joined);
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
      AppAlert.alert('Invalid Code', 'Please enter all 6 digits.');
      return;
    }
    setPhoneLoading(true);
    try {
      const digits = phoneNumber.replace(/\D/g, '');
      const success = await auth.verifyPhoneCode(digits, code);
      if (!success) {
        AppAlert.alert('Verification Failed', 'The code you entered is incorrect. Please try again.');
        setPhoneCode(['', '', '', '', '', '']);
        phoneInputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      AppAlert.alert('Error', error.message || 'Verification failed');
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
      AppAlert.alert('Code Sent', 'A new verification code has been sent to your phone.');
    } catch (error: any) {
      AppAlert.alert('Error', error.message || 'Failed to resend code');
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

  const handleEmailSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      AppAlert.alert('Missing Info', 'Please enter both email and password.');
      return;
    }
    setEmailLoading(true);
    try {
      if (isSignup) {
        await auth.signUp(email, password);
      } else {
        await auth.signIn(email, password);
      }
    } catch (error: any) {
      AppAlert.alert('Error', error.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const goBackToPhoneEntry = () => {
    setAwaitingPhoneCode(false);
    setPhoneCode(['', '', '', '', '', '']);
    auth.clearPhoneVerification();
  };

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.carolina} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View style={[styles.logoSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Image source={whaleLogo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.appName}>whale pod</Text>
              <View style={styles.wordmarkUnderline} />
            </Animated.View>

            <Animated.View style={[styles.formSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              {mode === 'email' ? (
                <>
                  <Text style={styles.phoneSectionTitle}>{isSignup ? 'Create an account' : 'Sign in with email'}</Text>
                  <Text style={styles.phoneSectionSub}>
                    {isSignup ? 'Enter an email and password to get started.' : 'Enter your email and password.'}
                  </Text>

                  <View style={[styles.phoneInputBox, focusedField === 'email' && styles.phoneInputBoxFocused, { marginBottom: 12 }]}>
                    <TextInput
                      style={styles.phoneTextInput}
                      placeholder="Email"
                      placeholderTextColor={C.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoFocus
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  <View style={[styles.phoneInputBox, focusedField === 'password' && styles.phoneInputBoxFocused, { marginBottom: 20 }]}>
                    <TextInput
                      style={styles.phoneTextInput}
                      placeholder="Password"
                      placeholderTextColor={C.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      returnKeyType="done"
                      onSubmitEditing={handleEmailSubmit}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.accentButton, emailLoading && styles.buttonDisabled]}
                    onPress={handleEmailSubmit}
                    disabled={emailLoading}
                    activeOpacity={0.85}
                  >
                    {emailLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.accentButtonText}>{isSignup ? 'Sign Up' : 'Sign In'}</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setIsSignup(!isSignup)} style={{ marginTop: 16, alignItems: 'center' }} activeOpacity={0.6}>
                    <Text style={styles.resendText}>
                      {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                      <Text style={styles.resendLink}>{isSignup ? 'Sign In' : 'Sign Up'}</Text>
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setMode('phone')} style={{ marginTop: 20, alignItems: 'center' }} activeOpacity={0.6}>
                    <Text style={styles.resendLink}>Use phone number instead</Text>
                  </TouchableOpacity>
                </>
              ) : !awaitingPhoneCode ? (
                <>
                  <Text style={styles.phoneSectionTitle}>Enter your phone number</Text>
                  <Text style={styles.phoneSectionSub}>
                    We'll text you a 6-digit code to sign in or create an account.
                  </Text>

                  <View style={styles.phoneDisplayRow}>
                    <View style={styles.phonePrefixBox}>
                      <Text style={styles.phonePrefixText}>+1</Text>
                    </View>
                    <View style={[styles.phoneInputBox, focusedField === 'phone' && styles.phoneInputBoxFocused]}>
                      <TextInput
                        style={styles.phoneTextInput}
                        placeholder="(555) 555-5555"
                        placeholderTextColor={C.textMuted}
                        value={formatPhoneDisplay(phoneNumber)}
                        onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, '').slice(0, 10))}
                        keyboardType="phone-pad"
                        maxLength={14}
                        autoFocus
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
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

                  <TouchableOpacity onPress={() => setMode('email')} style={{ marginTop: 20, alignItems: 'center' }} activeOpacity={0.6}>
                    <Text style={styles.resendLink}>Use email instead</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={goBackToPhoneEntry}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="chevron-back" size={26} color={C.text} />
                  </TouchableOpacity>

                  <Text style={styles.phoneSectionTitle}>Enter verification code</Text>
                  <Text style={styles.phoneSectionSub}>
                    Sent to +1 {formatPhoneDisplay(phoneNumber)}
                  </Text>

                  <View style={styles.codeRow}>
                    {phoneCode.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={(ref) => { phoneInputRefs.current[index] = ref; }}
                        style={[
                          styles.codeBox,
                          digit !== '' && styles.codeBoxFilled,
                          focusedCode === index && styles.codeBoxFocused,
                        ]}
                        value={digit}
                        onChangeText={(text) => handlePhoneCodeChange(text, index)}
                        onKeyPress={(e) => handlePhoneKeyPress(e, index)}
                        onFocus={() => setFocusedCode(index)}
                        onBlur={() => setFocusedCode(null)}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
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

                  <View style={styles.resendRow}>
                    <Text style={styles.resendText}>Didn't receive a code? </Text>
                    <TouchableOpacity onPress={handleResendPhoneCode} disabled={phoneCooldown > 0 || phoneLoading} activeOpacity={0.6}>
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

            <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
              <Text style={styles.footerText}>
                By continuing, you agree to our Terms of Service{'\n'}and Privacy Policy
              </Text>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex1: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.08,
    paddingBottom: 40,
  },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 130, height: 78 },
  appName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 36,
    color: C.text,
    marginTop: 14,
    letterSpacing: -0.8,
  },
  wordmarkUnderline: {
    height: 2,
    width: 56,
    backgroundColor: C.carolina,
    marginTop: 8,
  },
  formSection: { marginBottom: 8 },

  phoneSectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: C.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  phoneSectionSub: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: C.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  phoneDisplayRow: { flexDirection: 'row', marginBottom: 20, gap: 12, alignItems: 'flex-end' },
  // Underline-style prefix (paper-flat, no filled box)
  phonePrefixBox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    height: 44,
  },
  phonePrefixText: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 17,
    color: C.textSecondary,
  },
  // Single-line underline input — transparent, hairline bottom border, no radius
  phoneInputBox: {
    flex: 1,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    height: 44,
  },
  // Focus rule — underline goes Carolina, 2px, for a crisp focus feel
  phoneInputBoxFocused: {
    borderBottomColor: C.carolina,
    borderBottomWidth: 2,
  },
  phoneTextInput: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 17,
    color: C.text,
    paddingVertical: 0,
  },

  // Ink-filled primary CTA pill — white text, paper-flat (no shadow)
  accentButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.accent,
    borderRadius: 9999,
    paddingVertical: 16,
  },
  accentButtonText: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 15,
    color: C.surface,
  },
  buttonDisabled: { opacity: 0.45 },

  backButton: { marginBottom: 16, marginLeft: -6, alignSelf: 'flex-start' },

  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  // Underline OTP box — transparent bg, hairline bottom rule, no radius
  codeBox: {
    width: 48,
    height: 56,
    backgroundColor: 'transparent',
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 24,
    color: C.text,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  codeBoxFilled: {
    borderBottomColor: C.carolina,
    borderBottomWidth: 2,
  },
  // Active box being typed into — Carolina rule even when empty, for crisp entry
  codeBoxFocused: {
    borderBottomColor: C.carolina,
    borderBottomWidth: 2,
  },

  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  resendText: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 14,
    color: C.textMuted,
  },
  resendLink: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 14,
    color: C.link,
  },
  resendCooldown: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 14,
    color: C.textMuted,
  },

  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
