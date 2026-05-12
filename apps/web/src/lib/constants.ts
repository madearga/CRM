/** Stage badge colors — shared across dashboard, deals, and deal detail. */
export const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-800/50 text-slate-300',
  contacted: 'bg-blue-900/30 text-blue-400',
  proposal: 'bg-amber-900/30 text-amber-400',
  won: 'bg-green-900/30 text-green-400',
  lost: 'bg-red-900/30 text-red-400',
};

/** Recharts bar chart fills — Tailwind classes don't work in SVG `fill`. */
export const STAGE_CHART_COLORS: Record<string, string> = {
  new: '#94a3b8',
  contacted: '#60a5fa',
  proposal: '#fbbf24',
  won: '#4ade80',
  lost: '#f87171',
};

/** Dashboard pipeline bar colors (for the thin summary bars). */
export const STAGE_BAR_COLORS: Record<string, string> = {
  new: 'bg-slate-400',
  contacted: 'bg-blue-400',
  proposal: 'bg-amber-400',
  won: 'bg-green-400',
  lost: 'bg-red-400',
};

/** Company status badge colors. */
export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-900/30 text-green-400',
  inactive: 'bg-red-900/30 text-red-400',
  prospect: 'bg-blue-900/30 text-blue-400',
};

/** Contact lifecycle badge colors. */
export const LIFECYCLE_COLORS: Record<string, string> = {
  lead: 'bg-slate-800/50 text-slate-300',
  prospect: 'bg-blue-900/30 text-blue-400',
  customer: 'bg-green-900/30 text-green-400',
  churned: 'bg-red-900/30 text-red-400',
};
