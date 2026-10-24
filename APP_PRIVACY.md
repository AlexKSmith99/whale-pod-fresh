# App Privacy answers — derived from the code

For the **App Privacy** section of App Store Connect (*App Store → App Privacy →
Edit*). Every row below traces to something the code actually does; file paths
are given so you can re-check when the code changes.

This file lives in the repo on purpose: when collection changes, this has to
change with it. A mismatch between this form and real behavior is both a
rejection risk and a regulatory one, and Apple treats the form as a binding
declaration.

Three answers were judgment calls rather than lookups. §3.1 (health data) is
now **resolved** — the fields were dropped. §3.2 and §3.3 have recommendations
attached and are low-stakes either way.

---

## 1. The two global answers

**Do you or your third-party partners use data for tracking?** → **No.**

There are no analytics, attribution, crash-reporting or advertising SDKs in
`package.json` — no Firebase, Sentry, Amplitude, Segment, Mixpanel, AppsFlyer,
Adjust, Meta SDK. Nothing reads the IDFA. No data goes to a data broker.

This is worth getting right: answering No here means **no App Tracking
Transparency prompt**, which is one less thing to implement and one less
rejection surface. Don't add an analytics SDK without revisiting this answer.

**Is data linked to the user's identity?** → **Yes, for everything.**

Every table keys on a `user_id`/`profiles.id`. There is no anonymous or
aggregated collection anywhere in the app, so every category below is "Linked
to You."

---

## 2. Category-by-category

Purpose codes: **AF** = App Functionality, **PP** = Product Personalization.
Nothing is collected for Analytics or Advertising.

### Contact Info — YES

| Type | Collected | Purpose | Where |
|---|---|---|---|
| Name | Yes | AF | `profiles.name`, set in `ApplyFlow.tsx` |
| Email Address | Yes | AF | Supabase Auth + `profiles.email` |
| Phone Number | Yes | AF | Phone OTP sign-in, `AuthContext.tsx:155` |
| Physical Address | Yes | AF | `pursuits.location` / `neighborhood` / `address`, `profiles.hometown` |
| Other Contact Info | Yes | AF, PP | Social handles: `instagram`, `linkedin`, `github`, `facebook`, `portfolio_website` |

**Physical Address needs a note.** It's *typed*, never device-derived — there is
no `expo-location` dependency and nothing calls `getCurrentPositionAsync`. That
is why **Location is answered No** below. Don't conflate the two; declaring
Precise Location when you don't collect it invites questions you can't answer.

### Health & Fitness — YES, Fitness only

| Type | Collected | Purpose | Where |
|---|---|---|---|
| Fitness | **Yes** | PP | `profiles.workout_level` |
| Health | **No** | — | `alcohol` and `drugs` were dropped in migration 090 |

Declare **Fitness** and leave **Health** unchecked. Migration 090 removed the
two substance-use fields precisely so this answer could be No — see §3.1.

### User Content — YES

| Type | Collected | Purpose | Where |
|---|---|---|---|
| Photos or Videos | Yes | AF | `profile-pictures` + `pod-covers` buckets; `profile_pictures`, `selfie_url` |
| Emails or Text Messages | Yes | AF | `messages` (DMs), `pod_chat_messages` (pod chat) |
| Audio Data | Yes | AF | Agora video/voice calls — `react-native-agora` |
| Other User Content | Yes | AF | `pursuits` descriptions, `reviews` (user-to-user), team board content, roll call notes |

**Audio Data is easy to miss.** `react-native-agora` is a real dependency and
`meetings` carries `agora_channel_name` / `agora_token`, so the app transmits
microphone and camera streams through Agora. Declare it.

### Identifiers — YES

| Type | Collected | Purpose | Where |
|---|---|---|---|
| User ID | Yes | AF | `auth.users.id` throughout |
| Device ID | Yes | AF | `push_tokens.expo_push_token` (`014_push_notifications.sql`) |

### Other Data — YES

| Type | Collected | Purpose | Where |
|---|---|---|---|
| Other Data Types | Yes | AF, PP | Date of birth and age; gender; college; employer; bio; interests; hobbies; pod type and category preferences; team size and role preferences; privacy allowlists; notification preferences |

Date of birth is collected at signup (`BirthdayStep`) and stored as both
`date_of_birth` and a derived `age`. Apple has no dedicated DOB category, so it
belongs here.

### Answer NO to all of these

| Category | Why you can confidently say No |
|---|---|
| **Location** (Precise / Coarse) | No `expo-location`, no device location API called anywhere. Addresses are typed. |
| **Financial Info** | No payments, no IAP, no Stripe. |
| **Contacts** | The address book is never read. Sharing uses the OS share sheet. |
| **Browsing History** | None. |
| **Search History** | Feed search (`keywordFilter`) is in-memory and never persisted. |
| **Purchases** | No IAP or subscriptions. |
| **Diagnostics** (Crash / Performance) | No crash reporter. `console.log` only, which never leaves the device. |
| **Sensitive Info** | None of Apple's listed types — no race or ethnicity, sexual orientation, pregnancy, disability, religious or political belief, union membership, genetic or biometric data. See §3.2 on gender. |

