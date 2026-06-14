module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      // Local preset replacing `nativewind/babel` (which hardcodes the
      // Reanimated-4-only `react-native-worklets/plugin`). See the file header.
      "./babel.nativewind.js",
    ],
  };
};
