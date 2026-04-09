// RISK: community library - not official Convex
import { defineEnt, defineEntSchema, getEntDefinitions } from 'convex-ents';
import { v } from 'convex/values';

const schema = defineEntSchema(
  {
    // --------------------
    // Better Auth Tables
    // --------------------

    session: defineEnt({
      expiresAt: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
      ipAddress: v.optional(v.union(v.null(), v.string())),
      userAgent: v.optional(v.union(v.null(), v.string())),
      impersonatedBy: v.optional(v.union(v.null(), v.string())),
      activeOrganizationId: v.optional(v.union(v.null(), v.string())),
    })
      .field('token', v.string(), { index: true })
      .edge('user', { to: 'user', field: 'userId' })
      .index('expiresAt', ['expiresAt'])
      .index('expiresAt_userId', ['expiresAt', 'userId']),

    account: defineEnt({
      accountId: v.string(),
      providerId: v.string(),
      accessToken: v.optional(v.union(v.null(), v.string())),
      refreshToken: v.optional(v.union(v.null(), v.string())),
      idToken: v.optional(v.union(v.null(), v.string())),
      accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
      refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
      scope: v.optional(v.union(v.null(), v.string())),
      password: v.optional(v.union(v.null(), v.string())),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .edge('user', { to: 'user', field: 'userId' })
      .index('accountId', ['accountId'])
      .index('accountId_providerId', ['accountId', 'providerId'])
      .index('providerId_userId', ['providerId', 'userId']),

    verification: defineEnt({
      value: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .field('identifier', v.string(), { index: true })
      .field('expiresAt', v.number(), { index: true }),

    organization: defineEnt({
      logo: v.optional(v.union(v.null(), v.string())),
      createdAt: v.number(),
      metadata: v.optional(v.union(v.null(), v.string())),
      monthlyCredits: v.number(),
      settings: v.optional(
        v.object({
          currency: v.union(v.literal('IDR'), v.literal('USD')),
        })
      ),
    })
      .field('slug', v.string(), { unique: true })
      .field('name', v.string(), { index: true })
      .edges('members', { to: 'member', ref: true })
      .edges('invitations', { to: 'invitation', ref: true })
      .edges('usersLastActive', {
        to: 'user',
        ref: 'lastActiveOrganizationId',
      })
      .edges('usersPersonal', { to: 'user', ref: 'personalOrganizationId' }),

    member: defineEnt({
      createdAt: v.number(),
    })
      .field('role', v.string(), { index: true })
      .edge('organization', { to: 'organization', field: 'organizationId' })
      .edge('user', { to: 'user', field: 'userId' })
      .index('organizationId_userId', ['organizationId', 'userId'])
      .index('organizationId_role', ['organizationId', 'role']),

    invitation: defineEnt({
      role: v.optional(v.union(v.null(), v.string())),
      expiresAt: v.number(),
    })
      .field('email', v.string(), { index: true })
      .field('status', v.string(), { index: true })
      .edge('organization', { to: 'organization', field: 'organizationId' })
      .edge('inviter', { to: 'user', field: 'inviterId' })
      .index('email_organizationId_status', [
        'email',
        'organizationId',
        'status',
      ])
      .index('organizationId_status', ['organizationId', 'status'])
      .index('email_status', ['email', 'status'])
      .index('organizationId_email', ['organizationId', 'email'])
      .index('organizationId_email_status', [
        'organizationId',
        'email',
        'status',
      ]),

    jwks: defineEnt({
      publicKey: v.string(),
      privateKey: v.string(),
      createdAt: v.number(),
    }),

    // --------------------
    // Unified User Model (App + Better Auth)
    // --------------------
    user: defineEnt({
      name: v.string(),
      emailVerified: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      image: v.optional(v.union(v.null(), v.string())),
      role: v.optional(v.union(v.null(), v.string())),
      banned: v.optional(v.union(v.null(), v.boolean())),
      banReason: v.optional(v.union(v.null(), v.string())),
      banExpires: v.optional(v.union(v.null(), v.number())),
      username: v.optional(v.union(v.null(), v.string())),
      deletedAt: v.optional(v.number()),
      // Profile fields — set via onboarding after first login
      bio: v.optional(v.union(v.null(), v.string())),
      firstName: v.optional(v.union(v.null(), v.string())),
      lastName: v.optional(v.union(v.null(), v.string())),
      linkedin: v.optional(v.union(v.null(), v.string())),
      location: v.optional(v.union(v.null(), v.string())),
      website: v.optional(v.union(v.null(), v.string())),
      x: v.optional(v.union(v.null(), v.string())),
    })
      .field('email', v.string(), { unique: true })
      .edges('sessions', { to: 'session', ref: 'userId' })
      .edges('accounts', { to: 'account', ref: 'userId' })
      .edges('members', { to: 'member', ref: 'userId' })
      .edges('invitations', { to: 'invitation', ref: 'inviterId' })
      .edge('lastActiveOrganization', {
        to: 'organization',
        field: 'lastActiveOrganizationId',
        optional: true,
      })
      .edge('personalOrganization', {
        to: 'organization',
        field: 'personalOrganizationId',
        optional: true,
      })
      .edges('companies', { ref: 'ownerId' })
      .edges('contacts', { ref: 'ownerId' })
      .edges('deals', { ref: 'ownerId' })
      // Note: activities use polymorphic entityType/entityId, queried via index
      // User's activities are fetched via organizationId_entityType_entityId index
      // No edges for activities — they're queried manually
      .index('email_name', ['email', 'name'])
      .index('name', ['name'])
      .index('username', ['username']),

    // --------------------
    // CRM Tables (Phase 1)
    // --------------------

    companies: defineEnt({
      name: v.string(),
      website: v.optional(v.string()),
      industry: v.optional(v.string()),
      size: v.optional(
        v.union(
          v.literal('1-10'),
          v.literal('11-50'),
          v.literal('51-200'),
          v.literal('201-500'),
          v.literal('501-1000'),
          v.literal('1000+')
        )
      ),
      address: v.optional(v.string()),
      country: v.optional(v.string()),
      source: v.optional(
        v.union(
          v.literal('referral'),
          v.literal('website'),
          v.literal('linkedin'),
          v.literal('cold'),
          v.literal('event'),
          v.literal('other')
        )
      ),
      tags: v.optional(v.array(v.string())),
      status: v.optional(
        v.union(
          v.literal('active'),
          v.literal('inactive'),
          v.literal('prospect')
        )
      ),
      notes: v.optional(v.string()),
      archivedAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edges('contacts', { ref: 'companyId' })
      .edges('deals', { ref: 'companyId' })
      // Activities queried via organizationId_entityType_entityId index (polymorphic)
      .index('organizationId_ownerId', ['organizationId', 'ownerId'])
      .index('organizationId_name', ['organizationId', 'name'])
      .searchIndex('search_companies', {
        searchField: 'name',
        filterFields: ['organizationId'],
      }),

    contacts: defineEnt({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      fullName: v.string(),
      jobTitle: v.optional(v.string()),
      phone: v.optional(v.string()),
      lifecycleStage: v.optional(
        v.union(
          v.literal('lead'),
          v.literal('prospect'),
          v.literal('customer'),
          v.literal('churned')
        )
      ),
      tags: v.optional(v.array(v.string())),
      notes: v.optional(v.string()),
      archivedAt: v.optional(v.number()),
    })
      .field('email', v.string(), { index: true })
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edges('deals', { to: 'deals', ref: 'primaryContactId' })
      // Activities queried via organizationId_entityType_entityId index (polymorphic)
      .index('organizationId_email', ['organizationId', 'email'])
      .index('organizationId_companyId', ['organizationId', 'companyId'])
      .index('organizationId_ownerId', ['organizationId', 'ownerId'])
      .searchIndex('search_contacts', {
        searchField: 'fullName',
        filterFields: ['organizationId', 'companyId'],
      }),

    deals: defineEnt({
      title: v.string(),
      value: v.optional(v.number()),
      currency: v.optional(v.string()),
      probability: v.optional(v.number()),
      expectedCloseDate: v.optional(v.number()),
      lostReason: v.optional(v.string()),
      wonAt: v.optional(v.number()),
      lostAt: v.optional(v.number()),
      stageEnteredAt: v.optional(v.number()),
      archivedAt: v.optional(v.number()),
    })
      .field(
        'stage',
        v.union(
          v.literal('new'),
          v.literal('contacted'),
          v.literal('proposal'),
          v.literal('won'),
          v.literal('lost')
        ),
        { index: true }
      )
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .field('primaryContactId', v.optional(v.id('contacts')))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edge('primaryContact', {
        to: 'contacts',
        field: 'primaryContactId',
        optional: true,
      })
      // Activities queried via organizationId_entityType_entityId index (polymorphic)
      .index('organizationId_stage', ['organizationId', 'stage'])
      .index('organizationId_ownerId', ['organizationId', 'ownerId'])
      .index('organizationId_expectedCloseDate', [
        'organizationId',
        'expectedCloseDate',
      ])
      .searchIndex('search_deals', {
        searchField: 'title',
        filterFields: ['organizationId', 'stage'],
      }),

    activities: defineEnt({
      title: v.string(),
      description: v.optional(v.string()),
      dueAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.optional(v.number()),
    })
      .field(
        'type',
        v.union(
          v.literal('call'),
          v.literal('email'),
          v.literal('meeting'),
          v.literal('note'),
          v.literal('status_change')
        ),
        { index: true }
      )
      .field(
        'entityType',
        v.union(
          v.literal('company'),
          v.literal('contact'),
          v.literal('deal')
        ),
        { index: true }
      )
      .field('entityId', v.string(), { index: true })
      .field('organizationId', v.id('organization'), { index: true })
      .field('assigneeId', v.optional(v.id('user')), { index: true })
      .field('createdBy', v.id('user'), { index: true })
      // No edges to user — activities use polymorphic entityType/entityId
      // User's activities queried via index, not edges
      .index('organizationId_entityType_entityId', [
        'organizationId',
        'entityType',
        'entityId',
      ])
      .index('assigneeId_dueAt', ['assigneeId', 'dueAt'])
      .index('organizationId_createdAt', ['organizationId', 'createdAt']),

    auditLogs: defineEnt({
      action: v.string(),
      before: v.optional(v.any()),
      after: v.optional(v.any()),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.optional(v.number()),
    })
      .field(
        'entityType',
        v.union(
          v.literal('company'),
          v.literal('contact'),
          v.literal('deal')
        ),
        { index: true }
      )
      .field('entityId', v.string(), { index: true })
      .field('organizationId', v.id('organization'), { index: true })
      .field('actorUserId', v.id('user'), { index: true })
      .index('organizationId_entityType_entityId', [
        'organizationId',
        'entityType',
        'entityId',
      ])
      .index('organizationId_createdAt', ['organizationId', 'createdAt']),
  },
  {
    schemaValidation: true,
  }
);

export default schema;
export const entDefinitions = getEntDefinitions(schema);
