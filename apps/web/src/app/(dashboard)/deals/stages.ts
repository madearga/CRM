export const STAGES = [
  { id: 'new', label: 'New', bg: 'bg-slate-50 dark:bg-slate-900/50', border: 'border-slate-200 dark:border-slate-700', badge: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' },
  { id: 'contacted', label: 'Contacted', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200' },
  { id: 'proposal', label: 'Proposal', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200' },
  { id: 'won', label: 'Won', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', badge: 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' },
  { id: 'lost', label: 'Lost', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];
