import { Triggers } from 'convex-helpers/server/triggers';

import type { DataModel } from './_generated/dataModel';
import {
  aggregateUsers,
  aggregateDealsByOrg,
  aggregateDealsByStage,
  aggregateActivitiesByOrg,
  aggregateCompaniesByOrg,
} from './aggregates';

export const triggers = new Triggers<DataModel>();

// User count
triggers.register('user', aggregateUsers.trigger());

// CRM aggregates
triggers.register('deals', aggregateDealsByOrg.trigger());
triggers.register('deals', aggregateDealsByStage.trigger());
triggers.register('activities', aggregateActivitiesByOrg.trigger());
triggers.register('companies', aggregateCompaniesByOrg.trigger());

// Denormalize lastActivityAt onto contacts when an activity is created.
// This eliminates the N+1 query in contacts.list (Issue 2A).
triggers.register('activities', async (ctx, change) => {
  if (change.operation !== 'insert') return;

  const { entityType, entityId } = change.newDoc;
  if (entityType !== 'contact') return;

  // entityId is a string-encoded contact ID — patch the denormalized field
  try {
    await ctx.db.patch(entityId as any, {
      lastActivityAt: Date.now(),
    });
  } catch (err) {
    console.warn('[trigger:activities] Failed to update lastActivityAt for contact:', entityId, err);
  }
});
