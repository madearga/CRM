/**
 * Auto-generate sequence numbers: SO-2024-0001, INV-2024-0001, etc.
 * Uses atomic operations to prevent collision.
 *
 * Uses the ent framework (ctx.table()) for consistency with the codebase.
 */

export const SEQUENCE_PREFIXES = {
  saleOrder: "SO",
  purchaseOrder: "PO",
  invoice: "INV",
  ticket: "TK",
  journalEntry: "JE",
  stockPicking: "WH",
  expense: "EXP",
} as const;

export type SequenceType = keyof typeof SEQUENCE_PREFIXES;

/**
 * Generate the next sequence number for a given entity type.
 * Format: {PREFIX}-{YEAR}-{4-digit counter} (e.g., SO-2024-0001)
 *
 * @param ctx - Context with table() access (ent framework)
 * @param organizationId - Organization ID
 * @param type - Entity type to generate sequence for
 * @param date - Reference date (defaults to now)
 * @returns The generated sequence number string
 */
export async function nextSequence(
  ctx: { table: any },
  organizationId: string,
  type: SequenceType,
  date: number = Date.now()
): Promise<string> {
  const prefix = SEQUENCE_PREFIXES[type];
  const year = new Date(date).getFullYear();

  const existing = await ctx
    .table('sequences', 'organizationId_prefix_year', (q: any) =>
      q
        .eq('organizationId', organizationId)
        .eq('prefix', prefix)
        .eq('year', year)
    )
    .first();

  if (existing) {
    const newCounter = existing.counter + 1;
    await existing.patch({ counter: newCounter });
    return `${prefix}-${year}-${String(newCounter).padStart(4, "0")}`;
  } else {
    await ctx.table('sequences').insert({
      organizationId,
      prefix,
      year,
      counter: 1,
    });
    return `${prefix}-${year}-0001`;
  }
}
