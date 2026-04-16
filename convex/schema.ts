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
      .field('permissionTemplateId', v.optional(v.id('permissionTemplates')))
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
      .field('roleTemplateId', v.optional(v.id('permissionTemplates')))
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

    // ------------------------------
    // Permission System
    // ------------------------------
    permissionTemplates: defineEnt({
      isDefault: v.boolean(),
    })
      .field('name', v.string())
      .field('description', v.optional(v.string()))
      .field('color', v.optional(v.string()))
      .field('organizationId', v.id('organization'), { index: true })
      .field('ownerId', v.id('user'))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edges('entries', { to: 'permissionEntries', ref: 'templateId' })
      .index('organizationId_name', ['organizationId', 'name']),

    permissionEntries: defineEnt({
      feature: v.string(),
      action: v.string(),
      allowed: v.boolean(),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('templateId', v.id('permissionTemplates'))
      .edge('template', { to: 'permissionTemplates', field: 'templateId' })
      .index('templateId_feature_action', ['templateId', 'feature', 'action']),

    inviteLinks: defineEnt({
      token: v.string(),
      expiresAt: v.number(),
      maxUses: v.optional(v.number()),
      usedCount: v.number(),
      roleTemplateId: v.id('permissionTemplates'),
      status: v.string(),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('creatorId', v.id('user'))
      .edge('creator', { to: 'user', field: 'creatorId' })
      .index('token', ['token'])
      .index('organizationId_status', ['organizationId', 'status']),

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
      .edges('products', { ref: 'ownerId' })
      .edges('saleOrders', { ref: 'ownerId' })
      .edges('invoices', { ref: 'ownerId' })
      .edges('payments', { ref: 'ownerId' })
      .edges('quotationTemplates', { ref: 'ownerId' })
      .edges('subscriptionTemplates', { ref: 'ownerId' })
      .edges('recurringInvoices', { ref: 'ownerId' })
      .edges('permissionTemplates', { ref: 'ownerId' })
      .edges('inviteLinks', { to: 'inviteLinks', ref: 'creatorId' })
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
      pricelistId: v.optional(v.id('pricelists')),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edges('contacts', { ref: 'companyId' })
      .edges('deals', { ref: 'companyId' })
      .edges('saleOrders', { ref: 'companyId' })
      .edges('invoices', { ref: 'companyId' })
      .edges('payments', { ref: 'companyId' })
      .edges('subscriptionTemplates', { ref: 'companyId' })
      .edges('recurringInvoices', { ref: 'companyId' })
      .edge('pricelist', { to: 'pricelists', field: 'pricelistId', optional: true })
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
      // Denormalized field: updated via trigger when an activity is created/updated
      // for this contact (entityType='contact', entityId=contact._id).
      // Eliminates the N+1 query in contacts.list.
      lastActivityAt: v.optional(v.number()),
      externalId: v.optional(v.string()),
      externalPluginId: v.optional(v.id('externalPlugins')),
    })
      .field('email', v.string(), { index: true })
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edges('deals', { to: 'deals', ref: 'primaryContactId' })
      .edges('saleOrders', { ref: 'contactId' })
      .edges('invoices', { ref: 'contactId' })
      .edges('subscriptionTemplates', { ref: 'contactId' })
      .edges('recurringInvoices', { ref: 'contactId' })
      // Activities queried via organizationId_entityType_entityId index (polymorphic)
      .index('organizationId_email', ['organizationId', 'email'])
      .index('organizationId_companyId', ['organizationId', 'companyId'])
      .index('organizationId_ownerId', ['organizationId', 'ownerId'])
      .index('organizationId_externalId', ['organizationId', 'externalId'])
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
      convertedToSaleOrderId: v.optional(v.id('saleOrders')),
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
      .edges('saleOrders', { ref: 'dealId' })
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
      // Scheduling fields
      scheduledAt: v.optional(v.number()),
      status: v.optional(v.union(
        v.literal('planned'),
        v.literal('done'),
        v.literal('cancelled'),
      )),
      nextActivityType: v.optional(v.string()),
      priority: v.optional(v.union(
        v.literal('low'),
        v.literal('medium'),
        v.literal('high'),
      )),
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
          v.literal('deal'),
          // ERM modules
          v.literal('product'),
          v.literal('saleOrder'),
          v.literal('invoice'),
          v.literal('purchaseOrder'),
          v.literal('ticket'),
          v.literal('expense'),
          v.literal('employee'),
          v.literal('task'),
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
      .index('organizationId_createdAt', ['organizationId', 'createdAt'])
      .index('organizationId_status_scheduledAt', ['organizationId', 'status', 'scheduledAt']),

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
          v.literal('deal'),
          // ERM modules
          v.literal('product'),
          v.literal('saleOrder'),
          v.literal('invoice'),
          v.literal('purchaseOrder'),
          v.literal('ticket'),
          v.literal('expense'),
          v.literal('employee'),
          v.literal('task'),
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

    // --------------------
    // Sequence Counter (shared)
    // --------------------

    sequences: defineEnt({
      prefix: v.string(),
      year: v.number(),
      counter: v.number(),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .index('organizationId_prefix_year', [
        'organizationId',
        'prefix',
        'year',
      ]),

    // --------------------
    // Product Catalog (Module 1)
    // --------------------

    productCategories: defineEnt({
      name: v.string(),
      description: v.optional(v.string()),
      active: v.optional(v.boolean()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('parentId', v.optional(v.id('productCategories')))
      .edges('products', { ref: 'category' })
      .index('organizationId_parentId', ['organizationId', 'parentId'])
      .searchIndex('search_product_categories', {
        searchField: 'name',
        filterFields: ['organizationId'],
      }),

    products: defineEnt({
      name: v.string(),
      description: v.optional(v.string()),
      type: v.union(
        v.literal('storable'),
        v.literal('consumable'),
        v.literal('service')
      ),
      category: v.optional(v.id('productCategories')),
      imageUrl: v.optional(v.string()),
      cost: v.optional(v.number()),
      price: v.optional(v.number()),
      unit: v.optional(v.string()),
      sku: v.optional(v.string()),
      barcode: v.optional(v.string()),
      weight: v.optional(v.number()),
      active: v.optional(v.boolean()),
      tags: v.optional(v.array(v.string())),
      notes: v.optional(v.string()),
      archivedAt: v.optional(v.number()),
      // Commerce portal fields
      visibleInShop: v.optional(v.boolean()),
      slug: v.optional(v.string()),
      stock: v.optional(v.number()),
      images: v.optional(v.array(v.string())),
      externalId: v.optional(v.string()),
      externalPluginId: v.optional(v.id('externalPlugins')),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edges('variants', { to: 'productVariants', ref: 'productId' })
      .edges('saleOrderLines', { ref: 'productId' })
      .edges('invoiceLines', { ref: 'productId' })
      .edges('recurringInvoiceLines', { ref: 'productId' })
      .edges('priceRules', { ref: 'productId' })
      .edges('cartItems', { ref: 'productId' })
      .edges('shopOrderItems', { ref: 'productId' })

      .index('organizationId_name', ['organizationId', 'name'])
      .index('organizationId_category', ['organizationId', 'category'])
      .edge('categoryRef', { to: 'productCategories', field: 'category', optional: true })
      .index('organizationId_type', ['organizationId', 'type'])
      .index('organizationId_slug', ['organizationId', 'slug'])
      .index('organizationId_visibleInShop', ['organizationId', 'visibleInShop'])
      .index('organizationId_externalId', ['organizationId', 'externalId'])
      .searchIndex('search_products', {
        searchField: 'name',
        filterFields: ['organizationId', 'type', 'category'],
      }),

    productVariants: defineEnt({
      name: v.string(),
      attributes: v.optional(v.record(v.string(), v.string())),
      priceExtra: v.optional(v.number()),
      costExtra: v.optional(v.number()),
      sku: v.optional(v.string()),
      barcode: v.optional(v.string()),
      weight: v.optional(v.number()),
      active: v.optional(v.boolean()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('productId', v.id('products'))
      .edge('product', { to: 'products', field: 'productId' })
      .edges('saleOrderLines', { ref: 'productVariantId' })
      .edges('shopOrderItems', { ref: 'variantId' })
      .index('organizationId_productId', ['organizationId', 'productId'])
      .searchIndex('search_product_variants', {
        searchField: 'name',
        filterFields: ['organizationId', 'productId'],
      }),

    // ---------------------
    // Sales Order (Module 2)
    // ---------------------

    saleOrders: defineEnt({
      number: v.string(),
      state: v.union(
        v.literal('draft'),
        v.literal('sent'),
        v.literal('confirmed'),
        v.literal('invoiced'),
        v.literal('delivered'),
        v.literal('done'),
        v.literal('cancel'),
      ),
      orderDate: v.number(),
      validUntil: v.optional(v.number()),
      subtotal: v.number(),
      discountAmount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      totalAmount: v.number(),
      currency: v.optional(v.string()),
      deliveryDate: v.optional(v.number()),
      deliveryAddress: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      customerNotes: v.optional(v.string()),
      terms: v.optional(v.string()),
      source: v.optional(v.union(v.literal('deal'), v.literal('manual'))),
      externalId: v.optional(v.string()),
      externalPluginId: v.optional(v.id('externalPlugins')),
      invoiceStatus: v.optional(v.union(
        v.literal('to_invoice'),
        v.literal('partially'),
        v.literal('invoiced'),
      )),
      deliveryStatus: v.optional(v.union(
        v.literal('to_deliver'),
        v.literal('partially'),
        v.literal('delivered'),
      )),
      archivedAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .field('contactId', v.optional(v.id('contacts')))
      .field('dealId', v.optional(v.id('deals')))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edge('contact', { to: 'contacts', field: 'contactId', optional: true })
      .edge('deal', { to: 'deals', field: 'dealId', optional: true })
      .edges('lines', { to: 'saleOrderLines', ref: 'saleOrderId' })
      .edges('invoices', { to: 'invoices', ref: 'saleOrderId' })
      .index('organizationId_state', ['organizationId', 'state'])
      .index('organizationId_companyId', ['organizationId', 'companyId'])
      .index('organizationId_orderDate', ['organizationId', 'orderDate'])
      .index('organizationId_ownerId', ['organizationId', 'ownerId'])
      .index('organizationId_archivedAt', ['organizationId', 'archivedAt'])
      .index('organizationId_externalId', ['organizationId', 'externalId'])
      .searchIndex('search_sale_orders', {
        searchField: 'number',
        filterFields: ['organizationId', 'state'],
      }),

    saleOrderLines: defineEnt({
      productName: v.string(),
      description: v.optional(v.string()),
      quantity: v.number(),
      unitPrice: v.number(),
      discount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      subtotal: v.number(),
      deliveredQty: v.optional(v.number()),
      invoicedQty: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('saleOrderId', v.id('saleOrders'))
      .field('productId', v.optional(v.id('products')))
      .field('productVariantId', v.optional(v.id('productVariants')))
      .edge('saleOrder', { to: 'saleOrders', field: 'saleOrderId' })
      .edge('product', { to: 'products', field: 'productId', optional: true })
      .edge('productVariant', { to: 'productVariants', field: 'productVariantId', optional: true })
      .index('organizationId_saleOrderId', ['organizationId', 'saleOrderId']),

    // ---------------------
    // Invoicing & Billing (Module 3)
    // ---------------------

    paymentTerms: defineEnt({
      name: v.string(),
      description: v.optional(v.string()),
      dueDays: v.number(),
      discountDays: v.optional(v.number()),
      discountPercent: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true }),

    taxes: defineEnt({
      name: v.string(),
      rate: v.number(),
      type: v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      ),
      scope: v.union(
        v.literal('sales'),
        v.literal('purchase'),
        v.literal('both'),
      ),
      active: v.optional(v.boolean()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .edges('invoiceLines', { ref: 'taxId' })
      .index('organizationId_scope', ['organizationId', 'scope']),

    invoices: defineEnt({
      number: v.string(),
      type: v.union(
        v.literal('customer_invoice'),
        v.literal('vendor_bill'),
        v.literal('credit_note'),
      ),
      state: v.union(
        v.literal('draft'),
        v.literal('posted'),
        v.literal('paid'),
        v.literal('cancel'),
      ),
      invoiceDate: v.number(),
      dueDate: v.number(),
      subtotal: v.number(),
      discountAmount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      totalAmount: v.number(),
      amountDue: v.number(),
      currency: v.optional(v.string()),
      paymentStatus: v.optional(v.union(
        v.literal('unpaid'),
        v.literal('partially_paid'),
        v.literal('paid'),
      )),
      paymentTermId: v.optional(v.id('paymentTerms')),
      source: v.optional(v.union(
        v.literal('sale_order'),
        v.literal('manual'),
      )),
      saleOrderId: v.optional(v.id('saleOrders')),
      notes: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      subscriptionTemplateId: v.optional(v.id('subscriptionTemplates')),
      recurringInvoiceId: v.optional(v.id('recurringInvoices')),
      archivedAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .field('contactId', v.optional(v.id('contacts')))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edge('contact', { to: 'contacts', field: 'contactId', optional: true })
      .edge('saleOrder', { to: 'saleOrders', field: 'saleOrderId', optional: true })
      .edge('subscription', { to: 'subscriptionTemplates', field: 'subscriptionTemplateId', optional: true })
      .edges('lines', { to: 'invoiceLines', ref: 'invoiceId' })
      .edge('recurringInvoice', { to: 'recurringInvoices', field: 'recurringInvoiceId', optional: true })
      .edges('payments', { to: 'payments', ref: 'invoiceId' })
      .index('organizationId_state', ['organizationId', 'state'])
      .index('organizationId_type', ['organizationId', 'type'])
      .index('organizationId_companyId', ['organizationId', 'companyId'])
      .index('organizationId_invoiceDate', ['organizationId', 'invoiceDate'])
      .index('organizationId_dueDate', ['organizationId', 'dueDate'])
      .searchIndex('search_invoices', {
        searchField: 'number',
        filterFields: ['organizationId', 'state', 'type'],
      }),

    invoiceLines: defineEnt({
      productName: v.string(),
      description: v.optional(v.string()),
      quantity: v.number(),
      unitPrice: v.number(),
      discount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      subtotal: v.number(),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('invoiceId', v.id('invoices'))
      .field('productId', v.optional(v.id('products')))
      .field('taxId', v.optional(v.id('taxes')))
      .edge('invoice', { to: 'invoices', field: 'invoiceId' })
      .edge('product', { to: 'products', field: 'productId', optional: true })
      .edge('tax', { to: 'taxes', field: 'taxId', optional: true })
      .index('organizationId_invoiceId', ['organizationId', 'invoiceId']),

    recurringInvoices: defineEnt({
      number: v.string(),
      name: v.optional(v.string()),
      status: v.union(
        v.literal('active'),
        v.literal('paused'),
        v.literal('expired'),
      ),
      frequency: v.union(
        v.literal('weekly'),
        v.literal('monthly'),
        v.literal('quarterly'),
        v.literal('yearly'),
      ),
      nextInvoiceDate: v.number(),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      maxOccurrences: v.optional(v.number()),
      occurredCount: v.number(),
      type: v.literal('customer_invoice'),
      subtotal: v.number(),
      discountAmount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
      taxAmount: v.optional(v.number()),
      totalAmount: v.number(),
      currency: v.optional(v.string()),
      notes: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      paymentTermId: v.optional(v.id('paymentTerms')),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('companyId', v.optional(v.id('companies')))
      .field('contactId', v.optional(v.id('contacts')))
      .field('ownerId', v.id('user'))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edge('contact', { to: 'contacts', field: 'contactId', optional: true })
      .edges('lines', { to: 'recurringInvoiceLines', ref: 'recurringInvoiceId' })
      .edges('generatedInvoices', { to: 'invoices', ref: 'recurringInvoiceId' })
      .index('organizationId_status', ['organizationId', 'status'])
      .index('organizationId_nextInvoiceDate', ['organizationId', 'nextInvoiceDate'])
      .index('nextInvoiceDate', ['nextInvoiceDate']),

    recurringInvoiceLines: defineEnt({
      productName: v.string(),
      description: v.optional(v.string()),
      quantity: v.number(),
      unitPrice: v.number(),
      discount: v.optional(v.number()),
      discountType: v.optional(v.union(
        v.literal('percentage'),
        v.literal('fixed'),
      )),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('recurringInvoiceId', v.id('recurringInvoices'))
      .field('productId', v.optional(v.id('products')))
      .edge('recurringInvoice', { to: 'recurringInvoices', field: 'recurringInvoiceId' })
      .edge('product', { to: 'products', field: 'productId', optional: true }),

    // ---------------------
    // Quotation Templates (Module 4)
    // ---------------------

    quotationTemplates: defineEnt({
      name: v.string(),
      description: v.optional(v.string()),
      discountAmount: v.optional(v.number()),
      discountType: v.optional(v.union(v.literal('percentage'), v.literal('fixed'))),
      internalNotes: v.optional(v.string()),
      customerNotes: v.optional(v.string()),
      terms: v.optional(v.string()),
      currency: v.optional(v.string()),
      validForDays: v.optional(v.number()),
      isDefault: v.optional(v.boolean()),
      archivedAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('ownerId', v.id('user'))
      .edge('owner', { to: 'user', field: 'ownerId' })

      .edges('lines', { to: 'quotationTemplateLines', ref: 'templateId' })
      .index('organizationId_name', ['organizationId', 'name'])
      .searchIndex('search_templates', { searchField: 'name', filterFields: ['organizationId'] }),

    quotationTemplateLines: defineEnt({
      productName: v.string(),
      description: v.optional(v.string()),
      quantity: v.number(),
      unitPrice: v.number(),
      discount: v.optional(v.number()),
      discountType: v.optional(v.union(v.literal('percentage'), v.literal('fixed'))),
      taxAmount: v.optional(v.number()),
      subtotal: v.number(),
      productId: v.optional(v.id('products')),
      taxId: v.optional(v.id('taxes')),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('templateId', v.id('quotationTemplates'))
      .edge('template', { to: 'quotationTemplates', field: 'templateId' })
      .index('organizationId_templateId', ['organizationId', 'templateId']),

    // Invoice Reminders (Module 5)
    // ---------------------

    reminderRules: defineEnt({
      name: v.string(),
      daysOverdue: v.number(),
      subject: v.string(),
      body: v.string(),
      includeInvoicePdf: v.optional(v.boolean()),
      isActive: v.optional(v.boolean()),
    })
      .field('organizationId', v.id('organization'), { index: true }),

    invoiceReminders: defineEnt({
      sentAt: v.number(),
      status: v.union(
        v.literal('pending'),
        v.literal('sent'),
        v.literal('failed'),
      ),
    })
      .field('invoiceId', v.id('invoices'), { index: true })
      .field('reminderRuleId', v.id('reminderRules'), { index: true })
      .field('organizationId', v.id('organization'), { index: true })
      .index('organizationId_invoiceId', ['organizationId', 'invoiceId']),

    // ---------------------
    // Pricelists & Pricing Rules (Module 6)
    // ---------------------

    pricelists: defineEnt({
      name: v.string(),
      description: v.optional(v.string()),
      type: v.union(
        v.literal('fixed'),
        v.literal('percentage_discount'),
        v.literal('formula'),
      ),
      defaultDiscount: v.optional(v.number()),
      currency: v.optional(v.string()),
      priority: v.optional(v.number()),
      isActive: v.optional(v.boolean()),
      archivedAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .edges('rules', { to: 'priceRules', ref: 'pricelistId' })
      .edges('applicableCompanies', { to: 'companies', ref: 'pricelistId' })
      .index('organizationId_active', ['organizationId', 'isActive'])
      .searchIndex('search_pricelists', {
        searchField: 'name',
        filterFields: ['organizationId'],
      }),

    priceRules: defineEnt({
      productId: v.optional(v.id('products')),
      productCategoryId: v.optional(v.id('productCategories')),
      minQuantity: v.optional(v.number()),
      fixedPrice: v.optional(v.number()),
      discountPercent: v.optional(v.number()),
      formula: v.optional(v.string()),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('pricelistId', v.id('pricelists'))
      .edge('pricelist', { to: 'pricelists', field: 'pricelistId' })
      .edge('product', { to: 'products', field: 'productId', optional: true })
      .index('organizationId_pricelistId', ['organizationId', 'pricelistId']),

    // Subscription Templates (Module 7)
    // ---------------------

    subscriptionTemplates: defineEnt({
      name: v.string(),
      description: v.optional(v.string()),
      interval: v.union(
        v.literal('weekly'),
        v.literal('monthly'),
        v.literal('quarterly'),
        v.literal('yearly'),
      ),
      intervalCount: v.optional(v.number()),
      billingDay: v.number(),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      autoGenerateInvoice: v.optional(v.boolean()),
      autoPostInvoice: v.optional(v.boolean()),
      numberOfInvoices: v.optional(v.number()),
      generatedCount: v.optional(v.number()),
      nextBillingDate: v.optional(v.number()),
      currency: v.optional(v.string()),
      notes: v.optional(v.string()),
      discountAmount: v.optional(v.number()),
      discountType: v.optional(v.union(v.literal('percentage'), v.literal('fixed'))),
      paymentTermId: v.optional(v.id('paymentTerms')),
      state: v.optional(v.union(
        v.literal('active'),
        v.literal('paused'),
        v.literal('expired'),
        v.literal('cancelled'),
      )),
      archivedAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('ownerId', v.id('user'))
      .field('companyId', v.optional(v.id('companies')))
      .field('contactId', v.optional(v.id('contacts')))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .edge('contact', { to: 'contacts', field: 'contactId', optional: true })
      .edges('lines', { to: 'subscriptionLines', ref: 'subscriptionTemplateId' })
      .edges('generatedInvoices', { to: 'invoices', ref: 'subscriptionTemplateId' })
      .index('organizationId_state', ['organizationId', 'state'])
      .index('organizationId_nextBillingDate', ['organizationId', 'nextBillingDate'])
      .searchIndex('search_subscriptions', {
        searchField: 'name',
        filterFields: ['organizationId'],
      }),

    subscriptionLines: defineEnt({
      productName: v.string(),
      description: v.optional(v.string()),
      quantity: v.number(),
      unitPrice: v.number(),
      discount: v.optional(v.number()),
      discountType: v.optional(v.union(v.literal('percentage'), v.literal('fixed'))),
      taxAmount: v.optional(v.number()),
      subtotal: v.number(),
      productId: v.optional(v.id('products')),
      taxId: v.optional(v.id('taxes')),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('subscriptionTemplateId', v.id('subscriptionTemplates'))
      .edge('subscription', { to: 'subscriptionTemplates', field: 'subscriptionTemplateId' })
      .index('organizationId_subscriptionTemplateId', ['organizationId', 'subscriptionTemplateId']),

    payments: defineEnt({
      amount: v.number(),
      paymentDate: v.number(),
      method: v.union(
        v.literal('bank_transfer'),
        v.literal('cash'),
        v.literal('credit_card'),
        v.literal('debit_card'),
        v.literal('e_wallet'),
        v.literal('cheque'),
        v.literal('other'),
      ),
      reference: v.optional(v.string()),
      memo: v.optional(v.string()),
      state: v.union(
        v.literal('draft'),
        v.literal('confirmed'),
        v.literal('cancelled'),
      ),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('invoiceId', v.optional(v.id('invoices')))
      .field('companyId', v.optional(v.id('companies')))
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edge('invoice', { to: 'invoices', field: 'invoiceId', optional: true })
      .edge('company', { to: 'companies', field: 'companyId', optional: true })
      .index('organizationId_paymentDate', ['organizationId', 'paymentDate'])
      .index('organizationId_invoiceId', ['organizationId', 'invoiceId']),

    // ============================================================
    // COMMERCE / CUSTOMER PORTAL ENTITIES
    // ============================================================

    // Customers — portal buyers, separate from CRM contacts
    customers: defineEnt({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.union(v.string(), v.null())),
      address: v.optional(v.union(v.string(), v.null())),
      city: v.optional(v.union(v.string(), v.null())),
      postalCode: v.optional(v.union(v.string(), v.null())),
      avatarUrl: v.optional(v.union(v.string(), v.null())),
      socialProvider: v.optional(v.union(v.string(), v.null())),
      socialId: v.optional(v.union(v.string(), v.null())),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('userId', v.optional(v.id('user')))
      .field('contactId', v.optional(v.id('contacts')))
      .index('organizationId_email', ['organizationId', 'email'])
      .index('organizationId_userId', ['organizationId', 'userId'])
      .index('organizationId_socialProvider', ['organizationId', 'socialProvider', 'socialId']),

    // Shopping carts
    carts: defineEnt({
      status: v.union(v.literal('active'), v.literal('converted'), v.literal('abandoned')),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('customerId', v.id('customers'), { index: true })
      .field('sessionId', v.optional(v.union(v.string(), v.null())))
      .index('organizationId_customerId_status', ['organizationId', 'customerId', 'status'])
      .index('sessionId', ['sessionId'])
      .edges('cart', { to: 'cartItems', ref: 'cartId' }),

    // Cart line items
    cartItems: defineEnt({
      quantity: v.number(),
    })
      .field('cartId', v.id('carts'))
      .field('productId', v.id('products'))
      .field('variantId', v.optional(v.id('productVariants')))
      .field('unitPrice', v.number())
      .field('organizationId', v.id('organization'), { index: true })
      .edge('product', { to: 'products', field: 'productId' })
      .edge('cart', { to: 'carts', field: 'cartId' }),

    // Shop orders — separate from CRM saleOrders
    shopOrders: defineEnt({
      orderNumber: v.string(),
      status: v.union(
        v.literal('pending_payment'),
        v.literal('paid'),
        v.literal('processing'),
        v.literal('shipped'),
        v.literal('delivered'),
        v.literal('cancelled'),
        v.literal('expired'),
      ),
      paymentStatus: v.union(
        v.literal('pending'),
        v.literal('paid'),
        v.literal('failed'),
        v.literal('expired'),
        v.literal('refunded'),
      ),
      subtotal: v.number(),
      shippingCost: v.optional(v.number()),
      discountAmount: v.optional(v.number()),
      totalAmount: v.number(),
      currency: v.string(),
      notes: v.optional(v.union(v.string(), v.null())),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('customerId', v.id('customers'), { index: true })
      .field('saleOrderId', v.optional(v.id('saleOrders')))
      .field('sourceStoreId', v.optional(v.id('connectedStores')))
      .field('paymentProvider', v.optional(v.string()))
      .field('paymentRef', v.optional(v.string()))
      .field('paymentData', v.optional(v.record(v.string(), v.any())))
      .field('shippingAddress', v.optional(v.object({
        recipientName: v.string(),
        phone: v.string(),
        address: v.string(),
        city: v.string(),
        postalCode: v.string(),
      })))
      .field('orderTimeline', v.optional(v.array(v.object({
        status: v.string(),
        timestamp: v.number(),
        note: v.optional(v.string()),
      }))))
      .index('organizationId_status', ['organizationId', 'status'])
      .index('organizationId_orderNumber', ['organizationId', 'orderNumber'])
      .index('orderNumber', ['orderNumber'])
      .index('organizationId_customerId', ['organizationId', 'customerId'])
      .edges('items', { to: 'shopOrderItems', ref: 'shopOrderId' }),

    // Shop order line items
    shopOrderItems: defineEnt({
      productName: v.string(),
      productPrice: v.number(),
      quantity: v.number(),
      subtotal: v.number(),
    })
      .field('shopOrderId', v.id('shopOrders'))
      .field('productId', v.id('products'))
      .field('variantId', v.optional(v.id('productVariants')))
      .field('organizationId', v.id('organization'), { index: true })
      .edge('product', { to: 'products', field: 'productId' })
      .edge('variant', { to: 'productVariants', field: 'variantId', optional: true })
      .edge('shopOrder', { to: 'shopOrders', field: 'shopOrderId' }),

    // Atomic order number counter per org per day
    orderCounters: defineEnt({
      counter: v.number(),
      date: v.string(),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .index('organizationId_date', ['organizationId', 'date']),

    // Connected stores (Phase 2 — defined now, used later)
    connectedStores: defineEnt({
      name: v.string(),
      url: v.string(),
      apiKey: v.string(),
      apiKeyPrefix: v.string(),
      webhookUrl: v.optional(v.union(v.string(), v.null())),
      webhookSecret: v.optional(v.union(v.string(), v.null())),
      status: v.union(v.literal('active'), v.literal('suspended'), v.literal('disconnected')),
      lastSyncAt: v.optional(v.number()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .index('organizationId_status', ['organizationId', 'status'])
      .index('apiKey', ['apiKey']),

    // Payment provider configs per org
    paymentProviders: defineEnt({
      provider: v.string(),
      isActive: v.boolean(),
      config: v.record(v.string(), v.string()),
      sandboxMode: v.optional(v.boolean()),
    })
      .field('organizationId', v.id('organization'), { index: true })
      .index('organizationId_provider', ['organizationId', 'provider']),

    // Plugin instances — enable/disable plugins per org
    pluginInstances: defineEnt({
      pluginId: v.string(),                    // 'ecommerce', 'booking', 'pos'
      isActive: v.boolean(),                   // aktif atau tidak
      settings: v.optional(v.any()),           // plugin-specific settings JSON
      publicSlug: v.optional(v.string()),      // 'tokobudi' → /shop/tokobudi
    })
      .field('organizationId', v.id('organization'), { index: true })
      .index('organizationId_pluginId', ['organizationId', 'pluginId'])
      .index('publicSlug', ['publicSlug']),

    // External plugins — third-party stores connected to CRM
    externalPlugins: defineEnt({
      name: v.string(),                         // display name
      url: v.string(),                          // e.g. https://myshop.vercel.app
      apiKey: v.string(),                       // generated API key for auth
      status: v.union(v.literal('connected'), v.literal('disconnected'), v.literal('error')),
      lastSyncAt: v.optional(v.number()),       // timestamp of last successful sync
      lastError: v.optional(v.string()),        // last error message
      manifest: v.optional(v.any()),            // cached plugin manifest
    })
      .field('organizationId', v.id('organization'), { index: true })
      .field('pluginInstanceId', v.id('pluginInstances'), { index: true })
      .index('organizationId_status', ['organizationId', 'status'])
      .index('url', ['url']),

    // Sync log — history of data synchronization
    pluginSyncLog: defineEnt({
      direction: v.union(v.literal('pull'), v.literal('push')),
      table: v.string(),                       // 'products' | 'orders' | 'customers'
      status: v.union(v.literal('success'), v.literal('partial'), v.literal('failed')),
      recordCount: v.number(),
      errorMessage: v.optional(v.string()),
      durationMs: v.optional(v.number()),
    })
      .field('externalPluginId', v.id('externalPlugins'), { index: true })
      .field('organizationId', v.id('organization'), { index: true })
      .index('externalPluginId_organizationId', ['externalPluginId', 'organizationId'])
      .index('organizationId_externalPluginId', ['organizationId', 'externalPluginId']),
  },
  {
    schemaValidation: true,
  }
);

export default schema;
export const entDefinitions = getEntDefinitions(schema);
