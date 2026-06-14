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
 *     @radix-ui/*. (tailwindcss is a build-time tool for NativeWind; it is not
 *     imported at runtime, so blocking it here is safe and desired.)
 */
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../../");

const config = getDefaultConfig(projectRoot);

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
const browserOnlyBlocklist = [
  /[\\/]node_modules[\\/]next([\\/])/,
  /[\\/]node_modules[\\/]sonner([\\/])/,
  /[\\/]node_modules[\\/]recharts([\\/])/,
  /[\\/]node_modules[\\/]vaul([\\/])/,
  /[\\/]node_modules[\\/]tailwindcss([\\/])/,
  /[\\/]node_modules[\\/]@radix-ui([\\/])/,
];

const existingBlockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver.blockList = [...existingBlockList, ...browserOnlyBlocklist];

// --- NativeWind v4 --------------------------------------------------------------
// Processes ./global.css (Tailwind) into the RN-compatible stylesheet injected
// by nativewind/babel. Must be the last transform applied.
module.exports = withNativeWind(config, { input: "./global.css" });
