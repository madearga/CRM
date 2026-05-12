export const STAGES = [
  { id: 'new', label: 'New', bg: 'bg-slate-900/50', border: 'border-slate-700', badge: 'bg-slate-700 text-slate-200' },
  { id: 'contacted', label: 'Contacted', bg: 'bg-blue-950/40', border: 'border-blue-800/60', badge: 'bg-blue-900/60 text-blue-200' },
  { id: 'proposal', label: 'Proposal', bg: 'bg-amber-950/40', border: 'border-amber-800/60', badge: 'bg-amber-900/60 text-amber-200' },
  { id: 'won', label: 'Won', bg: 'bg-green-950/40', border: 'border-green-800/60', badge: 'bg-green-900/60 text-green-200' },
  { id: 'lost', label: 'Lost', bg: 'bg-red-950/40', border: 'border-red-800/60', badge: 'bg-red-900/60 text-red-200' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];
