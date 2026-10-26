import { z } from "zod";
import { ConvexError } from "convex/values";
import { createOrgQuery } from "./functions";
import { requirePermission } from "./permissionHelpers";
import { DEAL_STAGES } from "@crm/domain";
import { resolveDate } from "../packages/domain/src/webmcp-date";

const entity = z.enum(["company", "contact", "deal"]);
const tables = {
  company: "companies",
  contact: "contacts",
  deal: "deals",
} as const;
const paging = {
  cursor: z.string().max(1000).nullable().optional(),
  limit: z.number().int().min(1).max(5).optional(),
};

export function boundedOutput<T>(result: T): T {
  if (JSON.stringify(result).length > 1500) {
    throw new ConvexError({
      code: "OUTPUT_TOO_LARGE",
      message:
        "Result exceeds the tool budget. Use limit 1 or open the record in the app; no text was truncated.",
    });
  }
  return result;
}

// Explicit projections keep private notes, ownership and session data out of tool results.
function facts(row: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(
    fields
      .filter((key) => row[key] !== undefined)
      .map((key) => [key === "_id" ? "id" : key, row[key]]),
  );
}
const fields = {
  company: ["_id", "name", "website", "industry", "status"],
  contact: ["_id", "fullName", "companyId", "jobTitle"],
  deal: [
    "_id",
    "title",
    "companyId",
    "stage",
    "value",
    "currency",
    "expectedCloseDate",
  ],
};
const pageResult = (
  result: { isDone: boolean; continueCursor: string },
  items: unknown[],
  size: number,
) =>
  boundedOutput({
    items,
    page_size: size,
    total_count: null,
    next_cursor: result.isDone ? null : result.continueCursor,
    has_more: !result.isDone,
    ...(items.length
      ? {}
      : {
          hint: "No matches on this page. Continue if available, or broaden the search.",
        }),
  });

export const searchRecords = createOrgQuery()({
  args: {
    entity,
    query: z.string().max(200),
    stage: z.enum(DEAL_STAGES).optional(),
    ...paging,
  },
  handler: async (ctx, args) => {
    const table = tables[args.entity];
    await requirePermission(ctx, { feature: table, action: "view" });
    if (args.stage && args.entity !== "deal")
      throw new Error("Stage applies only to deals.");
    const opts = { cursor: args.cursor ?? null, numItems: args.limit ?? 3 };
    if (args.entity === "company" || args.entity === "contact") {
      const query =
        args.entity === "company"
          ? ctx.db
              .query("companies")
              .withSearchIndex("search_companies", (q) =>
                q.search("name", args.query).eq("organizationId", ctx.orgId),
              )
          : ctx.db
              .query("contacts")
              .withSearchIndex("search_contacts", (q) =>
                q
                  .search("fullName", args.query)
                  .eq("organizationId", ctx.orgId),
              );
      const result = await query
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .paginate(opts);
      return pageResult(
        result,
        result.page.map((row) => facts(row, fields[args.entity])),
        opts.numItems,
      );
    }
    // shortcut: deals have no title search index; scan this tenant until a search index is justified.
    const result = await ctx.db
      .query("deals")
      .withIndex("organizationId", (q) => q.eq("organizationId", ctx.orgId))
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          ...(args.stage ? [q.eq(q.field("stage"), args.stage)] : []),
        ),
      )
      .paginate(opts);
    return pageResult(
      result,
      result.page
        .filter((row) =>
          row.title.toLowerCase().includes(args.query.toLowerCase()),
        )
        .map((row) => facts(row, fields.deal)),
      opts.numItems,
    );
  },
});

export const getRecord = createOrgQuery()({
  args: { entity, id: z.string().min(1).max(100) },
  handler: async (ctx, args) => {
    const table = tables[args.entity];
    await requirePermission(ctx, { feature: table, action: "view" });
    const id = ctx.db.normalizeId(table, args.id);
    const row = id ? await ctx.db.get(id) : null;
    if (!row || row.organizationId !== ctx.orgId || row.archivedAt)
      throw new Error(
        "Record not found in the active organization. Search again.",
      );
    return boundedOutput(facts(row, fields[args.entity]));
  },
});

