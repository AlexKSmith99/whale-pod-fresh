/**
 * Enhanced Haptic Manager
 * Centralized haptic feedback with accessibility support and named patterns
 */
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';

// Track if user prefers reduced motion
let reduceMotionEnabled = false;

// Initialize accessibility listener
const initAccessibilityListener = async () => {
  try {
    reduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionEnabled = enabled;
    });
  } catch (e) {
    console.warn('Failed to check reduce motion preference:', e);
  }
};

// Initialize on import
initAccessibilityListener();

/**
 * Check if haptics should be skipped
 */
const shouldSkipHaptics = (): boolean => {
  // Skip on web
  if (Platform.OS === 'web') return true;
  // Skip if reduce motion is enabled
  if (reduceMotionEnabled) return true;
  return false;
};

/**
 * Haptic patterns organized by interaction type
 */
export const HapticManager = {
  // =====================
  // SELECTION / NAVIGATION
  // =====================

  /**
   * Light selection - for toggles, tabs, radio buttons, segmented controls
   */
  selection: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.selectionAsync();
  },

  /**
   * Light tap - for small UI interactions, list items, chips
   */
  lightTap: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /**
   * Soft tap - very subtle, hover-like feedback
   */
  softTap: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },

  // =====================
  // BUTTONS / CTAs
  // =====================

  /**
   * Medium tap - for primary buttons, confirm actions
   */
  buttonTap: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /**
   * Heavy tap - for important/destructive actions
   */
  heavyTap: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * Rigid tap - crisp feeling for toggles switching
   */
  rigidTap: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  },

  // =====================
  // NOTIFICATIONS / STATUS
  // =====================

  /**
   * Success feedback - task complete, saved, submitted
   */
  success: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /**
   * Warning feedback - important notice, caution required
   */
  warning: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  /**
   * Error feedback - failed action, validation error
   */
  error: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },

  // =====================
  // COMPLEX PATTERNS
  // =====================

  /**
   * Double tap - confirmation, like/unlike actions
   */
  doubleTap: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise(r => setTimeout(r, 80));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /**
   * Rhythmic pulse - for notifications appearing, attention-grabbing
   */
  pulse: async (count: number = 2, interval: number = 100) => {
    if (shouldSkipHaptics()) return;
    for (let i = 0; i < count; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (i < count - 1) {
        await new Promise(r => setTimeout(r, interval));
      }
    }
  },

  /**
   * Escalating reveal - builds intensity (Light → Medium → Heavy)
   */
  reveal: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise(r => setTimeout(r, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise(r => setTimeout(r, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * Tick - for sliders, steppers, countdown timers
   */
  tick: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  },

  /**
   * Typing haptic - subtle per-character feedback
   */
  typingTick: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },

  /**
   * Long press activated - when a long press action triggers
   */
  longPressActivated: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * Swipe complete - when a swipe gesture completes an action
   */
  swipeComplete: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /**
   * Theme toggle - special pattern for theme switching
   */
  themeToggle: async () => {
    if (shouldSkipHaptics()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    await new Promise(r => setTimeout(r, 50));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  // =====================
  // UTILITY
  // =====================

  /**
   * Check if haptics are currently enabled
   */
  isEnabled: (): boolean => !shouldSkipHaptics(),

  /**
   * Manually check reduce motion state
   */
  checkReduceMotion: async (): Promise<boolean> => {
    return AccessibilityInfo.isReduceMotionEnabled();
  },
};

// Named export for backwards compatibility
export const hapticManager = HapticManager;

// Default export
export default HapticManager;
