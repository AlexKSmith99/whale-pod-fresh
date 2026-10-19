# whale pod — Full App Review

**Date:** 2026-10-18
**Scope:** `whale-pod-fresh` (React Native / Expo SDK 54, RN 0.81.5), ~53,000 lines across 149 TS/TSX files
**Method:** static review + type checker + linter + test suite. No code was changed.

> **Important caveat on all database findings.** This repo has no Supabase CLI link
> and migrations are applied by hand through the dashboard. Everything below about
> RLS is inferred from the migration *files*, which is the only record available.
> The live database may differ. **Verify in the Supabase dashboard before acting** —
> and equally, don't assume you're safe because the files look fine.

---

## 1. What the app is

whale pod is a social app for finding people to pursue shared goals with. The unit
is a **pod** (internally "pursuit"): someone creates one, others apply or join, and
once a minimum roster is reached the pod schedules a kickoff and gets a shared
workspace.

**Main features:** a filterable discovery feed; pod creation with cover images,
types/categories and location; an application + interview + review flow; member
management (invite, remove, leave) with structured reasons; a kickoff scheduling
flow built on time-slot proposals; a Team Board workspace (docs, tasks, agendas,
meeting notes, roles); pod group chat and 1:1 DMs; a calendar with recurring
meetings; Agora video calls; push notifications; connections; and a detailed
profile system with per-section privacy allowlists.

**How the pieces connect.** There is no navigation library. `src/AppContent.tsx`
holds ~30 `useState` values and acts as the store; it gates on
intro → auth → application status → onboarding, then hands every piece of state to
`src/navigation/AppRouter.tsx`, a ~520-line chain of `if (someState) return <Screen/>`
blocks. `src/navigation/useAppNavigation.ts` fakes a `navigation.navigate(screen, params)`
API by mapping screen names onto those same setters. Screens call Supabase either
through a service in `src/services/` or, very often, directly via the `supabase`
client. There is no backend of your own — Supabase (Postgres + Auth + Storage +
Realtime) is the entire backend, so **Row Level Security is the only thing standing
between a user and everyone else's data.** Theming runs through
`src/theme/ThemeContext.tsx` with two complete looks (editorial light, Pie dark).

**Overall health.** The product surface is genuinely impressive and the UI layer is
more polished and internally consistent than most codebases this age. The weakness
is structural: the security model has two serious holes, there is effectively no
automated test safety net, and the state/navigation architecture has reached the
size where it will start resisting change.

---

## 2. Automated checks

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **16 errors** |
| Lint | `npx expo lint` | **44 errors, 237 warnings** |
| Tests | `npm test` | 22 pass, **2 of 6 suites fail to run** |
| CI | — | **None configured** (no `.github/workflows`) |

Breakdown:

- **16 type errors.** 5 are in dead code (`useQueryHooks.ts`, see H-2). The rest are
  `Animated` style typing in `Skeleton.tsx` / `PodEngagementIndicator.tsx`, a
  use-before-declaration of `accent` in `ChatScreen.tsx:640` and
  `PodChatScreen.tsx:684`, and a missing field in `privacyService.ts:36`.
- **44 lint errors.** 42 are `react/no-unescaped-entities` (cosmetic). The two that
  matter are `react-hooks/rules-of-hooks` (H-3) and one `react/display-name`.
- **237 lint warnings**, heavily concentrated in `TeamWorkspaceScreen.tsx`, which
  alone has ~15 declared-but-never-used functions — strong evidence of abandoned
  half-implementations.
- **2 suites fail to even load**, both because `KeyboardAwareScreen.tsx` imports
  `react-native-keyboard-controller` and `jest.setup.ts` has no mock for it. So
  `LoginScreen` and `CreateScreen` — two of the highest-risk screens — have *zero*
  effective coverage despite having test files.

---

## 3. Findings

### CRITICAL

#### C-1. Every user profile is world-readable, including phone, DOB and address

**Where:** `supabase-migrations/043_optimize_rls_auth_calls.sql` (and originally
`001_initial_schema.sql`)

```sql
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);
```

