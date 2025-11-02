# Google Calendar Integration Setup Guide

This guide will help you set up Google Calendar OAuth for the Whale Pod kickoff scheduling feature.

---

## 🎯 Overview

The Google Calendar integration allows:
- Automatic calendar event creation for kickoff meetings
- Sending calendar invites to all team members
- Auto-generating Google Meet links for video calls
- Managing events (update, delete)

---

## 📋 Prerequisites

- Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)
- Expo account (for redirect URI)

---

## 🚀 Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click "NEW PROJECT"
4. Enter project name: `Whale Pod App`
5. Click "CREATE"
6. Wait for project to be created (notification will appear)

### Step 2: Enable Google Calendar API

1. In your project dashboard, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on **Google Calendar API**
4. Click **ENABLE**
5. Wait for API to be enabled

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click **CREATE**

4. Fill in App Information:
   - **App name**: `Whale Pod`
   - **User support email**: Your email
   - **App logo**: (Optional) Upload whale emoji or logo
   - **Developer contact information**: Your email

5. Click **SAVE AND CONTINUE**

6. **Scopes** screen:
   - Click **ADD OR REMOVE SCOPES**
   - Search for "calendar"
   - Check these scopes:
     - `.../auth/calendar` - See, edit, share, and permanently delete all calendars
     - `.../auth/calendar.events` - View and edit events on all your calendars
   - Click **UPDATE**
   - Click **SAVE AND CONTINUE**

7. **Test users** screen:
   - Click **+ ADD USERS**
   - Add your email and team members' emails (for testing)
   - Click **SAVE AND CONTINUE**

8. **Summary** screen:
   - Review information
   - Click **BACK TO DASHBOARD**

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Select **Application type**: **Web application**
4. Enter **Name**: `Whale Pod Web Client`

5. **Authorized redirect URIs**:
   - Click **+ ADD URI**
   - For Expo development, add:
     ```
     https://auth.expo.io/@YOUR_EXPO_USERNAME/YOUR_APP_SLUG
     ```
   - Replace `YOUR_EXPO_USERNAME` with your Expo username
   - Replace `YOUR_APP_SLUG` with your app slug (from app.json)

   **How to find your Expo username and app slug:**
   ```bash
   # Check app.json
   cat app.json

   # Look for:
   # "expo": {
   #   "name": "whale-pod-fresh",  ← This is your app name
   #   "slug": "whale-pod-fresh"   ← This is your app slug
   # }

   # Your Expo username can be found:
   # 1. Run: expo whoami
   # 2. Or check: https://expo.dev/accounts/[username]
   ```

   **Example redirect URI:**
   ```
   https://auth.expo.io/@alexsmith/whale-pod-fresh
   ```

6. Click **CREATE**

7. **Your OAuth client is created!**
   - A dialog will show your **Client ID** and **Client secret**
   - **COPY BOTH** - you'll need them in the next step
   - Click **OK**

### Step 5: Update App Configuration

1. Open the file:
   ```
   src/services/calendarService.ts
   ```

2. Find these lines near the top:
   ```typescript
   const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
   const GOOGLE_CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET_HERE';
   ```

3. Replace with your actual credentials:
   ```typescript
   const GOOGLE_CLIENT_ID = '123456789-abc123def456.apps.googleusercontent.com';
   const GOOGLE_CLIENT_SECRET = 'GOCSPX-abc123def456';
   ```

4. Save the file

### Step 6: Install Required Dependencies

Run these commands in your project directory:

```bash
# Date/time picker for time slot selection
npm install @react-native-community/datetimepicker

# OAuth and authentication
npm install expo-auth-session expo-web-browser

# Async storage for token persistence
npm install @react-native-async-storage/async-storage
```

### Step 7: Update app.json (Expo Configuration)

Add this to your `app.json` under the `expo` key:

```json
{
  "expo": {
    // ... existing config ...
    "scheme": "whalepod",
    "web": {
      "bundler": "metro"
    }
  }
}
```

---

## 🧪 Testing the Integration

### Test OAuth Flow

1. Run your app:
   ```bash
   npm start
   ```

2. Navigate to a pursuit where you're the owner
3. Accept team members until minimum quota is met
4. Click "Schedule Kick-Off Meeting"
5. When prompted, you'll be redirected to Google login
6. Sign in with your Google account
7. Grant calendar permissions
8. You'll be redirected back to the app

### Test Event Creation

1. After OAuth is complete, select time slots
2. Have team members propose their availability
3. As creator, select the best time
4. Click "Confirm & Schedule Kickoff"
5. Check your Google Calendar - event should appear!
6. All attendees should receive calendar invites

---

## 🔒 Security Best Practices

### **IMPORTANT: Never Commit Credentials to Git**

1. **Use Environment Variables** (Recommended for production):

   Create a `.env` file:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

   Add to `.gitignore`:
   ```
   .env
   ```

   Update `calendarService.ts`:
   ```typescript
   import Constants from 'expo-constants';

   const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID || '';
   const GOOGLE_CLIENT_SECRET = Constants.expoConfig?.extra?.GOOGLE_CLIENT_SECRET || '';
   ```

   Update `app.json`:
   ```json
   {
     "expo": {
       "extra": {
         "GOOGLE_CLIENT_ID": process.env.GOOGLE_CLIENT_ID,
         "GOOGLE_CLIENT_SECRET": process.env.GOOGLE_CLIENT_SECRET
       }
     }
   }
   ```

2. **Use Expo Secrets** (For managed workflow):
   ```bash
   eas secret:create --scope project --name GOOGLE_CLIENT_ID --value "your_value"
   eas secret:create --scope project --name GOOGLE_CLIENT_SECRET --value "your_value"
   ```

---

## 🐛 Troubleshooting

### "Invalid redirect URI"
- Double-check the redirect URI in Google Cloud Console
- Ensure it matches: `https://auth.expo.io/@YOUR_EXPO_USERNAME/YOUR_APP_SLUG`
- Try adding both with and without trailing slash

### "Access blocked: Authorization Error"
- Go back to OAuth consent screen
- Make sure you added yourself as a test user
- Verify Calendar API is enabled

### "Token expired" errors
- The calendarService automatically refreshes tokens
- If issues persist, clear app data and re-authenticate:
  ```typescript
  await calendarService.logout();
  ```

### Events not appearing in calendar
- Check that Calendar API is enabled
- Verify the access token has calendar scopes
- Check network console for API errors

### Can't find Expo username
```bash
expo whoami
# or
npx expo whoami
```

---

## 📚 Additional Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [Expo AuthSession Documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [OAuth 2.0 for Mobile Apps](https://developers.google.com/identity/protocols/oauth2/native-app)

---

## ✅ Verification Checklist

Before going live, verify:

- [ ] Google Cloud Project created
- [ ] Google Calendar API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 credentials created
- [ ] Redirect URI matches Expo configuration
- [ ] Client ID and Secret added to calendarService.ts
- [ ] All npm packages installed
- [ ] app.json updated with scheme
- [ ] OAuth flow tested successfully
- [ ] Calendar event created successfully
- [ ] Attendees received invites
- [ ] Google Meet link generated (for video calls)

---

## 🎉 You're All Set!

Your Google Calendar integration is now ready to use. Team members will automatically receive calendar invitations when kickoff meetings are scheduled!

For questions or issues, check the troubleshooting section or consult the Google Calendar API documentation.
