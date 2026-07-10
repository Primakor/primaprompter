module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin powers Reanimated 4's UI-thread animations
    // (the teleprompter scroll). Must remain the last plugin.
    plugins: ['react-native-worklets/plugin'],
  };
};
