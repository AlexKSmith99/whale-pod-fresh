// In-app legal copy. Source of truth lives in /legal/*.md — keep these strings
// in sync when you update the markdown files. Renderer: src/screens/LegalScreen.tsx
//
// Markup conventions used by the renderer:
//   # / ## / ### heading lines
//   - bullet lines
//   > blockquote / call-out lines
//   blank line = paragraph break
//
// Replace [BRACKETS] before publishing.

export const LEGAL_LAST_UPDATED = '[EFFECTIVE DATE — e.g., May 1, 2026]';

export const TERMS_OF_SERVICE = `# Terms of Service

Last Updated: ${LEGAL_LAST_UPDATED}

Welcome to Whale Pod. These Terms of Service (the "Terms") form a binding contract between you and [LEGAL ENTITY NAME] ("Whale Pod," "we," "us," or "our") covering your use of the Whale Pod mobile application, the website at [WEBSITE URL], and any related services we offer (together, the "Services").

> PLEASE READ CAREFULLY. By tapping "I agree," creating an account, or otherwise downloading, installing, or using the Services, you acknowledge that you have read these Terms and our Privacy Policy and that you agree to be bound by both. If you do not agree, you may not use the Services.

> YOU AGREE TO RECEIVE TEXT MESSAGES from or on behalf of Whale Pod at the phone number you supply during signup. These messages will include verification codes, pod and meeting reminders, role-related notifications, and may also include occasional product updates. Standard message and data rates may apply. Sign-up texts may be sent using automated messaging technology. See Section 10 for opt-out instructions.

> ARBITRATION NOTICE. Except for the carve-outs in Section 18, you agree that any dispute arising from these Terms will be resolved through binding individual arbitration, and YOU AND WHALE POD ARE EACH WAIVING THE RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN ANY CLASS ACTION OR REPRESENTATIVE PROCEEDING.

## 1. What Whale Pod Does

Whale Pod is a platform for creating and joining small-group "Pods" — recurring teams of people who pursue something together (a project, a habit, a hobby, a co-founder search, etc.). Pod creators define the format and structure of their pod; other users can apply to join, or in the case of "Open Pods," join instantly.

Once formed, pod members can hold Roles within the pod (e.g., Pod Leader, Scheduler, Note Taker, Role Manager), schedule and attend Meetings (in-person, video, or hybrid), share notes on the Team Board, and chat with other members in Pod Chats or Direct Messages. Some pods also include Interviews as part of the application process and Kickoff Meetings to formally launch.

Throughout these Terms, we refer to people who create a pod as Creators, people who join a pod as Members, and people who have applied but not yet been accepted as Applicants.

By using the Services you agree to comply with our Community Guidelines, which set the expectations for behavior on Whale Pod and form part of these Terms.

## 2. Eligibility

You must be at least 18 years old to use the Services. By accepting these Terms, you represent and warrant that:

- you are at least 18 years old;
- you have not previously been suspended or removed from the Services for a violation of these Terms;
- the registration information you provide is accurate and complete; and
- your use of the Services complies with all applicable laws and regulations.

If you are accepting these Terms on behalf of an organization, you represent that you have the authority to bind that organization, and "you" in these Terms refers both to you and to that organization.

## 3. Accounts and Registration

To use most features of the Services you must create an account. We currently authenticate accounts using a phone number and a one-time SMS verification code; you may also choose to provide an email address, profile picture, name, date of birth, hometown, college, work, bio, and social links. You agree that the information you provide is accurate, complete, and not misleading, and that you will keep it up to date.

You are responsible for the security of your account and your phone number. You must notify us at [SUPPORT EMAIL] as soon as you suspect unauthorized access to your account. We are not liable for losses caused by another person's use of your account where you failed to take reasonable steps to protect access.

## 4. Fees and Payments

The Services are currently free to download and use. We may, in the future, introduce optional paid features, paid pods, or other forms of compensation. If we do, we will give you notice before any fees are charged, and you will have the opportunity to review and accept the fees before you incur them. All fees, when introduced, will be in U.S. Dollars and are non-refundable unless otherwise stated.

## 5. Licenses

### 5.1 License to You

Subject to your continued compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to install and use one copy of the Whale Pod application on a device that you own or control, and to access and use the Services for your personal, non-commercial use.

### 5.2 Restrictions

Except where applicable law forbids us from limiting these rights, you may not:

- reproduce, distribute, publicly display, publicly perform, or create derivative works of the Services;
- modify, decompile, disassemble, or reverse engineer the Services;
- interfere with or circumvent any security or access-control feature of the Services;
- scrape, crawl, or use automated tools to extract data from the Services other than tools we expressly authorize; or
- sell, rent, lease, sublicense, or otherwise transfer the rights granted under these Terms.

### 5.3 Feedback

If you choose to share suggestions, ideas, bug reports, or feature requests with us ("Feedback"), you grant us a perpetual, irrevocable, worldwide, royalty-free license to use that Feedback for any purpose, including building and improving the Services. We are not obligated to credit you for any Feedback.

## 6. Ownership

The Services, including the visual design, graphics, code, copy, logos, and Whale Pod-supplied content (the "Materials"), are owned by Whale Pod or its licensors and are protected by intellectual property laws. Apart from the limited license in Section 5, you receive no rights to the Materials. All rights not expressly granted to you in these Terms are reserved.

## 7. Interactions With Other Users

### 7.1 Assumption of Risk

Whale Pod helps you find and connect with other people, including in person. We do not pre-screen Members, Creators, or Applicants, we do not run background checks, and we do not verify identities or credentials beyond confirming a phone number. You agree that your interactions with other users — whether online (chats, video calls), at scheduled meetings, or anywhere else — happen at your own risk.

You agree to take reasonable safety precautions, especially when meeting other users in person for the first time. Report concerning behavior to [SUPPORT EMAIL] so we can investigate.

You release Whale Pod, its affiliates, and its team from any liability arising out of your interactions with other users, whether online or in person.

### 7.2 No Guarantee of Match or Acceptance

We make no guarantee that you will be matched with any pod, that any application you submit will be accepted, that any pod you create will reach minimum membership, or that any meeting you schedule will be attended.

## 8. Third-Party Services

The Services rely on a number of third-party providers, including (without limitation):

- Supabase for account, database, and storage infrastructure;
- Twilio Verify for phone-number verification (SMS);
- Agora for in-app video calling and optional recording;
- Expo push notification infrastructure;
- OpenStreetMap / Nominatim for address geocoding when you pin a meeting location;
- map and tile providers used to render in-app maps;
- App Store and Google Play for app distribution; and
- third-party services you choose to share content with from inside the app.

These third parties are not under our control. We are not responsible for their content, terms, or practices. When you share content or data with a third-party service through the Services (for example, attaching a resume from a cloud-storage service to a pod application), you authorize the transfer of that content and acknowledge that the third party's terms and privacy policy will apply.

## 9. User Content

### 9.1 What Is User Content

The Services let you create and share content, including pod descriptions, application answers, resumes, portfolios, profile information, photos, profile pictures, pod media uploads, team-board notes, agenda documents, chat messages, reviews, and any audio or video transmitted during a meeting (collectively, "User Content"). You retain ownership of the User Content you create.

### 9.2 License You Grant Whale Pod

By submitting User Content to the Services, you grant Whale Pod a worldwide, non-exclusive, royalty-free, fully paid, sublicensable license to host, store, display, reproduce, modify (only as necessary to format for display), and distribute that User Content within the Services and any feature that depends on it. This license terminates when you delete your User Content, except where third parties have already received it (e.g., a chat message that was already delivered) or where we are required to retain a copy by law.

### 9.3 Photos and Recorded Meetings

If a Whale Pod meeting is recorded (using the Services' built-in recording feature for video meetings), you understand that any video, audio, or screen content captured during your participation may be retained, made available to other meeting participants, and stored by our recording provider. You can leave a meeting at any time. If you do not consent to being recorded, do not join recorded meetings.

If you upload a photo that includes another identifiable person, you represent that you have the right to do so on their behalf.

### 9.4 Your Representations About User Content

You are solely responsible for the User Content you post. By posting User Content, you represent and warrant that:

- you own the content or have all necessary rights, licenses, and permissions to post it;
- the content does not infringe or violate any third party's intellectual property, privacy, publicity, or other right; and
- the content does not violate any law or our Community Guidelines.

We disclaim all liability in connection with User Content created by users.

### 9.5 Moderation

We may, but are not required to, review, remove, edit, or block any User Content that we believe violates these Terms or our Community Guidelines, or is otherwise objectionable. We may also remove pods, cancel meetings, or terminate accounts at our sole discretion.

### 9.6 Reporting

If you encounter content or behavior that violates our Community Guidelines, please report it via the in-app report flow or by emailing [SUPPORT EMAIL]. We investigate reports as promptly as we are able and act on them in our reasonable discretion.

## 10. Communications

### 10.1 SMS

You agree that we and our service providers may send SMS messages to the phone number you provide. These messages include account verification codes, login codes, pod and meeting reminders, role-based notifications, and (occasionally) product announcements. To stop receiving non-essential marketing texts, reply STOP to any marketing text or email [SUPPORT EMAIL]. Note that opting out of all texts may break verification flows, in which case your account may not function correctly.

### 10.2 Push Notifications

When you grant Whale Pod permission to send push notifications, you may receive notifications about applications to your pods, accepted/declined applications, new chats, scheduled meetings, role-edit requests, and similar events. Adjust or disable push notifications from your device settings at any time.

### 10.3 Email

If you provide an email address, we may use it for transactional notifications (account, security, meeting confirmations) and occasional product updates. To opt out of marketing email, follow the unsubscribe link or email [SUPPORT EMAIL].

## 11. Prohibited Conduct

You agree not to:

- use the Services to violate any law or regulation, or to facilitate any illegal activity;
- harass, threaten, dox, defame, or otherwise harm another user;
- infringe or misappropriate the intellectual-property, privacy, or publicity rights of any third party;
- access or scrape the Services using bots, scrapers, or other automated tools that we have not expressly authorized;
- interfere with security features of the Services, including bypassing rate limits, defeating role-based permissions, or attempting to read another user's data;
- disrupt or impair the Services, including by uploading viruses or other malicious code, by spamming chats, or by mass-creating fake accounts;
- impersonate another person or claim a false affiliation;
- create more than one account, or create an account on behalf of someone else without their permission;
- access another user's account without their explicit authorization;
- use the Services to run pyramid schemes, multi-level marketing recruitment, or other deceptive solicitations;
- sell, transfer, or sublicense the access granted under these Terms;
- use the Services to record, transcribe, or distribute another user's audio or video communications outside the in-app recording feature without that user's clear consent;
- use the Services to harvest or distribute another user's contact information; or
- attempt or assist any of the above.

We may suspend or terminate your access to the Services for any of the above without notice.

## 12. Intellectual-Property Notices

We respect intellectual-property rights. If you believe content on the Services infringes a copyright you own or control, you may submit a DMCA notice to [SUPPORT EMAIL] with the subject line "DMCA Notice." Include your contact details, identification of the work you claim is infringed, the location of the allegedly infringing content, a good-faith statement that the use is not authorized, and a statement under penalty of perjury that the information is accurate. We will terminate the accounts of repeat infringers in appropriate circumstances.

## 13. Modification of Terms

We may update these Terms from time to time. Material changes will take effect 30 days after we post the revised version (or earlier with your consent). For non-material changes, the revised version is effective when posted. If you keep using the Services after the changes take effect, you accept the revised Terms. If you do not accept them, you must stop using the Services and may delete your account.

## 14. Term, Termination, and Modification of the Service

You may delete your account at any time from your profile settings. We may suspend or terminate your account, with or without notice, if we believe you have violated these Terms or our Community Guidelines, or for any other reason at our reasonable discretion.

We may add, remove, or change features at any time without prior notice. We are not liable for any change to or discontinuation of the Services.

## 15. Indemnity

You agree to defend, indemnify, and hold harmless Whale Pod and its officers, directors, employees, and agents from any claim, liability, damage, loss, or expense (including reasonable attorneys' fees) arising out of or related to: your use of the Services; your violation of these Terms or our Community Guidelines; your violation of any law or any third-party right; any pod you create or join, any meeting you organize or attend, or any interaction you have with another user; or any User Content you post.

## 16. Disclaimers; No Warranties

THE SERVICES AND ALL CONTENT AVAILABLE THROUGH THEM ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE FULLEST EXTENT PERMITTED BY LAW, WHALE POD DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY ERRORS WILL BE FIXED.

## 17. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY LAW, WHALE POD WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING LOST PROFITS, LOST DATA, OR LOSS OF GOODWILL) ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICES.

WHALE POD'S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS RELATED TO THE SERVICES IS LIMITED TO THE GREATER OF (A) THE AMOUNT YOU HAVE PAID TO WHALE POD IN THE 12 MONTHS BEFORE THE CLAIM AND (B) US$100.

WHALE POD WILL NOT BE LIABLE FOR ANY LOSS, INJURY, ILLNESS, OR DAMAGE ARISING FROM ANY IN-PERSON POD MEETING, INCLUDING LOSSES SUSTAINED TRAVELING TO OR FROM A MEETING OR LOSSES CAUSED BY OTHER PARTICIPANTS. YOU ATTEND IN-PERSON POD ACTIVITIES AT YOUR OWN RISK.

## 18. Dispute Resolution and Arbitration

Except for individual small-claims actions, injunctive relief in aid of arbitration, and intellectual-property infringement claims, you and Whale Pod agree that any dispute relating to these Terms, the Services, or your relationship with Whale Pod will be resolved by binding individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, and YOU AND WHALE POD ARE EACH WAIVING THE RIGHT TO A JURY TRIAL AND THE RIGHT TO PARTICIPATE IN A CLASS ACTION OR ANY OTHER REPRESENTATIVE PROCEEDING.

You may opt out of this arbitration agreement within 30 days of first agreeing to these Terms by sending a signed letter to [LEGAL ENTITY NAME], Attn: Legal — Arbitration Opt-Out, [LEGAL ADDRESS], including your full legal name, the phone number associated with your account, and a statement that you wish to opt out.

## 19. Miscellaneous

These Terms, together with the Privacy Policy and any Community Guidelines we publish, are the entire agreement between you and Whale Pod regarding the Services.

These Terms are governed by the laws of [U.S. STATE — e.g., New York], without regard to its conflict-of-laws principles. To the extent Section 18 does not apply, the state and federal courts located in [COUNTY, STATE] have exclusive jurisdiction over any action.

The Services are operated by [LEGAL ENTITY NAME], located at [LEGAL ADDRESS]. Email us at [SUPPORT EMAIL].

California residents may contact the California Department of Consumer Affairs Complaint Assistance Unit at 1625 N. Market Blvd., Suite N 112, Sacramento, CA 95834, or +1-800-952-5210.

The Services are intended for use within the United States. We make no representation that the Services are appropriate or available for use outside the U.S.

## 20. Notice for Apple App Store Users

If you obtained the app through Apple's App Store: these Terms are between you and Whale Pod only, not Apple. Apple is not responsible for the Services or its content. Apple has no support obligations for the Services. If the Services fail to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price (if any). To the maximum extent permitted by law, Apple has no other warranty obligations. Apple is not responsible for product-liability claims, regulatory-conformance claims, or third-party intellectual-property infringement claims regarding the Services. Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them against you.

You also represent that you are not located in a country subject to a U.S. Government embargo or designated by the U.S. Government as a "terrorist supporting" country, and that you are not on any U.S. Government list of prohibited or restricted parties.

If you have any questions about these Terms, email us at [SUPPORT EMAIL].`;

