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
      .edges('saleOrders', { to: 'saleOrders', ref: 'ownerId' })
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
    })
      .field('organizationId', v.id('organization'), { index: true })
      .edge('owner', { to: 'user', field: 'ownerId' })
      .edges('variants', { to: 'productVariants', ref: 'productId' })
      .edges('saleOrderLines', { ref: 'productId' })
      .edges('invoiceLines', { ref: 'productId' })
      .edges('priceRules', { ref: 'productId' })

      .index('organizationId_name', ['organizationId', 'name'])
      .index('organizationId_category', ['organizationId', 'category'])
      .edge('categoryRef', { to: 'productCategories', field: 'category', optional: true })
      .index('organizationId_type', ['organizationId', 'type'])
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
  },
  {
    schemaValidation: true,
  }
);

export default schema;
export const entDefinitions = getEntDefinitions(schema);