**Why it matters.** There is no `TO authenticated` clause, so this grants to **all**
roles — including `anon`. The anon key is embedded in the shipped app binary and is
public by design. Sensitive columns on `profiles` are `phone`, `date_of_birth`, `age`,
`email`, `hometown`, `employer`, `gender`, `alcohol`, `drugs`, `selfie_url` and
`is_admin`. Anyone who extracts the anon key (trivial) can dump the entire user table.

*(Correction to an earlier draft of this report: `address`, `latitude` and `longitude`
live on `pursuits`, not `profiles`. The profile exposure is still phone + DOB + email
for every user, but it does not include home coordinates.)*

The privacy system does **not** mitigate this. `src/services/privacyService.ts`
filters by allowlist *in JavaScript, after the rows arrive*. I checked whether any
RLS policy consults `privacy_preferences` — the policies in migrations 038/039 only
govern the `privacy_preferences` table itself, not `profiles`. So a user who sets
their profile to "connections only" is protected in the UI and not at all in the API.

**Suggested fix.** Split the data: keep a genuinely public view (name, picture, bio)
and move sensitive columns behind either a restricted policy or a `security definer`
RPC that enforces the allowlist server-side. At absolute minimum add `TO authenticated`
so the table isn't readable with the anon key alone. Re-express the allowlist checks
as SQL so they're enforced where they can't be bypassed.

---

#### C-2. RLS is disabled outright on four meeting tables

**Where:** `supabase-migrations/010_disable_meetings_rls.sql:35-38`

```sql
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE kickoff_time_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_agenda_items DISABLE ROW LEVEL SECURITY;
```

The file's own comment says *"We'll implement proper RLS later once the recursion
issue is resolved."* I traced every `ENABLE ROW LEVEL SECURITY` statement across all
78 migration files in version order: **nothing re-enables these four tables after 010.**

**Why it matters.** Disabled RLS means no policy is consulted at all — for reads *or
writes*. Any authenticated user can read, modify, or delete any meeting, any
participant row, and any agenda item in the entire system, for pods they have
nothing to do with.

There's a trap here: migrations `035_fix_meetings_recursion.sql` and
`036_comprehensive_rls_fix.sql` both add `CREATE POLICY` statements for these tables.
That makes the problem *look* fixed on a skim. **Policies on a table with RLS
disabled are completely inert.** The migrations are a decoy.

**Suggested fix.** Re-enable RLS on all four tables, but only together with C-3 —
turning it on with the current policies would fix writes while leaving reads wide
open. Note the original recursion bug is the reason this was disabled; migrations
035/036 appear to have since addressed it by removing the recursive subqueries, so
re-enabling is likely safe now, but test the calendar immediately after.

---

### HIGH

#### H-1. Meeting read policies are `USING (true)` — no membership scoping

**Where:** `supabase-migrations/036_comprehensive_rls_fix.sql:33-58`

Every meeting policy added is `FOR SELECT TO authenticated USING (true)`. Even after
fixing C-2, any logged-in user could read every meeting, participant list and agenda
in the app. These look like they were written to escape the recursion bug rather than
to express an access rule.

**Suggested fix.** Scope to membership, e.g. `USING (EXISTS (SELECT 1 FROM team_members
tm WHERE tm.pursuit_id = meetings.pursuit_id AND tm.user_id = (select auth.uid())))`.
Use the `(select auth.uid())` form already standardised in migration 043. Avoid
re-introducing recursion by not referencing `meetings` from inside a `meetings` policy.

---

#### H-2. 374 lines of rotted, unused query hooks

**Where:** `src/hooks/useQueryHooks.ts` (374 lines)

`@tanstack/react-query` is wired up correctly at the app root — `App.tsx:16` imports
`queryClient` and `App.tsx:59` mounts `QueryClientProvider`. That part is fine and
should stay.

What's dead is `useQueryHooks.ts`: 374 lines of query hooks that **nothing imports**.
So the provider is mounted but no component actually uses react-query; all data
fetching goes through services or direct `supabase` calls instead.

Worse, it's *rotted* dead code — 5 of the 16 type errors come from it calling service
methods that no longer exist (`pursuitService.getMyPursuits` at `:93`,
`getAppliedPursuits` at `:104`, `messageService.getMessages` at `:154`,
`meetingService.getMyMeetings` at `:254`, `getMeeting` at `:265`).

