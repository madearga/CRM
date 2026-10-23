/// <reference types="vite/client" />
/**
 * Tests for the permission check of the organization actions.
 *
 * The check must use the real CRM membership of the current user. A CRM
 * business feature is checked with the permission template of the membership.
 * An organizational action keeps the role based rules. Every other case fails
 * closed.
 */
import { convexTest } from 'convex-test';
import { entsTableFactory } from 'convex-ents';
import { describe, expect, it } from 'vitest';

import type { AuthCtx } from '../functions';
import { entDefinitions, default as appSchema } from '../schema';
import { evaluatePermissions, hasPermission } from '../authHelpers';
import { canAssignRole, canInviteRole } from '../orgAccess';
import { findMembership } from '../organizationHelpers';

const modules = import.meta.glob('../_generated/*.ts');

const setup = () => convexTest({ modules, schema: appSchema });

type TestCtx = Parameters<Parameters<ReturnType<typeof setup>['run']>[0]>[0];

const createTable = (ctx: TestCtx) =>
  entsTableFactory<typeof ctx, typeof entDefinitions>(ctx, entDefinitions);

const authCtx = (table: unknown, user: unknown) =>
  ({ table, user } as unknown as AuthCtx);

describe('role change with a current membership', () => {
  it('denies an admin that promotes a member to owner', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const adminId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'admin@example.com',
        emailVerified: true,
        name: 'Admin',
        updatedAt: Date.now(),
      });
      const memberId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'member@example.com',
        emailVerified: true,
        name: 'Member',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'admin',
        userId: adminId,
      });
      const targetId = await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'member',
        userId: memberId,
      });
      const target = await table('member').getX(targetId);

      // The decision uses the role of the current CRM membership.
      const membership = await findMembership(table, {
        organizationId,
        userId: adminId,
      });

      return {
        assign: canAssignRole({
          currentRole: membership.role as string,
          destinationRole: 'owner',
          sourceRole: 'member',
        }),
        invite: canInviteRole({
          currentRole: membership.role as string,
          invitedRole: 'owner',
        }),
        targetRole: target.role,
      };
    });

    expect(result.assign.allowed).toBe(false);
    expect(result.invite.allowed).toBe(false);
    expect(result.targetRole).toBe('member');
  });

  it('allows an owner that promotes a member to owner', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const ownerId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'owner@example.com',
        emailVerified: true,
        name: 'Owner',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'owner',
        userId: ownerId,
      });

      const membership = await findMembership(table, {
        organizationId,
        userId: ownerId,
      });

      return {
        assign: canAssignRole({
          currentRole: membership.role as string,
          destinationRole: 'owner',
          sourceRole: 'member',
        }),
        invite: canInviteRole({
          currentRole: membership.role as string,
          invitedRole: 'owner',
        }),
      };
    });

    expect(result.assign.allowed).toBe(true);
    expect(result.invite.allowed).toBe(true);
  });
});

describe('evaluatePermissions', () => {
  it('allows the owner of the organization to manage the organization', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'owner@example.com',
        emailVerified: true,
        name: 'Owner',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'owner',
        userId,
      });

      const user = {
        _id: userId,
        activeOrganization: { id: organizationId },
      };

      return {
        allowed: await hasPermission(
          authCtx(table, user),
          { permissions: { organization: ['update'] } },
          false
        ),
      };
    });

    expect(result.allowed).toBe(true);
  });

  it('allows the owner of the organization to manage the organization', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'owner@example.com',
        emailVerified: true,
        name: 'Owner',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'owner',
        userId,
      });

      const user = {
        _id: userId,
        activeOrganization: { id: organizationId },
      };

      return {
        deleteMember: await evaluatePermissions(authCtx(table, user), {
          permissions: { member: ['delete'] },
        }),
        updateOrganization: await evaluatePermissions(authCtx(table, user), {
          permissions: { organization: ['update'] },
        }),
      };
    });

    expect(result.updateOrganization.allowed).toBe(true);
    expect(result.deleteMember.allowed).toBe(true);
  });

  it('denies the member of the organization', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'member@example.com',
        emailVerified: true,
        name: 'Member',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'member',
        userId,
      });

      const user = {
        _id: userId,
        activeOrganization: { id: organizationId },
      };

      return await evaluatePermissions(authCtx(table, user), {
        permissions: { organization: ['update'] },
      });
    });

    expect(result.allowed).toBe(false);
  });

  it('denies every action without an active organization', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'owner@example.com',
        emailVerified: true,
        name: 'Owner',
        updatedAt: Date.now(),
      });

      return await evaluatePermissions(
        authCtx(table, { _id: userId, activeOrganization: null }),
        { permissions: { organization: ['update'] } }
      );
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('No active organization');
  });

  it('denies every action without a membership', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'outsider@example.com',
        emailVerified: true,
        name: 'Outsider',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });

      return await evaluatePermissions(
        authCtx(table, {
          _id: userId,
          activeOrganization: { id: organizationId },
        }),
        { permissions: { organization: ['update'] } }
      );
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      'You are not a member of the active organization'
    );
  });

  it('uses the permission template for a CRM business feature', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'member@example.com',
        emailVerified: true,
        name: 'Member',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });
      const templateId = await table('permissionTemplates').insert({
        color: '#3b82f6',
        description: 'View only',
        isDefault: false,
        name: 'View only',
        organizationId,
        ownerId: userId,
      });
      await table('permissionEntries').insert({
        action: 'view',
        allowed: true,
        feature: 'contacts',
        organizationId,
        templateId,
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        permissionTemplateId: templateId,
        role: 'member',
        userId,
      });

      const user = {
        _id: userId,
        activeOrganization: { id: organizationId },
      };

      return {
        create: await evaluatePermissions(authCtx(table, user), {
          permissions: { contacts: ['create'] },
        }),
        view: await evaluatePermissions(authCtx(table, user), {
          permissions: { contacts: ['view'] },
        }),
      };
    });

    expect(result.view.allowed).toBe(true);
    expect(result.create.allowed).toBe(false);
  });

  it('denies an action that the feature does not define', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'owner@example.com',
        emailVerified: true,
        name: 'Owner',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'owner',
        userId,
      });

      const user = {
        _id: userId,
        activeOrganization: { id: organizationId },
      };

      return await evaluatePermissions(authCtx(table, user), {
        permissions: { contacts: ['invite'] },
      });
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Unknown permission: contacts:invite');
  });

  it('denies an unknown resource', async () => {
    const t = setup();

    const result = await t.run(async (ctx) => {
      const table = createTable(ctx);

      const userId = await ctx.db.insert('user', {
        createdAt: Date.now(),
        email: 'owner@example.com',
        emailVerified: true,
        name: 'Owner',
        updatedAt: Date.now(),
      });
      const organizationId = await ctx.db.insert('organization', {
        createdAt: Date.now(),
        monthlyCredits: 0,
        name: 'Team',
        slug: 'team',
      });
      await table('member').insert({
        createdAt: Date.now(),
        organizationId,
        role: 'owner',
        userId,
      });

      const user = {
        _id: userId,
        activeOrganization: { id: organizationId },
      };

      return await evaluatePermissions(authCtx(table, user), {
        permissions: { unknownResource: ['update'] },
      });
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Unknown permission resource: unknownResource');
  });
});
