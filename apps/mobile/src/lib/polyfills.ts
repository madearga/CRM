/**
 * Runtime polyfills required by web-oriented dependencies that leak into the
 * React Native (Hermes) bundle.
 *
 * Hermes does not ship a number of browser globals that packages such as
 * `convex`, `better-auth`, and their transitive deps (`es-abstract`,
 * `get-intrinsic`, `web-streams-polyfill`) reference defensively — i.e. they
 * guard access with `typeof X !== 'undefined'` *except* in a few hot paths
 * where they dereference the global directly, which throws
 * `ReferenceError: Property 'X' doesn't exist` under Hermes.
 *
 * This module MUST be the first import in the app entry (`index.js`)
 * so the globals are installed before any dependent module is required.
 *
 * Polyfills provided:
 *  - `crypto.getRandomValues` — via `react-native-get-random-values`.
 *
 * `SharedArrayBuffer` is NOT shimmed here: `early-polyfills.js` is injected by
 * Metro's `getModulesRunBeforeMainModule` and runs before this module (and
 * before Expo's URL/manifest helpers that need it), so it is already defined
 * by the time we execute.
 */

// Crypto randomness (required by Better Auth / convex token generation).
// Side-effect import — the package patches `global.crypto`.
require('react-native-get-random-values');

export {};