**Why it matters.** It's a trap. Someone reaching for caching will find this, assume
it works, and wire it to methods that don't exist. It also permanently pollutes the
type-check baseline, which is how real errors get ignored.

**Suggested fix.** Delete `useQueryHooks.ts`. Keep `queryClient.ts`, the provider and
the dependency — the plumbing is sound and worth keeping for when caching is actually
adopted.

---

#### H-3. A "hook" is called after six early returns

**Where:** `src/AppContent.tsx:184`

`useAppNavigation(...)` is called after early returns at lines 138, 142, 150, 155, 169
and 174. ESLint flags this as a `rules-of-hooks` violation.

**Calibration — this is not currently a crash.** I read `src/navigation/useAppNavigation.ts`
in full: it contains no `useState`, `useEffect`, `useCallback`, `useMemo` or any other
hook. It's a plain factory with a misleading `use` prefix, so React's hook ordering is
not actually affected today.

**Why it still matters.** It is a loaded gun. The name says "hook", the file lives in
a codebase where hooks are everywhere, and the moment anyone adds a `useCallback`
inside it to memoise `navigate`, the app will crash with "rendered fewer hooks than
expected" — but only on the specific paths that hit an early return (logged out,
onboarding, waiting list), which are the paths least likely to be exercised in dev
with `DEV_BYPASS_GATE` on. It is also the only genuine lint error being drowned out by
42 cosmetic ones.

**Suggested fix.** Rename to `createAppNavigation` and drop the `use` prefix. One-line
change, removes the lint error and the landmine.

---

#### H-4. Effectively no automated test coverage, and no CI

**Where:** `src/**/__tests__/` (6 files), repo root

22 tests across ~53,000 lines. The 4 passing suites cover `podRoles`, `roleService`,
`PodEngagementIndicator` and `NotificationToast` — none of which is core logic. The
two suites that *do* target critical screens (`LoginScreen`, `CreateScreen`) fail to
load entirely (missing `react-native-keyboard-controller` mock in `jest.setup.ts`), so
they provide nothing while appearing in the suite list.

There is no CI workflow, so nothing stops a broken type-check or failing test from
being pushed — and indeed both are currently broken on `main`'s branch tip.

**Why it matters.** With no backend of your own, every business rule lives in screens
and RLS. Neither is tested. A refactor of any size is currently unsafe.

**Suggested fix.** First, add the keyboard-controller mock so the two existing suites
run — that's a few lines for immediate value. Then add a GitHub Action running
`tsc --noEmit`, `expo lint` and `jest` on PRs. Then backfill tests on `applicationService`,
`roleService` and the pod lifecycle before any further refactoring.

---

### MEDIUM

#### M-1. A failed pod fetch makes the screen vanish with no explanation

**Where:** `src/navigation/useAppNavigation.ts:104-108`

```js
} catch (error) {
  console.error('Error loading pursuit:', error);
  setViewingPodDetail(null);
}
```

**How it happens:** tap a pod notification on a weak connection → a loading placeholder
renders → the fetch throws → state resets to `null` → the user is silently dumped back
on the previous tab with no error, no retry, and no indication anything went wrong. It
reads as the app ignoring the tap.

(For the record, I checked the related `_loading` placeholder path and it *is* handled
correctly — `PursuitDetailScreen.tsx:192` skips data loading and `:689` renders a
loader. That part is fine.)

**Suggested fix.** Keep the detail screen mounted and show an inline error with a retry,
or surface an `AppAlert`.

---

#### M-2. No offline or network-failure handling anywhere

**Where:** codebase-wide

There is no `NetInfo` usage, no connectivity state, no request retry, and no offline
cache (the one `isConnected` variable in `UserProfileScreen.tsx:47` refers to *social*
connections, not the network). Every screen assumes the network works.

**Why it matters.** On a flaky mobile connection, failures surface as either an empty
list that looks like "no pods exist" or a raw red-box error. This is the single most
common real-world mobile condition and it's unhandled.

