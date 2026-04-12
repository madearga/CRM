/**
 * Generic workflow state machine for ERM modules.
 * Used by: SaleOrder, PurchaseOrder, Invoice, Ticket, Expense, JournalEntry
 */

export const WORKFLOWS = {
  saleOrder: {
    initial: "draft",
    transitions: [
      { from: "draft", to: "sent", action: "send" },
      { from: "sent", to: "confirmed", action: "confirm" },
      { from: "confirmed", to: "invoiced", action: "invoice" },
      { from: "confirmed", to: "delivered", action: "deliver" },
      { from: "invoiced", to: "done", action: "complete" },
      { from: "delivered", to: "done", action: "complete" },
      { from: "draft", to: "cancel", action: "cancel" },
      { from: "sent", to: "cancel", action: "cancel" },
      { from: "confirmed", to: "cancel", action: "cancel" },
    ],
  },
  purchaseOrder: {
    initial: "draft",
    transitions: [
      { from: "draft", to: "sent", action: "send" },
      { from: "sent", to: "confirmed", action: "confirm" },
      { from: "confirmed", to: "received", action: "receive" },
      { from: "received", to: "billed", action: "bill" },
      { from: "billed", to: "done", action: "complete" },
      { from: "draft", to: "cancel", action: "cancel" },
      { from: "sent", to: "cancel", action: "cancel" },
    ],
  },
  invoice: {
    initial: "draft",
    transitions: [
      { from: "draft", to: "posted", action: "post" },
      { from: "posted", to: "paid", action: "pay" },
      { from: "draft", to: "cancel", action: "cancel" },
    ],
  },
  ticket: {
    initial: "new",
    transitions: [
      { from: "new", to: "in_progress", action: "start" },
      { from: "in_progress", to: "waiting_customer", action: "wait_customer" },
      { from: "in_progress", to: "waiting_third_party", action: "wait_third" },
      { from: "waiting_customer", to: "in_progress", action: "resume" },
      { from: "waiting_third_party", to: "in_progress", action: "resume" },
      { from: "in_progress", to: "resolved", action: "resolve" },
      { from: "resolved", to: "closed", action: "close" },
      { from: "resolved", to: "in_progress", action: "reopen" },
      { from: "closed", to: "in_progress", action: "reopen" },
    ],
  },
  expense: {
    initial: "draft",
    transitions: [
      { from: "draft", to: "submitted", action: "submit" },
      { from: "submitted", to: "approved", action: "approve" },
      { from: "submitted", to: "refused", action: "refuse" },
      { from: "approved", to: "validated", action: "validate" },
      { from: "validated", to: "paid", action: "pay" },
    ],
  },
  journalEntry: {
    initial: "draft",
    transitions: [{ from: "draft", to: "posted", action: "post" }],
  },
} as const;

export type WorkflowType = keyof typeof WORKFLOWS;

export interface TransitionResult {
  valid: boolean;
  newState?: string;
  error?: string;
}

/**
 * Validate whether a workflow transition is allowed.
 * @param workflowType - Which workflow (e.g., "saleOrder")
 * @param currentState - Current state of the entity
 * @param action - Action being attempted (e.g., "send", "confirm")
 * @returns Result with valid flag and optional new state or error
 */
export function validateTransition(
  workflowType: WorkflowType,
  currentState: string,
  action: string
): TransitionResult {
  const workflow = WORKFLOWS[workflowType];
  if (!workflow) {
    return { valid: false, error: `Unknown workflow: ${workflowType}` };
  }

  const transition = workflow.transitions.find(
    (t) => t.from === currentState && t.action === action
  );

  if (!transition) {
    return {
      valid: false,
      error: `Cannot '${action}' from state '${currentState}' in ${workflowType} workflow`,
    };
  }

  return { valid: true, newState: transition.to };
}

/**
 * Get all valid actions from a given state.
 */
export function getValidActions(
  workflowType: WorkflowType,
  currentState: string
): string[] {
  const workflow = WORKFLOWS[workflowType];
  if (!workflow) return [];
  return workflow.transitions
    .filter((t) => t.from === currentState)
    .map((t) => t.action);
}

/**
 * Get the initial state for a workflow.
 */
export function getInitialState(workflowType: WorkflowType): string {
  return WORKFLOWS[workflowType].initial;
}
