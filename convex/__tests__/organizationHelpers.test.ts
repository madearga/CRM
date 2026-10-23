/// <reference types="vite/client" />
/**
 * Tests for the CRM organization helpers.
 *
 * The tests run against the in memory database of convex-test. They cover the
 * personal organization, its owner membership, the default permission
 * templates and the active organization resolution.
 */
import { convexTest } from 'convex-test';
import { entsTableFactory } from 'convex-ents';
import { describe, expect, it } from 'vitest';

import { entDefinitions, default as appSchema } from '../schema';
import {
  countOwnedOrganizations,
  createCrmOrganization,
  createPersonalOrganization,
  evaluateInvitation,
  findMembership,
  ORGANIZATION_LIMIT,
  resolveActiveOrganization,
} from '../organizationHelpers';

// The module map lets convex-test find the generated files of the app. The
// tests call the helpers directly, so no function module is imported.
const modules = import.meta.glob('../_generated/*.ts');

const setup = () => convexTest({ modules, schema: appSchema });

type TestCtx = Parameters<Parameters<ReturnType<typeof setup>['run']>[0]>[0];

const insertUser = (ctx: TestCtx, email: string) =>
  ctx.db.insert('user', {
    createdAt: Date.now(),
    email,
    emailVerified: true,
    name: 'Owner',
    updatedAt: Date.now(),
  });

const insertOrganization = (ctx: TestCtx, name: string, slug: string) =>
  ctx.db.insert('organization', {
    createdAt: Date.now(),
    monthlyCredits: 0,
    name,
    slug,
  });

const createTable = (ctx: TestCtx) =>
  entsTableFactory<typeof ctx, typeof entDefinitions>(ctx, entDefinitions);

describe('createPersonalOrganization', () => {
  it('creates the organization, the owner membership and the templates', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const userId = await insertUser(ctx, 'owner@example.com');

      const created = await createPersonalOrganization(ctx, {
        image: null,
        name: 'Owner',
        userId,
      });

      return { created, userId };
    });

    expect(result.created).not.toBeNull();

    await t.run(async (ctx) => {
      const table = createTable(ctx);

      const user = await table('user').getX(result.userId);
      const organizationId = user.personalOrganizationId;

      expect(organizationId).toBeTruthy();
      expect(user.lastActiveOrganizationId).toBe(organizationId);

      if (!organizationId) {
        throw new Error('The personal organization was not created');
      }

      const organization = await table('organization').getX(organizationId);
      expect(organization.name).toBe("Owner's Organization");
      expect(organization.slug).toBe(
        `personal-${String(result.userId).slice(-8)}`
      );

      const membership = await table('member')
        .filter((q) => q.eq(q.field('userId'), result.userId))
        .take(1);
      expect(membership.length).toBe(1);
      expect(membership[0].role).toBe('owner');
      expect(membership[0].organizationId).toBe(organizationId);

      const templates = await table('permissionTemplates')
        .filter((q) => q.eq(q.field('organizationId'), organizationId))
        .take(20);
      expect(templates.length).toBe(3);

      const ownerTemplate = templates.find(
        (template) => template.name === 'Owner'
      );
      if (!ownerTemplate) {
        throw new Error('The owner template was not created');
      }

      const ownerEntries = await table('permissionEntries')
        .filter((q) => q.eq(q.field('templateId'), ownerTemplate._id))
        .take(500);
      expect(ownerEntries.length).toBeGreaterThan(0);
      expect(ownerEntries.every((entry) => entry.allowed === true)).toBe(true);

      // The admin template denies the role management.
      const adminTemplate = templates.find(
        (template) => template.name === 'Admin'
      );
      if (!adminTemplate) {
        throw new Error('The admin template was not created');
      }
      const adminEntries = await table('permissionEntries')
        .filter((q) => q.eq(q.field('templateId'), adminTemplate._id))
        .take(500);
      expect(
        adminEntries.some(
          (entry) =>
            entry.feature === 'team' &&
            entry.action === 'manage_roles' &&
            entry.allowed === false
        )
      ).toBe(true);
    });
  });

  it('repairs a missing owner membership of the personal organization', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      const organizationId = await insertOrganization(
        ctx,
        "Owner's Organization",
        'personal-1234'
      );
      await table('user').getX(userId).patch({
        lastActiveOrganizationId: organizationId,
        personalOrganizationId: organizationId,
      });

      const created = await createPersonalOrganization(ctx, {
        image: null,
        name: 'Owner',
        userId,
      });

      const members = await table('member')
        .filter((q) => q.eq(q.field('userId'), userId))
        .take(10);

      return { created, members: members.length };
    });

    expect(result.created).toBeNull();
    expect(result.members).toBe(1);
  });

  it('does not create a second organization for the same user', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const userId = await insertUser(ctx, 'owner@example.com');

      const first = await createPersonalOrganization(ctx, {
        image: null,
        name: 'Owner',
        userId,
      });
      const second = await createPersonalOrganization(ctx, {
        image: null,
        name: 'Owner',
        userId,
      });

      return { first, second };
    });

    expect(result.first).not.toBeNull();
    expect(result.second).toBeNull();
  });
});

