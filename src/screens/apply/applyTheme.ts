import { editorial } from '../../theme/designSystem';

/**
 * Design tokens for the Application / Waitlist signup flow.
 *
 * This flow used to be its own teal-on-black island — a third look belonging to
 * neither of the app's themes (editorial light, Pie dark). It now runs on the
 * app's editorial palette, so a new user's first impression matches the product
 * they're signing up for.
 *
 * WHY EDITORIAL LIGHT SPECIFICALLY
 * Signup happens before there's a user, so there's no saved theme to honour.
 * The codebase already pins light for pre-auth surfaces: LoginScreen calls
 * AppAlert.setThemeOverride('light'), and IntroAnimation is hardcoded light.
 * Matching that keeps the intro → apply → login sequence continuous.
 *
 * The KEY NAMES are deliberately unchanged. Sixteen files reference these
 * tokens, and re-pointing values rather than renaming keys re-skins all of them
 * without touching one — the same trick the landing page's `.editorial` block
 * uses to re-theme shadcn primitives. `teal` is now Carolina blue; the name is
 * legacy, kept to avoid churning every call site for no behavioural gain.
 */
export const APPLY = {
  bg: editorial.bg,                 // cream paper
  teal: editorial.carolina,         // legacy name — Carolina is the accent now
  tealPressed: editorial.carolinaDeep,
  disabledBg: '#EFEDE6',            // flat, slightly darker than the page
  surface: editorial.surface,       // white cards / input pills
  surfaceAlt: '#F2F0EB',
  text: editorial.ink,
  textSecondary: '#52524E',
  textMuted: editorial.muted,
  placeholder: '#A8A89E',
  border: editorial.hairline,       // ALL borders and dividers
  danger: editorial.red,
} as const;

/**
 * Playfair for titles (the wordmark voice), InterTight for everything else —
 * matching the rest of the editorial surface. Replaces the system-font weights
 * the teal design used.
 */
export const APPLY_FONT = {
  title: {
    fontSize: 34,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: APPLY.text,
    letterSpacing: -0.6,
  },
  label: {
    fontSize: 17,
    fontFamily: 'InterTight_600SemiBold',
    color: APPLY.textSecondary,
  },
  body: {
    fontSize: 16,
    fontFamily: 'InterTight_600SemiBold',
    color: APPLY.text,
  },
};
