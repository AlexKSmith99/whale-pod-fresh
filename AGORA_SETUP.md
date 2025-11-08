# Agora Video Call Setup Guide

This guide will help you set up Agora video calling in your Whale Pod app with development builds.

## 📋 What Was Installed

- ✅ `expo-dev-client` - Custom development client for native modules
- ✅ `react-native-agora` - Agora Video SDK for React Native
- ✅ `expo-camera` - Camera permissions
- ✅ `expo-av` - Audio/video permissions

## 🔑 Step 1: Get Your Agora App ID

1. **Sign up for Agora** (free):
   - Go to: https://console.agora.io/
   - Create a free account

2. **Create a new project**:
   - Click "Project Management" in the left sidebar
   - Click "Create" button
   - Enter project name: "Whale Pod"
   - Choose "Secured mode: APP ID + Token" (recommended) or "Testing mode: APP ID" (easier for dev)
   - Click "Submit"

3. **Copy your App ID**:
   - Click the eye icon next to your App ID to reveal it
   - Copy the App ID

4. **Add to your .env file**:
   ```bash
   # Open .env file and replace:
   EXPO_PUBLIC_AGORA_APP_ID=your_agora_app_id_here

   # With your actual App ID:
   EXPO_PUBLIC_AGORA_APP_ID=a1b2c3d4e5f6g7h8i9j0
   ```

## 🏗️ Step 2: Create Development Build

You now need to create a **development build** (custom Expo Go) that includes Agora's native code.

### Option A: Build for Android (Easiest)

**Prerequisites:**
- Android Studio installed (for Android emulator)
- OR Android device connected via USB

**Commands:**
```bash
# Make sure all packages are installed
npm install

# Create and run Android development build
npx expo run:android
```

This will:
1. Generate native Android project
2. Install all dependencies
3. Build the app
4. Install on your emulator/device
5. Start the dev server

**First build takes 5-10 minutes** ☕

### Option B: Build for iOS (Mac only)

**Prerequisites:**
- Mac computer
- Xcode installed
- CocoaPods installed (`sudo gem install cocoapods`)

**Commands:**
```bash
# Make sure all packages are installed
npm install

# Create and run iOS development build
npx expo run:ios
```

This will:
1. Generate native iOS project
2. Install all dependencies
3. Build the app
4. Install on simulator
5. Start the dev server

**First build takes 10-15 minutes** ☕

## 📱 Step 3: Using Your Development Build

### What Changed?

**Before:** You scanned QR codes with Expo Go app

**Now:** You scan QR codes with YOUR custom app (that has Agora built-in)

### Workflow:

1. **Start the dev server:**
   ```bash
   npm start
   ```

2. **Scan the QR code** with:
   - **Android:** Your custom Whale Pod dev app (just installed)
   - **iOS:** Your custom Whale Pod dev app (just installed)

3. **Make changes to code** → App hot-reloads automatically (same as before!)

### Rebuilding

You only need to rebuild when:
- ❌ Installing new native modules
- ❌ Changing app.json native config
- ❌ Updating iOS/Android project settings

You DON'T need to rebuild when:
- ✅ Changing JS/TS code
- ✅ Updating React components
- ✅ Modifying styles

## 🎥 Step 4: Test Video Calls

1. **Navigate to a Pod** in "My Pods"
2. **Open the Team Board**
3. **Click the purple video camera button** in the header
4. **Allow camera & microphone permissions** when prompted
5. **Join the call!**

### Testing with Multiple Users

**Option 1: Two Devices**
- Install dev build on two devices/emulators
- Log in as different users
- Join the same Pod
- Start video call from both devices

**Option 2: Web + Device**
- Build for one device
- Use Agora web test: https://webdemo.agora.io/basicVideoCall/index.html
  - Enter your App ID
  - Use the same channel name as your pursuit ID
  - Click "Join"

## 🐛 Troubleshooting

### "Agora App ID not configured"
- Make sure `.env` file has `EXPO_PUBLIC_AGORA_APP_ID` set
- Restart your dev server: `npm start`

### Build fails with "Unable to resolve module"
```bash
# Clear caches and rebuild
rm -rf node_modules
npm install
npx expo run:android  # or run:ios
```

### Camera/Mic permissions not working
- **Android:** Check Settings → Apps → Whale Pod → Permissions
- **iOS:** Check Settings → Privacy → Camera/Microphone

### No video showing
- Check that you're using the same App ID on all devices
- Make sure you're joining the same channel (pursuit ID)
- Check console for errors: Look for "Agora error" messages

### "ERR_INVALID_APP_ID"
- Your App ID is incorrect or not set
- Double-check your .env file
- Restart dev server

## 📊 Free Tier Limits

Agora gives you:
- ✅ **10,000 minutes/month FREE**
- ✅ Unlimited participants per call
- ✅ HD video quality
- ✅ Screen sharing
- ✅ Recording (if enabled)

For a small team collaboration app, this is more than enough for development and initial users!

## 🚀 How Video Calls Work

```
User clicks video button
    ↓
App requests camera/mic permissions
    ↓
Agora SDK connects to channel (using pursuit ID as channel name)
    ↓
All users in same channel see each other
    ↓
User clicks end call → Leaves channel
```

**Channel naming:** We use the `pursuitId` as the channel name, so all team members of the same Pod join the same video room automatically!

## 📚 Additional Resources

- **Agora Docs:** https://docs.agora.io/en/video-calling/get-started/get-started-sdk
- **Expo Dev Client:** https://docs.expo.dev/develop/development-builds/introduction/
- **Token Server (for production):** https://docs.agora.io/en/video-calling/get-started/authentication-workflow

## ⚡ Quick Commands Reference

```bash
# Start dev server
npm start

# Build for Android
npx expo run:android

# Build for iOS (Mac only)
npx expo run:ios

# Clear cache and rebuild
rm -rf node_modules && npm install && npx expo run:android

# Check if dev client is installed
npx expo install --check
```

## 🎉 You're All Set!

Your Whale Pod app now has professional video calling built-in! 🐋📹

For production deployment, you'll want to:
1. Set up a token server for security
2. Configure app signing for Play Store/App Store
3. Consider EAS Build for cloud building

Need help? Check the Agora docs or ask for assistance!
