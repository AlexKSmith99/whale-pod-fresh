import * as Haptics from 'expo-haptics';

/**
 * Haptic Feedback Service
 * Provides various haptic patterns for UI interactions
 */
export const hapticService = {
  /**
   * Light tap - for tab selection, button taps
   */
  lightTap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /**
   * Medium tap - for confirming actions
   */
  mediumTap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /**
   * Heavy tap - for important actions, deletions
   */
  heavyTap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * Soft tap - very subtle, for hover-like effects
   */
  softTap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },

  /**
   * Rigid tap - crisp feeling
   */
  rigidTap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  },

  /**
   * Success feedback - for completed actions
   */
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /**
   * Warning feedback
   */
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  /**
   * Error feedback
   */
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },

  /**
   * Selection changed - for toggles, pickers
   */
  selection: () => {
    Haptics.selectionAsync();
  },

  /**
   * Rhythmic pulse - for typing animations, loading states
   * @param count - number of pulses
   * @param interval - milliseconds between pulses
   */
  rhythmicPulse: async (count: number = 3, interval: number = 80) => {
    for (let i = 0; i < count; i++) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  },

  /**
   * Typing haptic - call this for each character in a typing animation
   */
  typingTick: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },

  /**
   * Dramatic reveal - escalating haptics
   */
  dramaticReveal: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise(resolve => setTimeout(resolve, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise(resolve => setTimeout(resolve, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * Heartbeat pattern
   */
  heartbeat: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise(resolve => setTimeout(resolve, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise(resolve => setTimeout(resolve, 400));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise(resolve => setTimeout(resolve, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * Countdown tick - for timers
   */
  countdownTick: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  },
};

export default hapticService;
