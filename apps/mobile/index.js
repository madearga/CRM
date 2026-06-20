// Load React Native/Hermes polyfills before Expo Router or any shared package.
// Keep this file as the package `main` entry; importing the polyfills from
// `app/_layout.tsx` is too late for SDK/runtime modules loaded by Expo Router.
import './src/lib/polyfills';

import 'expo-router/entry';
