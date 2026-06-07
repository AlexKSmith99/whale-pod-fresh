/**
 * Shared bits for the settings suite (Pie-style, tailored to Whale Pod).
 */
import { editorial } from '../../theme/designSystem';

// TODO: swap for a real support inbox (e.g. support@whalepod.app) once it exists.
// Also referenced as [SUPPORT EMAIL] in src/constants/legalContent.ts.
export const SUPPORT_EMAIL = 'alex.k.smith99@gmail.com';

// TODO: swap for the production domain when it launches.
export const SHARE_URL = 'https://whale-pod-landing.vercel.app';

export const settingsTheme = (isNewTheme: boolean) => ({
  bg: isNewTheme ? '#000000' : editorial.bg,
  card: isNewTheme ? '#161616' : editorial.surface,
  cardAlt: isNewTheme ? '#1F1F1F' : '#F2F0EB',
  text: isNewTheme ? '#FFFFFF' : editorial.ink,
  textSecondary: isNewTheme ? 'rgba(255,255,255,0.78)' : '#52524E',
  muted: isNewTheme ? 'rgba(255,255,255,0.50)' : editorial.muted,
  hairline: isNewTheme ? 'rgba(255,255,255,0.10)' : editorial.hairline,
  accent: isNewTheme ? '#C8FF6B' : editorial.carolina,
  accentDeep: isNewTheme ? '#94C44E' : editorial.carolinaDeep,
  pill: isNewTheme ? '#FFF9EC' : editorial.ink,          // logout/CTA pill fill (Pie cream in dark)
  pillText: isNewTheme ? '#000000' : '#FFFFFF',
  danger: isNewTheme ? '#FCA5A5' : editorial.red,
  titleFont: isNewTheme ? 'Sora_700Bold' : 'PlayfairDisplay_700Bold',
  bodyFont: isNewTheme ? 'Sora_600SemiBold' : 'InterTight_600SemiBold',
});
