module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 ships worklets separately; its babel plugin MUST be last.
    // Required by react-native-keyboard-controller's reanimated-based views.
    plugins: ['react-native-worklets/plugin'],
  };
};
