// CRM Domain Types, Enums, and Constants
// This package is the single source of truth for shared domain logic.

// ============================================================
// Deal Stages (hardcoded enum for Phase 1)
// Phase 2 adds pipelines + dealStages tables for custom pipelines
// ============================================================

export const DEAL_STAGES = [
  "new",
  "contacted",
  "proposal",
  "won",
  "lost",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

/** Stages that represent an active deal (not closed) */
export const ACTIVE_STAGES: DealStage[] = ["new", "contacted", "proposal"];

/** Stages that represent a closed deal */
export const CLOSED_STAGES: DealStage[] = ["won", "lost"];

// ============================================================
// Roles (extends Better Auth's owner/member with admin)
// ============================================================

export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];

// ============================================================
// Activity Types
// ============================================================

export const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "note",
  "status_change",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ============================================================
// Entity Types (for activities and audit logs)
// ============================================================

export const ENTITY_TYPES = [
  "company",
  "contact",
  "deal",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// ============================================================
// Contact Lifecycle Stages
// ============================================================

export const LIFECYCLE_STAGES = [
  "lead",
  "prospect",
  "customer",
  "churned",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

// ============================================================
// Currency (user is Indonesian, IDR primary)
// ============================================================

export const CURRENCIES = ["IDR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "IDR";

// ============================================================
// Keyboard Shortcuts
// ============================================================

export const KEYBOARD_SHORTCUTS = {
  company: "c",
  deal: "d",
  contact: "n",
  help: "?",
} as const;

// ============================================================
// Deal Stage State Machine
// new → contacted → proposal → won|lost
// won/lost can reopen to new
// ============================================================

export const VALID_TRANSITIONS: Record<DealStage, DealStage[]> = {
  new: ["contacted", "lost"],
  contacted: ["proposal", "new", "lost"],
  proposal: ["won", "lost", "contacted"],
  won: ["new"],
  lost: ["new"],
};

export function isValidTransition(
  from: DealStage,
  to: DealStage
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================
// Deal Aging Configuration
// ============================================================

/** Flag deals that have been in the same stage longer than this (ms) */
export const DEAL_AGING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
