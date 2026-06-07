import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as legacyColors, typography, spacing, borderRadius, shadows } from '../theme/designSystem';
import { useTheme } from '../theme/ThemeContext';
import { getThemedStyles } from '../theme/themedStyles';
import GrainTexture from '../components/ui/GrainTexture';
import { editorial } from '../theme/designSystem';

const { height } = Dimensions.get('window');

// Light mode login colors — editorial palette (Carolina-blue accent, hairlines).
const loginColorsLight = {
  accent: editorial.carolinaDeep,           // discreet Carolina accent text/icons
  accentLight: editorial.carolinaTint,      // tint for selected OTP / icon halo
  green: editorial.carolina,
  greenLight: editorial.carolinaTint,
  purple: editorial.ink,
  purpleLight: editorial.carolinaTint,
};

// Original dark-mode decorative-circle literals — pinned so dark renders
// pixel-identical even though the light palette above changed.
const decorCirclesDark = {
  purpleLight: '#2D5016',
  greenLight: '#D1FAE5',
  accentLight: '#E4EDDE',
};

// Dark mode login colors
const loginColorsDark = {
  accent: '#A8E6A3',
  accentLight: 'rgba(168, 230, 163, 0.15)',
  green: '#A8E6A3',
  greenLight: 'rgba(168, 230, 163, 0.15)',
  purple: '#2D5016',
  purpleLight: 'rgba(129, 140, 248, 0.15)',
};

interface Props {
  email: string;
  onVerify: (code: string) => Promise<void>;
  onResendCode: () => Promise<void>;
  onBack: () => void;
}

