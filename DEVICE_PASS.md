# Device pass — pre-submission test plan

Everything built in the last stretch that no human has actually looked at.
Grouped by setup cost, because switching accounts and cold-starting are the
slow parts — doing these in order means you set up each context once.

Tick as you go. Anything that fails, note the screen and what you expected;
that's faster to act on than a description of the symptom.

**Migration state assumed:** 077–087 and 090 applied. **088 NOT applied** —
see §6, it needs code work first. 089 optional.

---

## 1. Signed in as yourself, normal device (~20 min)

Cheapest group, so get the breadth here.

### Create a Pod — the 8-page redesign
The big one. The whole point was that **no page should require scrolling.**

- [ ] Pages 1→8 in order; on each, confirm nothing is cut off at the bottom
      and you never need to scroll to reach a field or the Continue button
- [ ] **Page 5 is the one to watch** — location. `LocationMapView` is 200pt
      and got moved into a sheet for exactly this reason
- [ ] Open and close the location sheet; confirm the value lands back on the page
- [ ] Final page: the applications prompt reads **"Make it an Application?"**
      and is visually prominent, not a buried toggle
- [ ] Open the applications sheet from there, set something, close it
- [ ] Back-navigate from page 6 to page 2 — no state loss, no blank pages
- [ ] Actually create the pod and confirm it appears in the feed

### Pods tab — Saved (new)
- [ ] Four pills — Active / Past / Pending / Saved — all reachable; the row
      scrolls horizontally rather than clipping "Pending"