**Suggested fix.** Add `@react-native-community/netinfo`, a small shared "offline"
banner, and retry affordances on the main list screens.

---

#### M-3. Two different alert systems, one of which ignores the theme

**Where:** 27 native `Alert.alert` calls across 8 files vs 186 `AppAlert.alert`

`AppAlert` exists specifically because native alerts ignore the app's themes — its
own header says so. But `PodChatScreen`, `CreateScreen`, `PursuitDetailScreen`,
`MeetingDetailScreen`, `TeamWorkspaceScreen`, `MeetingNotesScreen`,
`TimeSlotProposalScreen` and `InterviewTimeSlotProposalScreen` still use the native one,
so a Pie-dark user intermittently gets a stock iOS dialog.

Note there's a legitimate exception documented in `AppAlert.tsx:15-17` — a JS overlay
can't render above an open native `<Modal>`, so some of these 27 may be deliberate.
Worth checking case by case rather than mass-replacing.

---

#### M-4. Safe areas handled by hardcoded pixel values

**Where:** 41 occurrences of `paddingTop`/`top` in the 50–69 range; only 6 files use
`SafeAreaView`/`useSafeAreaInsets`

Example: `PursuitDetailScreen.tsx` `styles.header` uses `paddingTop: 60` and
`heroActionCluster` uses `top: 56`.

**Why it matters.** These are tuned to the current iPhone notch. They will be wrong on
Android (where the status bar varies by OEM), on devices without a notch, and in
landscape. Android is a stated target — `expo run:android` is a script — but the layout
is iOS-calibrated throughout.

**Suggested fix.** Adopt `useSafeAreaInsets()` and replace the magic numbers
incrementally, starting with screen headers.

---

#### M-5. Orphaned screens and a half-built email-verification feature

**Where:** `src/screens/HomeScreen.tsx`, `src/screens/VerifyEmailScreen.tsx`,
`src/screens/team/MeetingNotesScreen.tsx`

None of these three is imported anywhere — all are unreachable.

The email-verification case is the notable one: `AuthContext` exposes
`pendingVerificationEmail`, `sendVerificationCode`, `verifyEmail` and
`clearPendingVerification` (`src/contexts/AuthContext.tsx:100-124`), and **zero
components consume any of them.** The API, the state and the screen all exist; nothing
is wired together. Either email verification silently isn't happening, or it's handled
entirely by Supabase settings and this code is vestigial — worth confirming which,
since it's a security-relevant flow.

Similarly, `onOpenMeetingNotes` is declared as a prop in both `FeedScreen.tsx:54` and
`PursuitDetailScreen.tsx:39` but is never passed by any parent and never called. Dead
plumbing to a dead screen.

Also tracked in git: `FeedScreen.tsx.backup` and `EditProfileScreen.tsx.backup`.

---

#### M-6. Four files are too large to reason about

| File | Lines |
|---|---|
| `src/screens/team/TeamWorkspaceScreen.tsx` | 3,748 |
| `src/screens/PursuitDetailScreen.tsx` | 2,544 |
| `src/screens/CreateScreen.tsx` | 2,348 |
| `src/screens/FeedScreen.tsx` | 2,179 |

`TeamWorkspaceScreen` is the acute case: a single component holding docs, tasks,
agendas, roles and notes, carrying ~15 dead functions and most of the 237 lint warnings.
These files each mix data fetching, business logic, both theme variants and styles.

**Suggested fix.** Extract per-feature child components and move data loading into
hooks or services. `TeamWorkspaceScreen` should be split by tab.

---

#### M-7. No unmount guards on async state updates

**Where:** only 2 files use `isMounted`/`AbortController`/`cancelled` patterns

Because `AppRouter` mounts and unmounts whole screens on every state change, a user
tapping between tabs mid-fetch routinely lands a `setState` on an unmounted component.
React 18 no longer warns about this, so it's invisible — but it still wastes work and
can resurrect stale data.

**Possible** (not confirmed): with the detail screen's many parallel loaders, a fast
back-then-forward could apply a previous pod's data to the newly opened one. I did not
reproduce this.

---

#### M-8. Require cycle between pod detail and pod chat

