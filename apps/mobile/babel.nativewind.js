/**
 * Local NativeWind babel preset — drop-in replacement for `nativewind/babel`.
 *
 * Why this exists:
 *   `nativewind/babel` (via `react-native-css-interop/babel.js`) hardcodes
 *   `"react-native-worklets/plugin"` in its plugin list. That plugin belongs
 *   to Reanimated **4+**. This monorepo's mobile app targets Expo SDK 53,
 *   which ships Reanimated 3.x — where the equivalent is
 *   `"react-native-reanimated/plugin"`. Asking for the worklets plugin would
 *   crash the Babel transform with `Cannot find module
 *   'react-native-worklets/plugin'`.
 *
 * Everything else is identical to the upstream preset so NativeWind's class
 * compilation (css-interop JSX transform) is unchanged. When the app upgrades
 * to Reanimated 4+, switch `presets` back to `"nativewind/babel"` and delete
 * this file.
 *
 * Resolved through `nativewind` so we never touch the isolated pnpm layout.
 */
const cssInteropBabelPlugin = require(
  require.resolve("react-native-css-interop/dist/babel-plugin", {
    paths: [require.resolve("nativewind")],
  })
).default;

const jsxTransform = require.resolve(
  "@babel/plugin-transform-react-jsx",
  { paths: [require.resolve("nativewind")] }
);

module.exports = function () {
  return {
    plugins: [
      cssInteropBabelPlugin,
      [
        jsxTransform,
        {
          runtime: "automatic",
          importSource: "react-native-css-interop",
        },
      ],
      // Reanimated 3.x. For Reanimated 4+ use "react-native-worklets/plugin".
      "react-native-reanimated/plugin",
    ],
  };
};