- [ ] Bookmark a pod from the feed, then find it under **Saved**
- [ ] Tap it → opens the pod detail (not a workspace you can't access)
- [ ] Unsave with the bookmark icon; it disappears immediately
- [ ] Confirm **Saved is gone from Profile → Pods** (moved, not duplicated)

### Profile
- [ ] Leadership badges render; tap one and the explainer popup opens and closes
- [ ] Lifestyle section shows Workout / Hobbies and **no Alcohol or Drugs**
      (dropped in 090) — and the whole section is absent if you have neither
- [ ] Profile → Pods shows Current and Past only

### Alerts tab
- [ ] The 6 backfilled connection notifications show an **avatar**, not an icon
- [ ] Other notification types still show their type icon (expected — their
      actor isn't recoverable; see 085)
- [ ] Grouped activity shows two overlapping bubbles
- [ ] Tapping a notification marks it read and navigates somewhere sensible

### Chat composer — the keyboard fix
Regression-check this everywhere, since the first fix missed a surface.

- [ ] A DM from the Messages list
- [ ] A pod chat from the Messages list
- [ ] A pod chat opened from inside a pod detail
- [ ] A new chat via the **+** button
- [ ] In each: tap the text field and confirm the **bottom tab bar does not
      cover it**, and the composer sits above the keyboard
- [ ] Pod chat cards in the list have the blue borders

### Settings
- [ ] Notifications → meeting reminders, both toggles (1 day / 1 hour)
- [ ] The OS-permission banner appears if notifications are denied, and the
      row actually opens Settings
- [ ] Toggle dark mode and confirm **no editorial colors leak into Pie dark**
      and vice versa — the one rule that's easy to break

---

## 2. Small screen (~10 min)

Boot an **iPhone SE (3rd gen)** — 667pt tall vs the 874 you've been testing on.
This is where vertical-budget assumptions fail.

- [ ] Create a Pod pages 1→8 again. Page 5 especially
- [ ] The four Pods filter pills
- [ ] A chat composer with the keyboard up
- [ ] Roll call card in a chat — it's tall

---

## 3. Signed out (~5 min)

- [ ] Sign out. The apply/login redesign appears in the **editorial** style
      (cream, Playfair, Carolina) — not the old teal
- [ ] "Apply for Membership" → first few steps render correctly
- [ ] "Log in" → email and phone modes both reachable
- [ ] **Forgot password**: enter your email, receive the code, complete a reset,
      sign in with the new password
- [ ] Legal links (Terms / Privacy) open and are readable

---

## 4. Cold start (~2 min)

The intro animation only plays on a true cold start — force-quit, don't background.

- [ ] Force-quit, relaunch. Whale icon plays at **double size**
- [ ] The page background matches the box behind the whale (no two-tone seam)
- [ ] Splash background is cream `#FAF9F6`, not the old teal `#7FDBCA`
      (requires a rebuild after the app.json change to show up)

---

## 5. Two accounts (~30 min)

The expensive group. Set up a second account once and do all of it.

### Roll Call — the headline feature
- [ ] **A:** in a shared pod chat, tap the hand icon → sheet opens
- [ ] If the pod has an upcoming meeting, it defaults to **A meeting**
- [ ] Post it. Card appears in the stream for both accounts
- [ ] **B:** tap I'M IN. Count updates, avatar appears
- [ ] **⚠️ The claim worth proving:** on a **meeting-backed** roll call, after B
      says IN, check **B's calendar** — B should show as attending that meeting.
      This is the single-source-of-truth design; if it fails, the feature is
      storing answers in the wrong place
- [ ] **B:** change to I'M OUT; calendar reflects it
- [ ] **A:** post a **proposed-date** roll call (A new date). B says IN
- [ ] **A:** Add to calendar → a meeting is created, B is already accepted,
      and the card flips to ON THE CALENDAR
- [ ] **A:** Close a roll call; buttons disappear, tally stays
- [ ] **B:** confirm B cannot close A's roll call (no Close shown)

### Messaging and routing
- [ ] **B's profile → Message** → lands in your chat with B, *every time*
      (do it 3–4 times; this was intermittent before the fix)
- [ ] Repeat from the connections list and from a pod member list

### Meetings
- [ ] **A:** create a meeting → it appears on **A's own calendar immediately**
- [ ] **B:** accept the invite — no error
- [ ] Participants list shows the **other** party, not yourself
- [ ] If min team size > 2, a third accepted applicant can see the other
      proposed kickoff times

### Applications and badges
- [ ] **B** applies to A's pod → A gets a notification **with B's avatar**
- [ ] A accepts → B gets a notification
- [ ] B's badges update once the criteria are met

### Account deletion (087) — use a THROWAWAY
> **Do not test this on your own account.** You'd lose `is_admin` — the only
> way to approve waitlisted applicants — and your App Review demo login.

- [ ] Sign up a throwaway **C**. C creates a pod; **B** joins it
- [ ] As **C**: Settings → delete account. Confirm it requires typing `DELETE`
- [ ] Copy is specific about what goes and what survives
- [ ] Deletion succeeds and signs C out
- [ ] **⚠️ The claim worth proving:** the pod still exists and **B is now its
      leader**, with chat history intact. If the pod vanished, 087's handover
      logic failed and a cascade ran
- [ ] Separately: a throwaway with a **solo** pod — that pod should be deleted

---

## 6. The 088 gate — code work, not testing

088 (`profiles` owner-only) **will break the app as the code stands.** Sixteen
files read another user's row from `profiles`; every one returns nothing once
the policy is owner-only:

| File | Reads |
|---|---|
| `src/utils/displayName.ts` | `fetchDisplayName(userId)` — **called app-wide** |
| `src/utils/pronouns.ts` | pronoun lookup — **called app-wide** |
| `src/screens/ChatScreen.tsx` | chat partner's name and avatar |
| `src/screens/PursuitDetailScreen.tsx` | pod creator |
| `src/screens/team/TeamWorkspaceScreen.tsx` | creator + member list |
| `src/screens/MeetingInvitationScreen.tsx` | meeting creator |
| `src/services/connectionService.ts` | the other party, ×3 |
| `src/services/meetingService.ts` | participants, ×4 |
| `src/services/applicationService.ts` | applicant and creator, ×3 |
| `src/services/rollCallService.ts` | author and responders |
| `src/services/roleService.ts` | requester |
| `src/hooks/useInterviewListeners.ts` | applicant |
| `src/hooks/useToastNavigation.ts` | message sender |

Most only need `name` and `profile_picture`, both of which `public_profiles`
already exposes — so the fix is mechanical: repoint cross-user reads at
`public_profiles`, and leave own-row reads on `profiles`.

**Do not run 088 until that's done.** It is the last open piece of the C-1
finding and nothing else depends on it, so it can trail the submission safely.

---

## 7. Known-acceptable, don't file these

- Notifications other than connection ones show type icons, not avatars —
  their actor isn't in the row (085)
- A user with no `profile_picture` shows an initial-letter circle — intended
- Demo accounts (089) can't be logged into — deliberate
- Roll call shows one avatar for a single answer; two bubbles need two
  notifications sharing a type and target
