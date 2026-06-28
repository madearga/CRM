/**
 * Stage color maps shared between the web and mobile dashboards.
 *
 * Single source of truth — both apps import from here so the two surfaces
 * cannot drift. Web re-exports these from `apps/web/src/lib/constants.ts`
 * (`@/lib/constants`) so existing web imports keep working; mobile imports
 * straight from `@crm/domain`.
 *
 * `STAGE_CHART_COLORS` are hex fills (SVG/Recharts on web, raw `View`
 * backgroundColor on mobile — both accept hex). `STAGE_BAR_COLORS` are
 * Tailwind class strings used by the web thin summary bars; mobile uses the
 * hex map directly for its nativewind `View` segments.
 */

/** Hex fills per deal stage (web Recharts + mobile nativewind segments). */
export const STAGE_CHART_COLORS: Record<string, string> = {
  new: '#94a3b8',
  contacted: '#60a5fa',
  proposal: '#fbbf24',
  won: '#4ade80',
  lost: '#f87171',
};

/** Tailwind class strings for the web thin summary bars. */
export const STAGE_BAR_COLORS: Record<string, string> = {
  new: 'bg-slate-400',
  contacted: 'bg-blue-400',
  proposal: 'bg-amber-400',
  won: 'bg-green-400',
  lost: 'bg-red-400',
};

/** Fallback color for an unknown stage (not in the map). */
export const STAGE_DEFAULT_COLOR = '#6366f1';