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
