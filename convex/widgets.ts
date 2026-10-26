import { z } from "zod";
import { createOrgQuery } from "./functions";

// Dashboard widgets proposed by agents and approved by a person. The stored
// row is only a spec: type + data source. Rendering always uses built-in
// components, never agent-provided code.

export const listWidgets = createOrgQuery()({
  args: {},
  returns: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      source: z.string(),
    })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("widgets")
      .withIndex("organizationId_createdAt", (q) =>
        q.eq("organizationId", ctx.orgId)
      )
      .take(20);
    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      type: row.type,
      source: row.source,
    }));
  },
});