describe('resolveActiveOrganization', () => {
  it('returns null when the user has no membership', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      const organizationId = await insertOrganization(ctx, 'Other', 'other');

      const active = await resolveActiveOrganization(table, {
        _id: userId,
        lastActiveOrganizationId: organizationId,
        personalOrganizationId: null,
      });

      return { active };
    });

    expect(result.active).toBeNull();
  });

  it('returns the organization of a real membership', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      const organizationId = await insertOrganization(ctx, 'Team', 'team');
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'admin',
        userId,
      });

      const active = await resolveActiveOrganization(table, {
        _id: userId,
        lastActiveOrganizationId: organizationId,
        personalOrganizationId: null,
      });

      return {
        membershipRole: active?.membership?.role,
        organizationId: active?.organization?._id,
      };
    });

    expect(result.organizationId).toBeTruthy();
    expect(result.membershipRole).toBe('admin');
  });

  it('skips a stale organization without a membership', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      const staleId = await insertOrganization(ctx, 'Stale', 'stale');
      const personalId = await insertOrganization(ctx, 'Personal', 'personal');
      await table('member').insert({
        createdAt: Date.now(),
        organizationId: personalId,
        role: 'owner',
        userId,
      });

      const active = await resolveActiveOrganization(table, {
        _id: userId,
        lastActiveOrganizationId: staleId,
        personalOrganizationId: personalId,
      });

      return { organizationId: active?.organization?._id };
    });

    expect(result.organizationId).toBeTruthy();
  });
});

describe('createCrmOrganization', () => {
  it('creates the organization, the owner membership and the templates', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      const created = await createCrmOrganization(table, {
        name: 'My Team',
        ownerUserId: userId,
        slug: 'my-team',
      });

      const organization = await table('organization').getX(created.id);
      const members = await table('member')
        .filter((q) => q.eq(q.field('organizationId'), created.id))
        .take(10);
      const templates = await table('permissionTemplates')
        .filter((q) => q.eq(q.field('organizationId'), created.id))
        .take(20);

      return {
        created,
        name: organization.name,
        slug: organization.slug,
        memberCount: members.length,
        memberRole: members[0]?.role,
        templateCount: templates.length,
      };
    });

    expect(result.created.slug).toBe('my-team');
    expect(result.name).toBe('My Team');
    expect(result.slug).toBe('my-team');
    expect(result.memberCount).toBe(1);
    expect(result.memberRole).toBe('owner');
    expect(result.templateCount).toBe(3);
  });
});

describe('countOwnedOrganizations', () => {
  it('counts the personal organization of the user', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      await createPersonalOrganization(ctx, {
        image: null,
        name: 'Owner',
        userId,
      });

      return await countOwnedOrganizations(table, userId);
    });

    expect(result).toBe(1);
  });

  it('does not count an organization where the user is a member', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      const organizationId = await insertOrganization(ctx, 'Team', 'team');
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'member',
        userId,
      });

      return await countOwnedOrganizations(table, userId);
    });

    expect(result).toBe(0);
  });

  it('counts every owned organization only once', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      const firstId = await insertOrganization(ctx, 'First', 'first');
      const secondId = await insertOrganization(ctx, 'Second', 'second');
      await table('member').insert({
        createdAt: Date.now(),
        organizationId: firstId,
        role: 'owner',
        userId,
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId: secondId,
        role: 'owner',
        userId,
      });

      return await countOwnedOrganizations(table, userId);
    });

    expect(result).toBe(2);
    expect(ORGANIZATION_LIMIT).toBe(3);
  });
});

describe('evaluateInvitation', () => {
  const invitation = {
    email: 'guest@example.com',
    expiresAt: 1_000,
    organizationId: 'org-1' as any,
    role: 'member',
    roleTemplateId: null,
    status: 'pending',
  };

  it('allows a pending invitation for the same email', () => {
    const decision = evaluateInvitation({
      invitation,
      memberCount: 1,
      memberLimit: 5,
      now: 0,
      userEmail: 'guest@example.com',
    });

    expect(decision.allowed).toBe(true);
  });

  it('denies an invitation for another email', () => {
    const decision = evaluateInvitation({
      invitation,
      memberCount: 1,
      memberLimit: 5,
      now: 0,
      userEmail: 'other@example.com',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe(
      'This invitation is not found for your email address'
    );
  });

  it('denies a missing invitation', () => {
    const decision = evaluateInvitation({
      invitation: null,
      memberCount: 0,
      memberLimit: 5,
      now: 0,
      userEmail: 'guest@example.com',
    });

    expect(decision.allowed).toBe(false);
  });

  it('denies an invitation that was processed before', () => {
    const decision = evaluateInvitation({
      invitation: { ...invitation, status: 'accepted' },
      memberCount: 1,
      memberLimit: 5,
      now: 0,
      userEmail: 'guest@example.com',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('This invitation has already been processed');
  });

  it('denies an expired invitation', () => {
    const decision = evaluateInvitation({
      invitation,
      memberCount: 1,
      memberLimit: 5,
      now: 2_000,
      userEmail: 'guest@example.com',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('This invitation has expired');
  });

  it('denies an invitation that expires now', () => {
    const decision = evaluateInvitation({
      invitation,
      memberCount: 1,
      memberLimit: 5,
      now: 1_000,
      userEmail: 'guest@example.com',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('This invitation has expired');
  });

  it('allows an invitation that is still valid', () => {
    const decision = evaluateInvitation({
      invitation,
      memberCount: 1,
      memberLimit: 5,
      now: 999,
      userEmail: 'guest@example.com',
    });

    expect(decision.allowed).toBe(true);
  });

  it('denies an invitation when the member limit is reached', () => {
    const decision = evaluateInvitation({
      invitation,
      memberCount: 5,
      memberLimit: 5,
      now: 0,
      userEmail: 'guest@example.com',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('member limit reached');
  });
});

describe('findMembership', () => {
  it('returns null for a user without a membership', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await insertUser(ctx, 'owner@example.com');
      const organizationId = await insertOrganization(ctx, 'Team', 'team');

      const membership = await findMembership(table, {
        organizationId,
        userId,
      });

      return { membership };
    });

    expect(result.membership).toBeNull();
  });
});
