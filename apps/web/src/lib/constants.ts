/** Stage badge colors — shared across dashboard, deals, and deal detail. */
export const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-800/50 text-slate-300',
  contacted: 'bg-blue-900/30 text-blue-400',
  proposal: 'bg-amber-900/30 text-amber-400',
  won: 'bg-green-900/30 text-green-400',
  lost: 'bg-red-900/30 text-red-400',
};

/** Recharts bar chart fills — Tailwind classes don't work in SVG `fill`. */
export {
  STAGE_CHART_COLORS,
  STAGE_BAR_COLORS,
  STAGE_DEFAULT_COLOR,
} from '@crm/domain';

// STAGE_BAR_COLORS re-exported above from @crm/domain.

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
