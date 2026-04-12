/**
 * Auto-generate sequence numbers: SO-2024-0001, INV-2024-0001, etc.
 * Uses atomic operations to prevent collision.
 *
 * Requires a `sequences` table in the schema:
 *   sequences: defineEnt({
 *     prefix: v.string(),
 *     year: v.number(),
 *     counter: v.number(),
 *   })
 *     .field('organizationId', v.id('organization'), { index: true })
 *     .index('organizationId_prefix_year', ['organizationId', 'prefix', 'year'])
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
 * @param ctx - MutationCtx with db access
 * @param organizationId - Organization ID
 * @param type - Entity type to generate sequence for
 * @param date - Reference date (defaults to now)
 * @returns The generated sequence number string
 */
export async function nextSequence(
  ctx: { db: any },
  organizationId: string,
  type: SequenceType,
  date: number = Date.now()
): Promise<string> {
  const prefix = SEQUENCE_PREFIXES[type];
  const year = new Date(date).getFullYear();

  const existing = await ctx.db
    .query("sequences")
    .withIndex("organizationId_prefix_year", (q: any) =>
      q
        .eq("organizationId", organizationId)
        .eq("prefix", prefix)
        .eq("year", year)
    )
    .first();

  if (existing) {
    // Convex uses optimistic concurrency control (OCC) at the document level.
    // If two mutations read the same counter concurrently, the second patch
    // will conflict and Convex will automatically retry the entire mutation,
    // re-reading the updated counter value. This ensures no duplicate numbers.
    const newCounter = existing.counter + 1;
    await ctx.db.patch(existing._id, { counter: newCounter });
    return `${prefix}-${year}-${String(newCounter).padStart(4, "0")}`;
  } else {
    await ctx.db.insert("sequences", {
      organizationId,
      prefix,
      year,
      counter: 1,
    });
    return `${prefix}-${year}-0001`;
  }
}