### Usage Data — see §3.3

---

## 3. The judgment calls

### 3.1 Health data — RESOLVED

**Decision: `alcohol` and `drugs` were dropped** (migration 090, 2026-10-24).

They were the only reason to declare Health & Fitness → **Health**, which
brings extra review scrutiny, stricter handling expectations under GDPR
special-category rules, and a disclosure obligation — all for two free-text
fields that did nothing for pod matching.

`workout_level` stays, so **Fitness** is still declared. That's a much cheaper
declaration than Health and genuinely relevant to fitness pods.

Removed from: `profiles` (090), `get_viewable_profile`'s allowlist (090),
`EditProfileScreen` inputs, and the Lifestyle sections of `ProfileScreen` and
`UserProfileScreen`. If this is ever reversed, Health goes back on the form.

### 3.2 Gender

`profiles.gender` is collected at signup. Apple's **Sensitive Info** definition
lists *sexual orientation* but not gender identity, so gender belongs under
**Other Data** rather than Sensitive. That's the standard reading and what §2
assumes. If you'd rather be maximally conservative you can declare Sensitive
Info instead; it costs you nothing but extra scrutiny.

### 3.3 Usage Data (Product Interaction)

Borderline, and I'd rather flag it than quietly pick for you.

**Argument for Yes:** the engagement indicator (the flame / jalapeño on pod
cards) is computed from message volume and meeting activity, and read receipts
are stored (`pod_chat_read_status`, `messages.is_read`). Those are app
interactions, recorded and tied to a user.

**Argument for No:** Apple's category is aimed at analytics-style interaction
logging. Nothing here leaves your database, and it all exists to make a feature
work rather than to measure users.

**My recommendation: declare it, purpose App Functionality only.** It's
accurate, it costs you nothing — you're already declaring everything as linked
and nothing as tracking — and it means no reviewer can say you under-declared.

---

## 4. Third-party processors

The form doesn't ask for these by name, but your privacy policy must — and
**it already does.** `legalContent.ts §8` lists Supabase, Twilio Verify, Agora,
Expo push, OpenStreetMap/Nominatim, map tile providers and the app stores. That
list is more complete than a first pass through the dependencies suggests, so
the job here is verifying it's still accurate rather than writing it.

| Processor | What it receives | Notes |
|---|---|---|
| **Supabase** | Everything — database, auth, storage, realtime | Name the hosting region |
| **Expo push** (`exp.host`) | Push tokens, notification titles and bodies | See below |
| **Agora** | Live audio and video during calls | The processor most likely to draw questions; check residency terms |
| **Twilio Verify** | Phone numbers, for SMS OTP | Via Supabase Auth phone sign-in |
| **Nominatim / OpenStreetMap** | Typed meeting addresses, to geocode | See the Location note below |
| **Apple** | Apple Sign In identity tokens | `usesAppleSignIn: true`, `AuthContext.tsx:199` |

**Push bodies cross a boundary.** `notificationService` puts real content in
notification bodies — message previews, who did what — so chat content reaches
Expo's servers. Normal for Expo push and fine, but the policy shouldn't imply
messages never leave Supabase.

**Why geocoding still doesn't make Location "Yes."** Typed addresses are sent to
Nominatim and the resulting lat/long is stored on `pursuits`. That's a
third-party disclosure worth naming in the policy, but Apple's Location
categories describe *device-derived* location of the user. This is a
user-entered address for a meeting place, which may not be anywhere near the
user. Location stays No — but this is the kind of detail a reviewer could ask
about, so know the reasoning rather than just the answer.

---

## 5. Before you submit — cross-check these

- [ ] Every "Yes" above is reflected in the policy at `legalContent.ts`
      (the processor list in §8 is already complete — just keep it that way)
- [ ] **Fill in the placeholders in `legalContent.ts`.** Still literal, as of
      2026-10-24: `[SUPPORT EMAIL]` ×19, `[LEGAL ENTITY NAME]` ×5,
      `[LEGAL ADDRESS]` ×3, `[WEBSITE URL]` ×2, plus
      `LEGAL_LAST_UPDATED = '[EFFECTIVE DATE — e.g., May 1, 2026]'`.
      Publishing a privacy policy that reads "email us at [SUPPORT EMAIL]" is
      a bad look at best and arguably a defective disclosure at worst
- [ ] The privacy policy is deployed and publicly reachable, and that URL is in
      App Store Connect
- [ ] Account deletion claim in the policy matches 087's actual behavior
      (updated 2026-10-24 — pods are reassigned, not deleted)
- [x] §3.1 resolved — alcohol/drugs dropped in 090, declare Fitness not Health
- [ ] No analytics SDK was added after this file was written