export const PRIVACY_POLICY = `# Privacy Policy

Last Updated: ${LEGAL_LAST_UPDATED}

[LEGAL ENTITY NAME] ("Whale Pod," "we," "us," or "our") cares about the privacy of the people who use our mobile application, our website at [WEBSITE URL], and any related services (together, the "Services"). This Privacy Policy explains what we collect from users of the Services ("Users"), how we use it, who we share it with, and the choices you have. By using the Services you agree to the practices described here. Your use is also subject to our Terms of Service and Community Guidelines.

## 1. Information We Collect

We collect information from three sources: information you give us, information we collect automatically as you use the app, and information we receive from third parties.

### A. Information You Give Us

Account information. When you sign up, we collect your phone number (used for SMS verification), your name, and (optionally) your email address, profile picture, date of birth, hometown, college, work, bio, and links to your social-media or portfolio profiles.

Pod-related information. When you create or edit a pod, we collect the title, description, location (city, neighborhood, address, and — when you pin a meeting location on the map — latitude and longitude), pod type, categories, team-size range, decision system, meeting cadence, attendance style, and any custom application questions you set up.

Application data. When you apply to a pod, we collect your answers to the pod's application questions and, if the pod requires or permits it, a resume file and links to portfolio assets.

Meeting and team-board data. When you participate in a pod, we collect the meetings you create, schedule, attend, or are invited to (date, time, location, type, participants), the notes and agenda items you contribute to the team board, and the messages you send in pod chats and direct messages.

Roles and permissions. We record the roles assigned to you within each pod (Pod Leader, Scheduler, Note Taker, Moderator, Role Manager, etc.) and any role-edit-access requests you submit or receive.

Reviews. If you write a review of another user, we collect the review text, your ratings, and the recipient.

Connections. We record the connection requests you send and receive and the resulting accepted connections.

Support and survey responses. If you contact us at [SUPPORT EMAIL] or respond to a survey we send, we receive your message, attachments, and any other information you choose to share.

### B. Information We Collect Automatically

Device and app information. We log technical information about the device you use, such as device model, operating-system version, mobile carrier, app version, IP address, language, time zone, and a unique device or push-notification token used to deliver notifications.

Usage information. We log how you interact with the Services — for example, which screens you view, which pods you tap into, when you create or edit content, when you send messages, and when you join a meeting — so we can understand product behavior and fix bugs.

Location. We use approximate location (derived from your IP address or the city you set on your profile) to help surface relevant pods on your Feed. We only collect precise device location if you grant location permission and use a feature that depends on it (e.g., pinning a meeting location). Address and pin coordinates you submit on a pod are stored as part of the pod record.

Engagement metrics. We compute pod-level engagement signals (recent meeting count, recent chat activity, board contributions, recent acceptances) so the Feed and pod cards can display indicators like the "hot" flame and the activity-level jalapeños.

Cookies and similar technology (web only). On our website, we and third-party providers may use cookies, pixels, and similar technologies for analytics and to remember your session. The mobile app uses local storage (e.g., AsyncStorage) for the same purpose.

Logs and crash data. When the app encounters an error, we may capture diagnostic logs (including stack traces) so we can debug.

### C. Information We Receive from Third Parties

Authentication providers. We use Twilio Verify to send the one-time SMS code that confirms your phone number; Twilio reports the verification result back to us.

Push-notification token issuers. Apple Push Notification Service and Firebase Cloud Messaging issue device-specific push tokens that we store so we can deliver notifications.

Other Users. When another User invites or contacts you, we may receive your phone number or other contact information from them.

Geocoding. When you enter a meeting address, OpenStreetMap / Nominatim returns the corresponding coordinates and locality data.

Video infrastructure. When you join a pod video call, Agora routes the call. Agora may also generate a recording if recording is enabled for that meeting; the recording is stored under our control.

## 2. How We Use Your Information

We use the information we collect to:

- create and operate your account, including phone-number verification;
- show you pods, members, and meetings on your Feed and across the app;
- send you push notifications, SMS messages, and emails about activity that involves you (applications to your pods, accepted/declined applications, role-edit requests, role-edit approvals, scheduled meetings, interview times submitted, connection requests, etc.);
- enforce role-based permissions (e.g., letting only Pod Creators or Role Managers edit roles);
- compute engagement signals (the flame and jalapeño indicators on pod cards) so users see which pods are active;
- support your interactions with other Users (chat, video calls, applications, reviews);
- provide customer support and respond to questions and bug reports;
- detect and prevent fraud, abuse, and Community Guidelines violations;
- improve the Services, including by analyzing usage patterns, reproducing bugs, and prototyping new features;
- comply with legal obligations and respond to lawful requests from authorities; and
- communicate occasional product news (which you can opt out of).

We do not use your User Content to train third-party generative-AI models, and we do not sell your personal information.

## 3. How We Share Your Information

### A. With Other Users

The Services are inherently social. The following information is, by design, visible to other Users:

- your name, profile picture, and (if you provide them) bio, college, work, and social links — visible to other Users, including those who view your profile;
- the pods you create — visible on the Feed and to anyone who views the pod;
- pods you join (your name and avatar appear on the pod's member roster);
- pod chats and direct messages — visible to the recipients in the conversation;
- pod meetings — visible to all members of that pod, and any attached video/audio is visible to participants of that meeting;
- team-board notes — visible to members of the pod;
- reviews you write — visible on the recipient's profile to those who can view it;
- roles you hold — visible to other members of the same pod.

You control how much optional information you share via your Profile screen. Anything you don't add, we don't display.

### B. Service Providers and Vendors

We share information with the third parties we rely on to run the Services, including (without limitation):

- Supabase (database, authentication, file storage);
- Twilio Verify (SMS verification);
- Agora (real-time video and voice calls and recording);
- Expo (push-notification delivery, app updates);
- OpenStreetMap / Nominatim (geocoding addresses entered by Pod Creators);
- map and tile providers used to render in-app maps;
- analytics and error-reporting tools;
- our hosting providers and cloud infrastructure; and
- our customer-support tooling.

These vendors are contractually bound to use your information only to provide the services we hire them for.

### C. Legal and Safety Disclosures

We may disclose your information if we reasonably believe disclosure is required to comply with the law (e.g., a subpoena), to enforce our Terms of Service or Community Guidelines, or to protect the rights, property, or safety of Whale Pod, our Users, or others.

### D. Business Transfers

If we are involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale of all or part of our assets, your information may be transferred to the surviving or acquiring entity. We will notify you and post a notice if such a transfer materially changes the way your data is handled.

### E. With Your Consent

We may share information with other parties when you direct us to do so.

## 4. Your Choices

Profile visibility. Adjust what's visible on your profile from your Profile screen at any time. The information you don't add isn't shown.

Push notifications. Disable push notifications from your device's settings. Note that you'll miss real-time alerts (new applications, scheduled meetings, role-edit requests, etc.) if you do.

SMS. Reply STOP to any marketing text or email [SUPPORT EMAIL] to opt out of marketing texts. Verification and account-security texts may continue.

Email. Use the unsubscribe link at the bottom of any marketing email. Transactional email (account, security) may continue.

Location. Disable location permissions in your device's settings. The app will continue to work, but location-dependent features (pinning a meeting on a map, Feed prioritization by neighborhood) will be limited.

Recording during video calls. If you don't want to be recorded, leave the meeting before recording starts (the host indicates whether recording is enabled when scheduling) or do not join recorded meetings.

Account deletion. Delete your account from your profile settings. Deletion deactivates your account immediately. Some content (e.g., messages already delivered, pods you created and that other members rely on, applications already submitted, reviews you wrote) may persist with the people who received them. We may also retain limited information after deletion to comply with legal obligations or for fraud-prevention purposes.

## 5. Third-Party Services

The Services may include links to third-party websites or apps that we don't control. This Privacy Policy does not cover those third parties; please review their own privacy policies before sharing information with them.

## 6. Data Retention

We retain your information for as long as your account is active and for a reasonable period after deletion to (a) honor backup-and-recovery cycles, (b) comply with legal obligations, (c) resolve disputes, and (d) enforce our Terms of Service. Some content you create (messages, pod content, applications, reviews) may persist with recipients beyond the deletion of your account.

## 7. Security

We use reasonable physical, technical, and administrative safeguards designed to protect the information we collect — including row-level security policies on our database, encryption in transit (HTTPS / TLS), and encryption at rest for sensitive fields like passwords. No system is perfectly secure, and we cannot guarantee that your information will never be accessed without authorization.

If you believe your account has been compromised, contact us immediately at [SUPPORT EMAIL].

## 8. Children's Privacy

The Services are not directed to anyone under 18, and we do not knowingly collect personal information from people under 18. If you become aware that a person under 18 has provided us information, please contact us at [SUPPORT EMAIL] so we can delete it.

## 9. California Residents

We do not sell your personal information for direct-marketing purposes (within the meaning of California's "Shine the Light" law, Civil Code § 1798.83). California residents may also have additional rights under the California Consumer Privacy Act (CCPA / CPRA), including the right to know, delete, correct, and limit use of certain categories of personal information. To exercise these rights, email [SUPPORT EMAIL] with the subject line "California Privacy Request" and we'll respond within the timeframe required by law.

## 10. International Visitors

Our servers are located in the United States. By using the Services from outside the United States, you consent to your information being transferred to, stored in, and processed in the U.S., which may not provide the same level of legal protection as your home jurisdiction.

## 11. Changes to This Privacy Policy

We may update this Privacy Policy. We'll post the revised version here and update the "Last Updated" date. If the changes are material, we'll notify you in the app, by email, or by another reasonable means.

## 12. Contact Us

Questions, comments, or privacy requests — email [SUPPORT EMAIL] or write to [LEGAL ENTITY NAME], [LEGAL ADDRESS].`;

export const SUPPORT = `# Support

Need help? We've got you.

For account issues, bug reports, feature requests, abuse reports, privacy requests, or anything else — email us at [SUPPORT EMAIL].

We aim to respond within 24 hours.

## Common Topics

### Can't sign in / didn't receive a verification code

Check that the phone number is entered with the correct country code. Verification codes can take up to a minute. If it still doesn't arrive, email us with the phone number you're using.

### Need to delete your account

Profile → Settings → Delete Account. Account deletion is immediate; some content (messages, pod content, applications, reviews) may persist with the recipients as described in our Privacy Policy.

### Reporting a user, message, or pod

Use the in-app report flow when available, or email [SUPPORT EMAIL] with the user's name or pod title and a short description. We investigate every report.

### DMCA / copyright notices

Email [SUPPORT EMAIL] with subject line "DMCA Notice." See our Terms of Service, Section 12, for the required content.

### California privacy requests

Email [SUPPORT EMAIL] with subject line "California Privacy Request."

### General privacy questions

Email [SUPPORT EMAIL] with subject line "Privacy."`;