export default function VerifyEmailScreen({ email, onVerify, onResendCode, onBack }: Props) {
  const { theme, isNewTheme } = useTheme();
  const colors = theme.colors;
  const themedStyles = getThemedStyles(colors, isNewTheme);
  const loginColors = isNewTheme ? loginColorsDark : loginColorsLight;

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
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
    ]).start();

    // Focus first input
    setTimeout(() => inputRefs.current[0]?.focus(), 500);
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (text: string, index: number) => {
    // Only allow numbers
    const cleanText = text.replace(/[^0-9]/g, '');

    if (cleanText.length <= 1) {
      const newCode = [...code];
      newCode[index] = cleanText;
      setCode(newCode);

      // Auto-advance to next input
      if (cleanText.length === 1 && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all fields are filled
      if (cleanText.length === 1 && index === 5) {
        const fullCode = [...newCode.slice(0, 5), cleanText].join('');
        if (fullCode.length === 6) {
          handleVerify(fullCode);
        }
      }
    } else if (cleanText.length === 6) {
      // Handle paste of full code
      const digits = cleanText.split('');
      setCode(digits);
      inputRefs.current[5]?.focus();
      handleVerify(cleanText);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && code[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const verifyCode = fullCode || code.join('');

    if (verifyCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);
    try {
      await onVerify(verifyCode);
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'The code you entered is incorrect. Please try again.');
      // Clear the code on failure
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setResendLoading(true);
    try {
      await onResendCode();
      setResendCooldown(60); // 60 second cooldown
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <View style={[styles.container, { backgroundColor: isNewTheme ? colors.background : legacyColors.white }]}>
      <StatusBar barStyle={isNewTheme ? 'light-content' : 'dark-content'} backgroundColor={isNewTheme ? colors.background : legacyColors.white} />
      {isNewTheme && <GrainTexture opacity={0.06} />}
      {/* Decorative circles — editorial Carolina tints in light; dark keeps
          its original tints pinned so it renders pixel-identical. */}
      <View style={[styles.decorativeCircle1, { backgroundColor: isNewTheme ? decorCirclesDark.purpleLight : loginColorsLight.purpleLight }]} />
      <View style={[styles.decorativeCircle2, { backgroundColor: isNewTheme ? decorCirclesDark.greenLight : loginColorsLight.greenLight }]} />
      <View style={[styles.decorativeCircle3, { backgroundColor: isNewTheme ? decorCirclesDark.accentLight : loginColorsLight.accentLight }]} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            {/* Back Button — plain outline glyph in light (no filled circle); dark unchanged */}
            <TouchableOpacity
              style={[
                styles.backButton,
                isNewTheme
                  ? { backgroundColor: colors.surfaceAlt }
                  : { backgroundColor: 'transparent', width: 36, height: 36 },
              ]}
              onPress={onBack}
              activeOpacity={isNewTheme ? 0.85 : 0.6}
            >
              <Ionicons name={isNewTheme ? 'arrow-back' : 'chevron-back'} size={isNewTheme ? 24 : 26} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* Header Section */}
            <Animated.View
              style={[
                styles.headerSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: isNewTheme ? decorCirclesDark.accentLight : loginColorsLight.accentLight }]}>
                <Ionicons name="mail-open-outline" size={48} color={loginColors.accent} />
              </View>
              <Text style={[styles.title, { color: legacyColors.textPrimary }, !isNewTheme && { fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 }]}>Verify Your Email</Text>
              <Text style={[styles.subtitle, { color: legacyColors.textSecondary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold', lineHeight: 20 }]}>
                We've sent a 6-digit verification code to
              </Text>
              <Text style={[styles.email, { color: loginColors.accent }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>{maskedEmail}</Text>
            </Animated.View>

            {/* Code Input Section */}
            <Animated.View
              style={[
                styles.formSection,
                { backgroundColor: isNewTheme ? colors.surface : legacyColors.white },
                // Light: editorial card — hairline border, soft shadow, tighter radius
                !isNewTheme && {
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: editorial.hairline,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.06,
                  shadowRadius: 14,
                  elevation: 3,
                },
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={[styles.inputLabel, { color: legacyColors.textPrimary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11, color: editorial.muted }]}>Enter verification code</Text>
              <View style={styles.codeContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.codeInput,
                      { borderColor: legacyColors.border, backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary, color: legacyColors.textPrimary },
                      // Light: underline OTP boxes — transparent bg, hairline bottom rule, no radius
                      !isNewTheme && { backgroundColor: 'transparent', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: editorial.hairline, borderRadius: 0, fontFamily: 'InterTight_600SemiBold' },
                      digit && (isNewTheme
                        ? [styles.codeInputFilled, { borderColor: loginColors.accent, backgroundColor: loginColorsLight.accentLight }]
                        : { borderBottomColor: editorial.carolina, borderBottomWidth: 2 }),
                    ]}
                    value={digit}
                    onChangeText={(text) => handleCodeChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
              </View>

              {/* Verify Button — light: ink-filled pill (paper-flat); dark unchanged */}
              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  { backgroundColor: loginColorsLight.accent },
                  !isNewTheme && { backgroundColor: editorial.ink, borderRadius: 9999, shadowOpacity: 0, elevation: 0 },
                  loading && styles.verifyButtonDisabled,
                ]}
                onPress={() => handleVerify()}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={isNewTheme ? colors.background : '#fff'} />
                ) : (
                  <>
                    <Text style={[styles.verifyButtonText, { color: isNewTheme ? colors.background : legacyColors.white }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>Verify Email</Text>
                    <Ionicons name="checkmark-circle-outline" size={20} color={isNewTheme ? colors.background : '#fff'} style={styles.buttonIcon} />
                  </>
                )}
              </TouchableOpacity>

              {/* Resend Code */}
              <View style={styles.resendContainer}>
                <Text style={[styles.resendText, { color: legacyColors.textSecondary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold', color: editorial.muted }]}>Didn't receive the code? </Text>
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={resendCooldown > 0 || resendLoading}
                >
                  {resendLoading ? (
                    <ActivityIndicator size="small" color={loginColors.accent} />
                  ) : resendCooldown > 0 ? (
                    <Text style={[styles.resendCooldown, { color: legacyColors.textTertiary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>Resend in {resendCooldown}s</Text>
                  ) : (
                    <Text style={[styles.resendLink, { color: loginColors.accent }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>Resend Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Help Text */}
            <Animated.View style={[styles.helpSection, { opacity: fadeAnim }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.helpText, { color: legacyColors.textTertiary }, !isNewTheme && { fontFamily: 'InterTight_600SemiBold' }]}>
                Check your spam folder if you don't see the email
              </Text>
            </Animated.View>
          </View>
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
    top: height * 0.4,
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
  content: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: height * 0.06,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: legacyColors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: loginColorsLight.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
    textAlign: 'center',
  },
  email: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: loginColorsLight.accent,
    marginTop: spacing.xs,
  },
  formSection: {
    backgroundColor: legacyColors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing.xl,
    ...shadows.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: legacyColors.border,
    backgroundColor: legacyColors.backgroundSecondary,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: legacyColors.textPrimary,
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: loginColorsLight.accent,
    backgroundColor: loginColorsLight.accentLight,
  },
  verifyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: loginColorsLight.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    ...shadows.base,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: legacyColors.white,
  },
  buttonIcon: {
    marginLeft: spacing.sm,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  resendText: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textSecondary,
  },
  resendLink: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: loginColorsLight.accent,
  },
  resendCooldown: {
    fontSize: typography.fontSize.base,
    color: legacyColors.textTertiary,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  helpText: {
    fontSize: typography.fontSize.sm,
    color: legacyColors.textTertiary,
  },
});
