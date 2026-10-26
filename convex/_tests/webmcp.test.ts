/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import aggregateSchema from '../../node_modules/@convex-dev/aggregate/src/component/schema';
import { api } from '../_generated/api';

// Only the external session transport is mocked. The real organization,
// permission, validation, and query handlers run below.
const session = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
}));
vi.mock('../auth', () => ({
  authClient: { getHeaders: async () => new Headers() },
  getAuth: () => ({ api: {} }),
}));
vi.mock('../authHelpers', () => ({
  getSessionUser: async () => session.user,
  getSessionUserWriter: async () => session.user,
}));

const modules = import.meta.glob([
  '../**/*.{ts,js}',
  '!../__tests__/**',
  '!../convex/**',
]);

const aggregateModules = import.meta.glob([
  '../../node_modules/@convex-dev/aggregate/src/component/**/*.ts',
  '!../../node_modules/@convex-dev/aggregate/src/component/**/*.test.ts',
]);

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function fixture() {
  const t = convexTest(schema, modules);
  for (const name of [
    'aggregateActivitiesByOrg',
    'aggregateDealsByOrg',
    'aggregateDealsByStage',
  ]) {
    t.registerComponent(name, aggregateSchema, aggregateModules);
  }
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert('organization', {
      name: 'Ruang test',
      slug: 'ruang-test',
      monthlyCredits: 0,
      createdAt: now,
    });
    const otherOrganizationId = await ctx.db.insert('organization', {
      name: 'Ruang lain',
      slug: 'ruang-lain',
      monthlyCredits: 0,
      createdAt: now,
    });
    const userId = await ctx.db.insert('user', {
      email: 'owner@example.test',
      name: 'Owner',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('member', {
      organizationId,
      userId,
      role: 'owner',
      createdAt: now,
    });
    // A member with no permission template: checkPermission denies everything.
    const limitedUserId = await ctx.db.insert('user', {
      email: 'limited@example.test',
      name: 'Limited',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('member', {
      organizationId,
      userId: limitedUserId,
      role: 'member',
      createdAt: now,
    });

    const acmeId = await ctx.db.insert('companies', {
      organizationId,
      name: 'PT Acme Nusantara',
      ownerId: userId,
      status: 'active',
    });
    // Same name in the other tenant: must never leak into org A results.
    await ctx.db.insert('companies', {
      organizationId: otherOrganizationId,
      name: 'PT Acme Rival',
      ownerId: userId,
    });
    const budiId = await ctx.db.insert('contacts', {
      organizationId,
      fullName: 'Budi Santoso',
      email: 'budi@acme.test',
      ownerId: userId,
      companyId: acmeId,
      notes: 'private contact note',
    });
    const dealId = await ctx.db.insert('deals', {
      organizationId,
      title: 'Acme renewal',
      companyId: acmeId,
      stage: 'proposal',
      value: 10_000_000,
      currency: 'IDR',
      ownerId: userId,
    });
    await ctx.db.insert('deals', {
      organizationId,
      title: 'Acme export',
      companyId: acmeId,
      stage: 'proposal',
      value: 5_000,
      currency: 'USD',
      ownerId: userId,
    });
    await ctx.db.insert('deals', {
      organizationId,
      title: 'Acme unvalued',
      companyId: acmeId,
      stage: 'proposal',
      ownerId: userId,
    });
    // A deal in the other tenant: must not enter org A pipeline totals.
    await ctx.db.insert('deals', {
      organizationId: otherOrganizationId,
      title: 'Rival deal',
      stage: 'proposal',
      value: 999_999_999,
      currency: 'IDR',
      ownerId: userId,
    });
    await ctx.db.insert('activities', {
      organizationId,
      type: 'note',
      createdAt: now,
      entityType: 'deal',
      entityId: dealId,
      title: 'Private note',
      description: 'secret internal description',
      metadata: { internal: 'secret' },
      createdBy: userId,
    });
    await ctx.db.insert('activities', {
      organizationId,
      type: 'call',
      createdAt: now,
      entityType: 'deal',
      entityId: dealId,
      title: 'Kickoff call',
      createdBy: userId,
    });
    await ctx.db.insert('invoices', {
      organizationId,
      ownerId: userId,
      number: 'INV-001',
      type: 'customer_invoice',
      state: 'posted',
      invoiceDate: now,
      dueDate: now - 86400000,
      subtotal: 1_000_000,
      totalAmount: 1_100_000,
      amountDue: 1_100_000,
      currency: 'IDR',
      paymentStatus: 'unpaid',
      companyId: acmeId,
      notes: 'private invoice note',
      internalNotes: 'secret',
    });
    await ctx.db.insert('invoices', {
      organizationId,
      ownerId: userId,
      number: 'INV-002',
      type: 'customer_invoice',
      state: 'posted',
      invoiceDate: now,
      dueDate: now + 86400000,
      subtotal: 100,
      totalAmount: 110,
      amountDue: 110,
      currency: 'USD',
      paymentStatus: 'unpaid',
      companyId: acmeId,
    });
    // Pagination corpus: five companies sharing a search prefix.
    for (let i = 1; i <= 5; i++) {
      await ctx.db.insert('companies', {
        organizationId,
        name: `PT Paging ${i}`,
        ownerId: userId,
      });
    }
    return {
      organizationId,
      otherOrganizationId,
      userId,
      limitedUserId,
      acmeId,
      budiId,
      dealId,
    };
  });
  return { t, ...ids };
}

function asOwner(f: Fixture) {
  session.user = {
    _id: f.userId,
    id: f.userId,
    isAdmin: false,
    name: 'Owner',
    activeOrganization: {
      id: f.organizationId,
      role: 'owner',
      name: 'Ruang test',
      slug: 'ruang-test',
    },
  };
}

function asLimited(f: Fixture) {
  session.user = {
    _id: f.limitedUserId,
    id: f.limitedUserId,
    isAdmin: false,
    name: 'Limited',
    activeOrganization: {
      id: f.organizationId,
      role: 'member',
      name: 'Ruang test',
      slug: 'ruang-test',
    },
  };
}

beforeEach(() => {
  session.user = null;
});

describe('webmcp tenant scoping', () => {
  it('search_records returns only the active organization records', async () => {
    const f = await fixture();
    asOwner(f);
    const result = await f.t.query(api.webmcp.searchRecords, {
      entity: 'company',
      query: 'Acme',
    });
    expect(result.items).toHaveLength(1);
    expect((result.items[0] as { name: string }).name).toBe(
      'PT Acme Nusantara'
    );
  });

  it('get_record refuses an id from another organization', async () => {
    const f = await fixture();
    asOwner(f);
    await expect(
      f.t.query(api.webmcp.getRecord, {
        entity: 'company',
        id: f.acmeId,
      })
    ).resolves.toBeDefined();
    // acmeId belongs to the active org; find the rival org's company id.
    const rivalId = await f.t.run(async (ctx) => {
      for await (const row of ctx.db
        .query('companies')
        .withIndex('organizationId', (q) =>
          q.eq('organizationId', f.otherOrganizationId)
        )) {
        return row._id;
      }
      throw new Error('rival company missing');
    });
    await expect(
      f.t.query(api.webmcp.getRecord, { entity: 'company', id: rivalId })
    ).rejects.toThrow();
  });

  it('pipeline_overview excludes other tenants from the totals', async () => {
    const f = await fixture();
    asOwner(f);
    const result = await f.t.query(api.webmcp.pipelineOverview, {
      from: 'today',
    });
    const totalValue = result.by_stage
      .filter((g) => g.currency === 'IDR')
      .reduce((sum, g) => sum + g.value, 0);
    expect(totalValue).toBe(10_000_000);
  });

  it('list_invoices returns only the active organization invoices', async () => {
    const f = await fixture();
    asOwner(f);
    const result = await f.t.query(api.webmcp.listInvoices, {
      status: 'unpaid',
    });
    expect(result.items.map((i) => (i as { number: string }).number).sort())
      .toEqual(['INV-001', 'INV-002']);
  });
});

describe('webmcp read permissions', () => {
  it('refuses an unauthenticated call', async () => {
    const f = await fixture();
    await expect(
      f.t.query(api.webmcp.searchRecords, {
        entity: 'company',
        query: 'Acme',
      })
    ).rejects.toThrow();
  });

  it('refuses a member without the view permission', async () => {
    const f = await fixture();
    asLimited(f);
    await expect(
      f.t.query(api.webmcp.searchRecords, {
        entity: 'company',
        query: 'Acme',
      })
    ).rejects.toThrow(/FORBIDDEN|Missing permission/);
    await expect(
      f.t.query(api.webmcp.listInvoices, { status: 'unpaid' })
    ).rejects.toThrow();
    await expect(
      f.t.query(api.webmcp.listActivities, {})
    ).rejects.toThrow();
    await expect(
      f.t.query(api.webmcp.pipelineOverview, {})
    ).rejects.toThrow();
  });
});

describe('webmcp private note exclusion', () => {
  it('get_record projects only safe fields, never notes', async () => {
    const f = await fixture();
    asOwner(f);
    const contact = await f.t.query(api.webmcp.getRecord, {
      entity: 'contact',
      id: f.budiId,
    });
    expect(Object.keys(contact).sort()).toEqual(['companyId', 'fullName', 'id']);
    expect(contact).not.toHaveProperty('notes');
  });

  it('list_activities never exposes note descriptions or metadata', async () => {
    const f = await fixture();
    asOwner(f);
    const result = await f.t.query(api.webmcp.listActivities, {
      entity: 'deal',
      entity_id: f.dealId,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    for (const item of result.items) {
      expect(item).not.toHaveProperty('description');
      expect(item).not.toHaveProperty('metadata');
      expect(JSON.stringify(item)).not.toContain('secret');
    }
  });

  it('list_invoices never exposes invoice notes', async () => {
    const f = await fixture();
    asOwner(f);
    const result = await f.t.query(api.webmcp.listInvoices, {
      status: 'unpaid',
    });
    for (const item of result.items) {
      expect(item).not.toHaveProperty('notes');
      expect(item).not.toHaveProperty('internalNotes');
    }
  });
});

describe('webmcp pagination', () => {
  it('pages through the corpus with cursor and has_more', async () => {
    const f = await fixture();
    asOwner(f);
    const page1 = await f.t.query(api.webmcp.searchRecords, {
      entity: 'company',
      query: 'Paging',
      limit: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.has_more).toBe(true);
    expect(page1.next_cursor).toBeTruthy();

    const page2 = await f.t.query(api.webmcp.searchRecords, {
      entity: 'company',
      query: 'Paging',
      limit: 2,
      cursor: page1.next_cursor,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.has_more).toBe(true);

    const page3 = await f.t.query(api.webmcp.searchRecords, {
      entity: 'company',
      query: 'Paging',
      limit: 2,
      cursor: page2.next_cursor,
    });
    expect(page3.items).toHaveLength(1);
    expect(page3.has_more).toBe(false);
    expect(page3.next_cursor).toBeNull();

    const names = [page1, page2, page3].flatMap((p) =>
      p.items.map((i) => (i as { name: string }).name)
    );
    expect(new Set(names).size).toBe(5);
  });
});

describe('webmcp currency grouping', () => {
  it('groups pipeline value per stage and currency and counts unvalued deals', async () => {
    const f = await fixture();
    asOwner(f);
    const result = await f.t.query(api.webmcp.pipelineOverview, {
      from: 'today',
    });
    const proposalGroups = result.by_stage.filter(
      (g) => g.stage === 'proposal'
    );
    expect(proposalGroups).toHaveLength(3);
    const idr = proposalGroups.find((g) => g.currency === 'IDR');
    const usd = proposalGroups.find((g) => g.currency === 'USD');
    expect(idr).toMatchObject({ count: 1, value: 10_000_000, unvalued: 0 });
    expect(usd).toMatchObject({ count: 1, value: 5_000, unvalued: 0 });
    // The unvalued deal lands in the 'unknown' currency bucket.
    const unknown = proposalGroups.find((g) => g.currency === 'unknown');
    expect(unknown).toMatchObject({ count: 1, value: 0, unvalued: 1 });
    const unvalued = await f.t.query(api.webmcp.pipelineOverview, {});
    const idrAll = unvalued.by_stage
      .filter((g) => g.currency === 'unknown' && g.stage === 'proposal')
      .reduce((sum, g) => sum + g.unvalued, 0);
    expect(idrAll).toBe(1);
    expect(result.partial).toBe(false);
  });

  it('marks bounded pipeline scans as partial instead of claiming complete totals', async () => {
    const f = await fixture();
    asOwner(f);
    await f.t.run(async ctx => {
      for (let i = 0; i < 501; i++) await ctx.db.insert('deals', { organizationId: f.organizationId, ownerId: f.userId, title: `Bounded ${i}`, stage: 'new', value: 1, currency: 'IDR' });
    });
    const result = await f.t.query(api.webmcp.pipelineOverview, {});
    expect(result.partial).toBe(true);
    expect(result.scanned).toBe(500);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
  });

  it('honours the date range on creation time', async () => {
    const f = await fixture();
    asOwner(f);
    const future = await f.t.query(api.webmcp.pipelineOverview, {
      from: 'tomorrow',
    });
    expect(future.by_stage).toHaveLength(0);
  });
});
