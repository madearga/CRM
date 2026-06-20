/**
 * Mobile design-token bridge.
 *
 * Single source of truth for tokens that must be shared between NativeWind
 * (Tailwind classes, resolved via tailwind.config.js + nativewind/preset) and
 * plain `StyleSheet` consumers. Keep colors in sync with `tailwind.config.js`
 * and the web DESIGN.md.
 *
 * NativeWind v4 is the primary styling system. If a screen ever needs a pure
 * StyleSheet fallback (e.g. NativeWind/React-19 incompatibility), import tokens
 * from here instead of hardcoding values.
 */

export const colors = {
  background: "#0a0a0f",
  foreground: "#f0f0fa",
  card: "#171721",
  cardForeground: "#f0f0fa",
  primary: "#f0f0fa",
  primaryForeground: "#0a0a0f",
  muted: "rgba(240,240,250,0.06)",
  mutedForeground: "rgba(240,240,250,0.65)",
  destructive: "#ff5b4f",
  success: "#22c55e",
  successForeground: "#0a0a0f",
  warning: "#f97316",
  warningForeground: "#0a0a0f",
  border: "rgba(240,240,250,0.10)",
  ring: "rgba(240,240,250,0.30)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
} as const;

export const typography = {
  fontFamily: "D-DIN",
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
  },
  lineHeights: {
    xs: 16,
    sm: 20,
    base: 24,
    lg: 28,
    xl: 28,
    "2xl": 32,
    "3xl": 36,
  },
  weights: {
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
} as const;

export type AppColors = typeof colors;
export type AppSpacing = typeof spacing;
export type AppRadius = typeof radius;
export type AppTypography = typeof typography;