**Where:** `PursuitDetailScreen.tsx` ↔ `PodChatScreen.tsx` (reported by Metro at runtime)

Currently harmless because the import is used inside a render branch rather than at
module top level. These resolve to `undefined` without warning when evaluation order
shifts, which is a genuinely painful class of bug to diagnose later.

---

### LOW

- **L-1.** 42 `react/no-unescaped-entities` lint errors — purely cosmetic, but they bury
  the one real lint error (H-3). Mass-fixable.
- **L-2.** ~15 unused functions in `TeamWorkspaceScreen.tsx` (`loadContributions:555`,
  `enterEditMode:837`, `saveEditedDocument:893`, `handleDeleteRole:1310`, …). Each is an
  abandoned half-feature; they make the file look more complete than it is.
- **L-3.** `expo-av` is deprecated and slated for removal — migrate to `expo-audio` /
  `expo-video`.
- **L-4.** `src/AppContent.tsx:25` uses `require('./theme/ThemeContext').useTheme()`
  instead of a static import — defeats type checking on the theme.
- **L-5.** `resetPassword` sets `redirectTo: 'whalepod://reset-password'`
  (`AuthContext.tsx:130`) but no inbound deep-link handler exists anywhere (`Linking`
  is only ever used for `openURL`). **The code path in use is the 6-digit OTP via
  `verifyRecoveryCode`, which works without deep linking**, so this is likely vestigial
  rather than broken — but if any reset email renders that link, it will do nothing.
  Worth a 2-minute confirmation. (By contrast, Google OAuth's
  `whalepod://auth/callback` *is* fine — `WebBrowser.openAuthSessionAsync` captures the
  redirect itself.)
- **L-6.** No input validation layer. Text fields are written to Supabase largely
  unvalidated; length/format constraints are inconsistent.

### Checked and found clean

Worth recording so these don't get re-reviewed:

- **No secrets in the repo.** `.env` is gitignored and untracked; no hardcoded JWTs,
  service-role keys or API keys in `src/`. `scripts/generate-apple-secret.js` correctly
  takes the `.p8` path as an argument.
- **No password storage.** `AuthContext.tsx:195-196` removes `saved_email`/`saved_password`
  from AsyncStorage on sign-out, which looks alarming — but nothing ever *writes* those
  keys. It's leftover cleanup from a removed "remember me" feature, not a live leak.
- **Realtime subscriptions are cleaned up.** All 5 `.subscribe()` call sites have
  matching teardown.
- **Session handling is sound.** `getSession()` has a `.catch` that prevents a permanent
  loading state on network failure (`AuthContext.tsx:59-64`), and `supabase.ts` fails
  loudly if env vars aren't inlined.
- **Dev bypass flags are safe.** Everything in `src/config/devFlags.ts` is `__DEV__`-gated
  and strips from release builds.

---

## 4. Recommended next steps — top 5

1. **Verify and fix the `profiles` read policy (C-1).** Start by confirming the live
   policy in the dashboard. This is the one finding with real-world consequences for
   your users — phone numbers, birthdays and coordinates readable with a public key.
2. **Re-enable RLS on the four meeting tables and scope the policies (C-2 + H-1
   together).** Doing C-2 alone leaves reads open; doing H-1 alone changes nothing
   while RLS is off. Test the calendar right after, since recursion was the original
   reason it was disabled.
3. **Unblock the test suite and add CI (H-4).** Mock `react-native-keyboard-controller`
   in `jest.setup.ts` so the `LoginScreen`/`CreateScreen` suites run, then add a GitHub
   Action for `tsc` + `lint` + `jest`. Cheap, and it's the prerequisite for safely doing
   anything else on this list.
4. **Delete `useQueryHooks.ts` (H-2).** Removes 5 of 16 type errors and a trap that
   will otherwise cost someone an afternoon. Keep the provider and dependency.
5. **Rename `useAppNavigation` → `createAppNavigation` (H-3).** One line; clears the only
   substantive lint error and defuses a crash that would only ever appear in the
   logged-out and onboarding paths.

After those: M-2 (offline handling) is the highest-value *user-facing* fix, and M-6
(splitting `TeamWorkspaceScreen`) is the highest-value structural one.
