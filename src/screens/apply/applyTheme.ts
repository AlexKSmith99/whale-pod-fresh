// Design tokens for the Application / Waitlist signup flow.
// Teal-on-black, matching the reference screens (its own branded surface,
// distinct from the app's runtime light/dark themes).
export const APPLY = {
  bg: '#000000',
  teal: '#3E8FA3',
  tealPressed: '#35798B',
  disabledBg: '#161618',
  surface: '#1C1C1E', // input pills / selectable cards
  surfaceAlt: '#0E0E10',
  text: '#FFFFFF',
  textSecondary: '#9A9A9E',
  textMuted: '#6B6B70',
  placeholder: '#5C5C61',
  border: '#2A2A2C',
  danger: '#FF6B6B',
} as const;

// System font weights read closest to the reference (heavy geometric sans).
export const APPLY_FONT = {
  title: { fontSize: 34, fontWeight: '800' as const, color: APPLY.text, letterSpacing: -0.5 },
  label: { fontSize: 17, fontWeight: '600' as const, color: APPLY.textSecondary },
  body: { fontSize: 16, fontWeight: '500' as const, color: APPLY.text },
};
