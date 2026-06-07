/**
 * AppAlert — themed replacement for React Native's Alert.alert.
 *
 * Native alerts render the stock OS dialog and ignore the app's themes.
 * This renders an on-system dialog instead:
 *   - Dark (Pie):    #161616 card, hairline border, Sora type, lime primary
 *                    pill with black text, soft red for destructive.
 *   - Light (editorial): white card, hairline border, Playfair title,
 *                    InterTight body, ink primary pill, semantic red.
 *
 * API mirrors Alert.alert so call sites swap 1:1:
 *   AppAlert.alert(title, message?, buttons?, options?)
 *
 * <AppAlertHost /> must be mounted once at the app root (inside ThemeProvider).
 * NOTE: like any JS-rendered overlay, this cannot appear above an already-open
 * native <Modal>. Call sites that fire while a Modal is visible should keep
 * the native Alert or close their modal first.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { editorial } from '../../theme/designSystem';

export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AppAlertOptions {
  cancelable?: boolean;
}

interface AlertRequest {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options?: AppAlertOptions;
}

// Module-level bridge so AppAlert.alert() works from anywhere (services,
// handlers) without hooks. The host registers itself on mount.
let showAlert: ((req: AlertRequest) => void) | null = null;
const pendingQueue: AlertRequest[] = [];

// Screens that always render one theme regardless of the saved theme mode
// (login, onboarding) set this while mounted so alerts match what's on screen.
let themeOverride: 'light' | 'dark' | null = null;

export const AppAlert = {
  setThemeOverride(mode: 'light' | 'dark' | null) {
    themeOverride = mode;
  },
  alert(
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: AppAlertOptions,
  ) {
    const req: AlertRequest = {
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
      options,
    };
    if (showAlert) {
      showAlert(req);
    } else {
      pendingQueue.push(req);
    }
  },
};

export function AppAlertHost() {
  const { theme, isNewTheme } = useTheme();
  const [current, setCurrent] = useState<AlertRequest | null>(null);
  const queueRef = useRef<AlertRequest[]>([]);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  const present = useCallback((req: AlertRequest) => {
    setCurrent(prev => {
      if (prev) {
        queueRef.current.push(req);
        return prev;
      }
      return req;
    });
  }, []);

  useEffect(() => {
    showAlert = present;
    // Flush anything fired before mount
    while (pendingQueue.length > 0) {
      present(pendingQueue.shift()!);
    }
    return () => {
      showAlert = null;
    };
  }, [present]);

  useEffect(() => {
    if (current) {
      opacity.setValue(0);
      scale.setValue(0.92);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [current, opacity, scale]);

  const dismiss = useCallback((onDone?: () => void) => {
    Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setCurrent(null);
      onDone?.();
      // Show next queued alert, if any
      const next = queueRef.current.shift();
      if (next) {
        // Defer a frame so the Modal fully unmounts between alerts
        requestAnimationFrame(() => setCurrent(next));
      }
    });
  }, [opacity]);

  if (!current) return null;

  const dark = themeOverride ? themeOverride === 'dark' : isNewTheme;
  const colors = theme.colors;

  const card = {
    backgroundColor: dark ? '#161616' : '#FFFFFF',
    borderColor: dark ? 'rgba(255, 255, 255, 0.10)' : editorial.hairline,
    borderRadius: dark ? 20 : 14,
  };
  const titleStyle = {
    color: dark ? '#FFFFFF' : editorial.ink,
    fontFamily: dark ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold',
    fontSize: dark ? 17 : 20,
    letterSpacing: dark ? -0.2 : -0.3,
  };
  const messageStyle = {
    color: dark ? 'rgba(255, 255, 255, 0.78)' : editorial.muted,
    fontFamily: dark ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
  };

  const buttons = current.buttons;
  // Two or fewer buttons sit in a row (cancel left); more stack vertically.
  const horizontal = buttons.length <= 2;
  const ordered = horizontal
    ? [...buttons].sort((a, b) => (a.style === 'cancel' ? -1 : b.style === 'cancel' ? 1 : 0))
    : buttons;

  const buttonChrome = (style?: AppAlertButton['style']) => {
    if (style === 'cancel') {
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: dark ? 'rgba(255, 255, 255, 0.14)' : editorial.hairline,
        },
        text: { color: dark ? '#FFFFFF' : editorial.ink },
      };
    }
    if (style === 'destructive') {
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: dark ? 'rgba(252, 165, 165, 0.40)' : 'rgba(220, 38, 38, 0.40)',
        },
        text: { color: dark ? colors.error : editorial.red },
      };
    }
    return {
      container: { backgroundColor: dark ? colors.accentGreen : editorial.ink },
      text: { color: dark ? '#000000' : '#FFFFFF' },
    };
  };

  const onBackdropPress = () => {
    if (current.options?.cancelable) {
      const cancelBtn = buttons.find(b => b.style === 'cancel');
      dismiss(cancelBtn?.onPress);
    }
  };

  return (
    <Modal transparent statusBarTranslucent visible animationType="none" onRequestClose={onBackdropPress}>
      <Animated.View style={[styles.backdrop, { opacity, backgroundColor: dark ? 'rgba(0,0,0,0.75)' : 'rgba(27,27,24,0.45)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} />
        <Animated.View style={[styles.card, card, { transform: [{ scale }] }, !dark && styles.cardShadowLight]}>
          <Text style={[styles.title, titleStyle, !current.message && { marginBottom: 20 }]}>{current.title}</Text>
          {current.message ? (
            <Text style={[styles.message, messageStyle]}>{current.message}</Text>
          ) : null}
          <View style={[styles.buttonRow, !horizontal && styles.buttonColumn]}>
            {ordered.map((btn, i) => {
              const chrome = buttonChrome(btn.style);
              return (
                <TouchableOpacity
                  key={`${btn.text}-${i}`}
                  style={[styles.button, chrome.container, horizontal ? styles.buttonFlex : styles.buttonFull]}
                  activeOpacity={0.85}
                  onPress={() => dismiss(btn.onPress)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      chrome.text,
                      { fontFamily: dark ? 'Sora_600SemiBold' : 'InterTight_600SemiBold' },
                    ]}
                    numberOfLines={1}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  cardShadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonFull: {
    width: '100%',
  },
  buttonText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
