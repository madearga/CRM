/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import aggregateSchema from "../../node_modules/@convex-dev/aggregate/src/component/schema";
import schema from "../schema";
import { api } from "../_generated/api";

// Replace the old static-object assertions with the actual query interface.
const session = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
}));
vi.mock("../auth", () => ({
  authClient: { getHeaders: async () => new Headers() },
  getAuth: () => ({ api: {} }),
}));
vi.mock("../authHelpers", () => ({
  getSessionUser: async () => session.user,
  getSessionUserWriter: async () => session.user,
}));
const modules = import.meta.glob([
  "../**/*.{ts,js}",
  "!../__tests__/**",
  "!../convex/**",
]);
const aggregates = import.meta.glob([
  "../../node_modules/@convex-dev/aggregate/src/component/**/*.ts",
  "!../../node_modules/@convex-dev/aggregate/src/component/**/*.test.ts",
]);
afterEach(() => {
  session.user = null;
});

describe("dashboard overview query interface", () => {
  it("returns honest zero values and the real snapshot shape for an empty workspace", async () => {
    const t = convexTest(schema, modules);
    for (const name of [
      "aggregateCompaniesByOrg",
      "aggregateDealsByOrg",
      "aggregateDealsByStage",
      "aggregateActivitiesByOrg",
    ]) {
      t.registerComponent(name, aggregateSchema, aggregates);
    }
    const { userId, organizationId } = await t.run(async (ctx) => {
      const now = Date.now();
      const organizationId = await ctx.db.insert("organization", {
        name: "Empty workspace",
        slug: "empty-workspace",
        createdAt: now,
        monthlyCredits: 0,
      });
      const userId = await ctx.db.insert("user", {
        name: "Owner",
        email: "owner@example.test",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("member", {
        organizationId,
        userId,
        role: "owner",
        createdAt: now,
      });
      return { userId, organizationId };
    });
    session.user = {
      _id: userId,
      id: userId,
      activeOrganization: { id: organizationId, role: "owner" },
    };
    const result = await t.query(api.dashboard.overview, {});
    expect(result).toMatchObject({
      pipelineValue: 0,
      totalDeals: 0,
      totalCompanies: 0,
      totalActivities: 0,
      recentActivities: [],
      upcomingActivities: [],
      agingDeals: [],
    });
    expect(result.dealsByStage).toEqual(
      ["new", "contacted", "proposal", "won", "lost"].map((stage) => ({
        stage,
        count: 0,
        value: 0,
      })),
    );
  });

  it("rejects a signed-out snapshot query", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.dashboard.overview, {})).rejects.toThrow();
  });
});
