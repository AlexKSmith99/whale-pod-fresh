// Jest setup for the Whale Pod app.
// Runs before each test file — mocks anything that can't run in the jest env
// (native modules, the Supabase client, AsyncStorage, linear gradient, etc.).

// AsyncStorage — use the library's built-in mock
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Supabase — replace the client with a fully chain-able stub so tests can
// spy on individual calls and control return values via mockResolvedValue.
jest.mock('./src/config/supabase', () => {
  const makeChainable = (): any => {
    const chain: any = {
      select: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      update: jest.fn(() => chain),
      upsert: jest.fn(() => chain),
      delete: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      neq: jest.fn(() => chain),
      in: jest.fn(() => chain),
      ilike: jest.fn(() => chain),
      gte: jest.fn(() => chain),
      lte: jest.fn(() => chain),
      or: jest.fn(() => chain),
      filter: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      then: (resolve: any) => resolve({ data: [], error: null }),
    };
    return chain;
  };
  return {
    supabase: {
      from: jest.fn(() => makeChainable()),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
      auth: {
        getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      },
      channel: jest.fn(() => ({
        on: jest.fn(function (this: any) { return this; }),
        subscribe: jest.fn(function (this: any) { return this; }),
      })),
      removeChannel: jest.fn(),
    },
  };
});

// expo-linear-gradient — stub with a plain View
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

// expo-haptics — no-op
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// react-native-svg — simplest: replace with plain Views
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Path: View,
    Circle: View,
    Rect: View,
    G: View,
    Defs: View,
    LinearGradient: View,
    RadialGradient: View,
    Stop: View,
    Line: View,
    Polyline: View,
    Polygon: View,
    Text: View,
    TSpan: View,
    Use: View,
    Image: View,
    Symbol: View,
    ClipPath: View,
    Ellipse: View,
    Mask: View,
    Pattern: View,
  };
});

// react-native-webview — no native module in jest env
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View, default: View };
});

// expo-image-picker — no native module in jest env
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
}));

// expo-notifications — no native module in jest env
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[mock]' })),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

// (Intentionally no NativeAnimatedHelper mock — that path was removed in RN 0.81.)
