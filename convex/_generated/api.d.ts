/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as admin from "../admin.js";
import type * as agentBridgeNonces from "../agentBridgeNonces.js";
import type * as agentOperationHandlers from "../agentOperationHandlers.js";
import type * as agentOperations from "../agentOperations.js";
import type * as agentTurns from "../agentTurns.js";
import type * as agents from "../agents.js";
import type * as aggregates from "../aggregates.js";
import type * as aiChat from "../aiChat.js";
import type * as aiChatHistory from "../aiChatHistory.js";
import type * as aiSystemPrompt from "../aiSystemPrompt.js";
import type * as aiToolInternals from "../aiToolInternals.js";
import type * as aiTools_definitions from "../aiTools/definitions.js";
import type * as aiTools_executor from "../aiTools/executor.js";
import type * as aiTools_index from "../aiTools/index.js";
import type * as aiTools_policy from "../aiTools/policy.js";
import type * as analytics from "../analytics.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as authPermissions from "../authPermissions.js";
import type * as authSchema from "../authSchema.js";
import type * as commerce_cart from "../commerce/cart.js";
import type * as commerce_checkout from "../commerce/checkout.js";
import type * as commerce_customers from "../commerce/customers.js";
import type * as commerce_helpers from "../commerce/helpers.js";
import type * as commerce_orders from "../commerce/orders.js";
import type * as commerce_payments_index from "../commerce/payments/index.js";
import type * as commerce_payments_interface from "../commerce/payments/interface.js";
import type * as commerce_payments_midtrans from "../commerce/payments/midtrans.js";
import type * as commerce_products from "../commerce/products.js";
import type * as commerce_shopSettings from "../commerce/shopSettings.js";
import type * as companies from "../companies.js";
import type * as contacts from "../contacts.js";
import type * as createTestSession from "../createTestSession.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deals from "../deals.js";
import type * as debug from "../debug.js";
import type * as emails from "../emails.js";
import type * as emails_organizationInvite from "../emails/organizationInvite.js";
import type * as emails_weeklyPipelineDigest from "../emails/weeklyPipelineDigest.js";
import type * as externalPlugins from "../externalPlugins.js";
import type * as functions from "../functions.js";
import type * as helpers_agentBridge from "../helpers/agentBridge.js";
import type * as helpers_callbackUrl from "../helpers/callbackUrl.js";
import type * as helpers_dashboardMetrics from "../helpers/dashboardMetrics.js";
import type * as helpers_getEnv from "../helpers/getEnv.js";
import type * as helpers_premiumGuard from "../helpers/premiumGuard.js";
import type * as helpers_rateLimiter from "../helpers/rateLimiter.js";
import type * as helpers_roleGuard from "../helpers/roleGuard.js";
import type * as helpers_validateExternalUrl from "../helpers/validateExternalUrl.js";
import type * as helpers_validateWebhook from "../helpers/validateWebhook.js";
import type * as hrAttendance from "../hrAttendance.js";
import type * as hrBranches from "../hrBranches.js";
import type * as hrCorrections from "../hrCorrections.js";
import type * as hrEmployees from "../hrEmployees.js";
import type * as hrHolidays from "../hrHolidays.js";
import type * as hrReports from "../hrReports.js";
import type * as hrShiftAssignments from "../hrShiftAssignments.js";
import type * as hrShifts from "../hrShifts.js";
import type * as hrTypes from "../hrTypes.js";
import type * as hrUtils from "../hrUtils.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as inviteLinks from "../inviteLinks.js";
import type * as invoiceReminders from "../invoiceReminders.js";
import type * as invoices from "../invoices.js";
import type * as migrations_activateAllPlugins from "../migrations/activateAllPlugins.js";
import type * as migrations_seedPluginInstances from "../migrations/seedPluginInstances.js";
import type * as migrations_teamPermissions from "../migrations/teamPermissions.js";
import type * as onboarding from "../onboarding.js";
import type * as orgAccess from "../orgAccess.js";
import type * as organization from "../organization.js";
import type * as organizationHelpers from "../organizationHelpers.js";
import type * as paymentTerms from "../paymentTerms.js";
import type * as payments from "../payments.js";
import type * as permissionHelpers from "../permissionHelpers.js";
import type * as permissionQueries from "../permissionQueries.js";
import type * as permissionTemplates from "../permissionTemplates.js";
import type * as plugins from "../plugins.js";
import type * as pricelists from "../pricelists.js";
import type * as productCategories from "../productCategories.js";
import type * as productVariants from "../productVariants.js";
import type * as products from "../products.js";
import type * as quotationTemplates from "../quotationTemplates.js";
import type * as recurringInvoices from "../recurringInvoices.js";
import type * as reset from "../reset.js";
import type * as roomAccess from "../roomAccess.js";
import type * as rooms from "../rooms.js";
import type * as saleOrders from "../saleOrders.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as shared_money from "../shared/money.js";
import type * as shared_sequenceGenerator from "../shared/sequenceGenerator.js";
import type * as shared_types from "../shared/types.js";
import type * as shared_workflowEngine from "../shared/workflowEngine.js";
import type * as subscriptions from "../subscriptions.js";
import type * as taxes from "../taxes.js";
import type * as triggers from "../triggers.js";
import type * as user from "../user.js";
import type * as userShared from "../userShared.js";
import type * as webmcp from "../webmcp.js";
import type * as weeklyDigest from "../weeklyDigest.js";
import type * as weeklyDigestQueries from "../weeklyDigestQueries.js";
import type * as widgets from "../widgets.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  admin: typeof admin;
  agentBridgeNonces: typeof agentBridgeNonces;
  agentOperationHandlers: typeof agentOperationHandlers;
  agentOperations: typeof agentOperations;
  agentTurns: typeof agentTurns;
  agents: typeof agents;
  aggregates: typeof aggregates;
  aiChat: typeof aiChat;
  aiChatHistory: typeof aiChatHistory;
  aiSystemPrompt: typeof aiSystemPrompt;
  aiToolInternals: typeof aiToolInternals;
  "aiTools/definitions": typeof aiTools_definitions;
  "aiTools/executor": typeof aiTools_executor;
  "aiTools/index": typeof aiTools_index;
  "aiTools/policy": typeof aiTools_policy;
  analytics: typeof analytics;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  authPermissions: typeof authPermissions;
  authSchema: typeof authSchema;
  "commerce/cart": typeof commerce_cart;
  "commerce/checkout": typeof commerce_checkout;
  "commerce/customers": typeof commerce_customers;
  "commerce/helpers": typeof commerce_helpers;
  "commerce/orders": typeof commerce_orders;
  "commerce/payments/index": typeof commerce_payments_index;
  "commerce/payments/interface": typeof commerce_payments_interface;
  "commerce/payments/midtrans": typeof commerce_payments_midtrans;
  "commerce/products": typeof commerce_products;
  "commerce/shopSettings": typeof commerce_shopSettings;
  companies: typeof companies;
  contacts: typeof contacts;
  createTestSession: typeof createTestSession;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deals: typeof deals;
  debug: typeof debug;
  emails: typeof emails;
  "emails/organizationInvite": typeof emails_organizationInvite;
  "emails/weeklyPipelineDigest": typeof emails_weeklyPipelineDigest;
  externalPlugins: typeof externalPlugins;
  functions: typeof functions;
  "helpers/agentBridge": typeof helpers_agentBridge;
  "helpers/callbackUrl": typeof helpers_callbackUrl;
  "helpers/dashboardMetrics": typeof helpers_dashboardMetrics;
  "helpers/getEnv": typeof helpers_getEnv;
  "helpers/premiumGuard": typeof helpers_premiumGuard;
  "helpers/rateLimiter": typeof helpers_rateLimiter;
  "helpers/roleGuard": typeof helpers_roleGuard;
  "helpers/validateExternalUrl": typeof helpers_validateExternalUrl;
  "helpers/validateWebhook": typeof helpers_validateWebhook;
  hrAttendance: typeof hrAttendance;
  hrBranches: typeof hrBranches;
  hrCorrections: typeof hrCorrections;
  hrEmployees: typeof hrEmployees;
  hrHolidays: typeof hrHolidays;
  hrReports: typeof hrReports;
  hrShiftAssignments: typeof hrShiftAssignments;
  hrShifts: typeof hrShifts;
  hrTypes: typeof hrTypes;
  hrUtils: typeof hrUtils;
  http: typeof http;
  init: typeof init;
  inviteLinks: typeof inviteLinks;
  invoiceReminders: typeof invoiceReminders;
  invoices: typeof invoices;
  "migrations/activateAllPlugins": typeof migrations_activateAllPlugins;
  "migrations/seedPluginInstances": typeof migrations_seedPluginInstances;
  "migrations/teamPermissions": typeof migrations_teamPermissions;
  onboarding: typeof onboarding;
  orgAccess: typeof orgAccess;
  organization: typeof organization;
  organizationHelpers: typeof organizationHelpers;
  paymentTerms: typeof paymentTerms;
  payments: typeof payments;
  permissionHelpers: typeof permissionHelpers;
  permissionQueries: typeof permissionQueries;
  permissionTemplates: typeof permissionTemplates;
  plugins: typeof plugins;
  pricelists: typeof pricelists;
  productCategories: typeof productCategories;
  productVariants: typeof productVariants;
  products: typeof products;
  quotationTemplates: typeof quotationTemplates;
  recurringInvoices: typeof recurringInvoices;
  reset: typeof reset;
  roomAccess: typeof roomAccess;
  rooms: typeof rooms;
  saleOrders: typeof saleOrders;
  search: typeof search;
  seed: typeof seed;
  "shared/money": typeof shared_money;
  "shared/sequenceGenerator": typeof shared_sequenceGenerator;
  "shared/types": typeof shared_types;
  "shared/workflowEngine": typeof shared_workflowEngine;
  subscriptions: typeof subscriptions;
  taxes: typeof taxes;
  triggers: typeof triggers;
  user: typeof user;
  userShared: typeof userShared;
  webmcp: typeof webmcp;
  weeklyDigest: typeof weeklyDigest;
  weeklyDigestQueries: typeof weeklyDigestQueries;
  widgets: typeof widgets;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  aggregateUsers: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregateUsers">;
  aggregateDealsByOrg: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregateDealsByOrg">;
  aggregateDealsByStage: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregateDealsByStage">;
  aggregateActivitiesByOrg: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregateActivitiesByOrg">;
  aggregateCompaniesByOrg: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregateCompaniesByOrg">;
};
