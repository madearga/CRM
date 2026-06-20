const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

/**
 * Metro config for @crm/mobile inside the Turborepo (pnpm workspace).
 *
 * Responsibilities:
 *  1. Let Metro resolve workspace packages (@crm/domain, @crm/auth, @crm/config)
 *     across the pnpm symlink layout.
 *  2. HARD-FAIL if any browser-only transitive dependency tries to enter the
 *     React Native bundle. These come from apps/web / shared code and must
 *     never ship to native. List: next, sonner, recharts, vaul, tailwindcss,
 *     @radix-ui/* EXCEPT `@radix-ui/react-slot` (see resolveRequest below).
 *     (tailwindcss is a build-time tool for NativeWind; it is not imported at
 *     runtime, so blocking it here is safe and desired.)
 *  3. Rewrite `@radix-ui/react-slot` to a local RN-compatible stub. The
 *     upstream package is web-only, but `expo-router@5.1.11` references it
 *     from `build/ui/Slot.js`. Our stub is mobile-only and a no-op at runtime.
 */
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../../");
const mobileEntry = path.resolve(projectRoot, "index.js");
const earlyPolyfills = path.resolve(projectRoot, "early-polyfills.js");
const localSlotStub = path.resolve(projectRoot, "mocks/react-slot.tsx");
const webidlConversionsShim = path.resolve(projectRoot, "mocks/webidl-conversions.js");

const config = getDefaultConfig(projectRoot);

// --- Hermes before-main polyfills ---------------------------------------------
// Expo SDK 54 initializes URL/manifest helpers before the app entry runs. Some
// transitive URL polyfill code (`webidl-conversions`) dereferences
// `SharedArrayBuffer` at module scope, but Expo Go's Hermes runtime does not
// provide it. Inject a tiny no-dependency shim before Expo's runtime modules.
const defaultGetBeforeMainModules = config.serializer.getModulesRunBeforeMainModule;
config.serializer.getModulesRunBeforeMainModule = (...args) => {
  const modules = defaultGetBeforeMainModules ? defaultGetBeforeMainModules(...args) : [];
  if (modules.includes(earlyPolyfills)) {
    return modules;
  }

  // Keep React Native InitializeCore first (Expo's default marks it as MUST be
  // first), then install our globals before Expo URL/manifest helpers.
  return modules.length > 0
    ? [modules[0], earlyPolyfills, ...modules.slice(1)]
    : [earlyPolyfills];
};

// --- Monorepo / pnpm resolution -------------------------------------------------
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
// pnpm stores packages as symlinks under node_modules/.pnpm; Metro must follow them.
config.resolver.unstable_enableSymlinks = true;
// Respect package.json "exports" maps used by modern packages (e.g. nativewind).
config.resolver.unstable_enablePackageExports = true;
// With explicit nodeModulesPaths, disable blind upward walks (faster + safer).
config.resolver.disableHierarchicalLookup = true;

// --- Browser-only blocklist -----------------------------------------------------
// Keep `@radix-ui/react-slot` OUT of the blocklist — it is aliased via
// `resolveRequest` below to a local stub.
const browserOnlyBlocklist = [
  /[\\/]node_modules[\\/]next([\\/])/,
  /[\\/]node_modules[\\/]sonner([\\/])/,
  /[\\/]node_modules[\\/]recharts([\\/])/,
  /[\\/]node_modules[\\/]vaul([\\/])/,
  /[\\/]node_modules[\\/]tailwindcss([\\/])/,
  // Block every @radix-ui/* package EXCEPT react-slot. The negative
  // lookahead lets the resolveRequest alias do its job below.
  /[\\/]node_modules[\\/]@radix-ui[\\/](?!react-slot([\\/]|$))/,
];

const existingBlockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver.blockList = [...existingBlockList, ...browserOnlyBlocklist];

// --- @radix-ui/react-slot alias (RN-friendly stub) -----------------------------
// `expo-router@5.1.11/build/ui/Slot.js` `require()`s `@radix-ui/react-slot`,
// which is a web-only package. We don't want the real package (would pull
// web-only code) but Metro insists the require resolves. Rewrite to the local
// stub before the default resolver runs.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Expo dev server requests `/index.bundle` and Metro resolves that as
  // `./index` from the monorepo root (`/Users/.../crm/.`) when `watchFolders`
  // includes the workspace root. Keep package.json `main: "index.js"` valid
  // for Expo's manifest resolver (relative to apps/mobile), but redirect this
  // root-origin Metro lookup back to the mobile app entry so our Hermes
  // polyfills load before `expo-router/entry`.
  const originIsMonorepoRoot = path.resolve(context.originModulePath) === monorepoRoot;
  if (originIsMonorepoRoot && (moduleName === "./index" || moduleName === "index")) {
    return { type: "sourceFile", filePath: mobileEntry };
  }

  if (moduleName === "webidl-conversions") {
    return { type: "sourceFile", filePath: webidlConversionsShim };
  }

  if (moduleName === "@radix-ui/react-slot") {
    return { type: "sourceFile", filePath: localSlotStub };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// --- NativeWind v4 --------------------------------------------------------------
// Processes ./global.css (Tailwind) into the RN-compatible stylesheet injected
// by nativewind/babel. Must be the last transform applied.
const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

// Re-apply after NativeWind wraps the config. NativeWind may replace serializer
// hooks, so the before-main polyfill injection must be installed on the final
// exported config, not just on Expo's default config above.
const nativeWindGetBeforeMainModules = nativeWindConfig.serializer.getModulesRunBeforeMainModule;
nativeWindConfig.serializer.getModulesRunBeforeMainModule = (...args) => {
  const modules = nativeWindGetBeforeMainModules ? nativeWindGetBeforeMainModules(...args) : [];
  if (modules.includes(earlyPolyfills)) {
    return modules;
  }
  return modules.length > 0
    ? [modules[0], earlyPolyfills, ...modules.slice(1)]
    : [earlyPolyfills];
};

module.exports = nativeWindConfig;
