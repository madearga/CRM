import { anyApi } from 'convex/server';
import { components } from './_generated/api';
import { defineAggregate } from '@convex-dev/aggregate';

export const aggregateUsers = defineAggregate(components, {
  api: anyApi,
  name: 'aggregateUsers',
  aggregateOptions: { kind: 'count' },
});

export const aggregateDealsByOrg = defineAggregate(components, {
  api: anyApi,
  name: 'aggregateDealsByOrg',
  aggregateOptions: { kind: 'count' },
  group: { groupField: 'organizationId' },
});

export const aggregateDealsByStage = defineAggregate(components, {
  api: anyApi,
  name: 'aggregateDealsByStage',
  aggregateOptions: { kind: 'count' },
  group: { groupField: 'stage' },
});

export const aggregateActivitiesByOrg = defineAggregate(components, {
  api: anyApi,
  name: 'aggregateActivitiesByOrg',
  aggregateOptions: { kind: 'count' },
  group: { groupField: 'organizationId' },
});

export const aggregateCompaniesByOrg = defineAggregate(components, {
  api: anyApi,
  name: 'aggregateCompaniesByOrg',
  aggregateOptions: { kind: 'count' },
  group: { groupField: 'organizationId' },
});