export const listActivities = createOrgQuery({
  permission: { feature: "activities", action: "view" },
})({
  args: {
    entity: entity.optional(),
    entity_id: z.string().min(1).max(100).optional(),
    type: z
      .enum(["call", "email", "meeting", "note", "status_change"])
      .optional(),
    ...paging,
  },
  handler: async (ctx, args) => {
    if (Boolean(args.entity) !== Boolean(args.entity_id))
      throw new Error("Supply both entity and entity_id, or neither.");
    const result = await ctx.db
      .query("activities")
      .withIndex("organizationId_createdAt", (q) =>
        q.eq("organizationId", ctx.orgId),
      )
      .filter((q) =>
        q.and(
          ...(args.entity
            ? [
                q.eq(q.field("entityType"), args.entity),
                q.eq(q.field("entityId"), args.entity_id),
              ]
            : []),
          ...(args.type ? [q.eq(q.field("type"), args.type)] : []),
        ),
      )
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit ?? 3 });
    return pageResult(
      result,
      result.page.map((row) =>
        facts(row, [
          "_id",
          "type",
          "title",
          "entityType",
          "entityId",
          "dueAt",
          "status",
        ]),
      ),
      args.limit ?? 3,
    );
  },
});

export const listInvoices = createOrgQuery({
  permission: { feature: "invoices", action: "view" },
})({
  args: {
    status: z.enum(["unpaid", "partially_paid", "paid", "overdue"]).optional(),
    company_id: z.string().min(1).max(100).optional(),
    ...paging,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("invoices")
      .withIndex("organizationId", (q) => q.eq("organizationId", ctx.orgId))
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          q.eq(q.field("type"), "customer_invoice"),
          ...(args.company_id
            ? [q.eq(q.field("companyId"), args.company_id)]
            : []),
          ...(args.status === "overdue"
            ? [
                q.eq(q.field("state"), "posted"),
                q.gt(q.field("amountDue"), 0),
                q.lt(q.field("dueDate"), Date.now()),
              ]
            : args.status === "unpaid"
              ? [
                  q.eq(q.field("state"), "posted"),
                  q.gt(q.field("amountDue"), 0),
                ]
              : args.status
                ? [q.eq(q.field("paymentStatus"), args.status)]
                : []),
        ),
      )
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit ?? 3 });
    return pageResult(
      result,
      result.page.map((row) =>
        facts(row, [
          "_id",
          "number",
          "state",
          "paymentStatus",
          "amountDue",
          "currency",
          "dueDate",
          "companyId",
        ]),
      ),
      args.limit ?? 3,
    );
  },
});

export const pipelineOverview = createOrgQuery({
  permission: { feature: "deals", action: "view" },
})({
  args: {
    from: z.string().max(100).optional(),
    to: z.string().max(100).optional(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const from = args.from ? resolveDate(args.from, now) : -Infinity;
    const to = args.to ? resolveDate(args.to, now, true) : Infinity;
    if (from > to) throw new Error("The start must be before the end.");
    const rows = await ctx.db
      .query("deals")
      .withIndex("organizationId", (q) => q.eq("organizationId", ctx.orgId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .take(501);
    const groups = new Map<
      string,
      {
        stage: string;
        currency: string;
        count: number;
        value: number;
        unvalued: number;
        stalled: number;
      }
    >();
    for (const row of rows.slice(0, 500)) {
      if (row._creationTime < from || row._creationTime > to) continue;
      const currency = row.currency ?? "unknown";
      const key = `${row.stage}:${currency}`;
      const group = groups.get(key) ?? {
        stage: row.stage,
        currency,
        count: 0,
        value: 0,
        unvalued: 0,
        stalled: 0,
      };
      group.count++;
      group.value += row.value ?? 0;
      if (row.value === undefined) group.unvalued++;
      if (
        !["won", "lost"].includes(row.stage) &&
        row.stageEnteredAt !== undefined &&
        now - row.stageEnteredAt > 14 * 86400000
      )
        group.stalled++;
      groups.set(key, group);
    }
    return boundedOutput({
      by_stage: [...groups.values()],
      partial: rows.length > 500,
      scanned: Math.min(rows.length, 500),
      date_basis: "created_at",
      stalled_days: 14,
    });
  },
});
