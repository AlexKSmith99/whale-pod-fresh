// ⚠️ DEV-ONLY escape hatches. Every flag below is AND-gated by __DEV__, so it is
// physically impossible for any of these to take effect in a production/release
// build — the branch is dead code that Metro strips. Toggle them from .env (no
// code edits), then restart Metro with a cleared cache so the new value inlines:
//
//   EXPO_PUBLIC_DEV_BYPASS_GATE=true   # skip the waitlist + onboarding gate
//   EXPO_PUBLIC_DEV_MOCK_USER=true     # fake a logged-in user (skip login too)
//   EXPO_PUBLIC_DEV_MOCK_USER_ID=<uuid># id for the mock user (optional)
//
// Notes:
// - With a REAL login, BYPASS_GATE alone drops you into the app with real data
//   even if your account is stuck on 'pending' or hasn't finished onboarding.
// - MOCK_USER is a last resort when you have no working account (e.g. signup is
//   broken): the app shell renders without logging in, but user-scoped Supabase
//   queries return EMPTY under RLS because there's no real JWT. Great for layout/
//   styling work, misleading for data screens. Prefer a real login when you can.

const isOn = (v?: string) => v === 'true' || v === '1';

export const DEV_BYPASS_GATE = __DEV__ && isOn(process.env.EXPO_PUBLIC_DEV_BYPASS_GATE);
export const DEV_MOCK_USER = __DEV__ && isOn(process.env.EXPO_PUBLIC_DEV_MOCK_USER);
export const DEV_MOCK_USER_ID =
  process.env.EXPO_PUBLIC_DEV_MOCK_USER_ID || '00000000-0000-4000-8000-000000000001';
