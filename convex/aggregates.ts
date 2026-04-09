import { TableAggregate } from '@convex-dev/aggregate';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';

// User count (global)
export const aggregateUsers = new TableAggregate<{
  Key: null;
  DataModel: DataModel;
  TableName: 'user';
}>(components.aggregateUsers, {
  sortKey: () => null,
});

// Deals count per organization (namespace = organizationId)
export const aggregateDealsByOrg = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: 'deals';
  Namespace: string;
}>(components.aggregateDealsByOrg, {
  namespace: (d) => d.organizationId,
  sortKey: (d) => d._creationTime,
  sumValue: (d) => d.value ?? 0,
});

// Deals count per stage (namespace = organizationId, key = stage)
export const aggregateDealsByStage = new TableAggregate<{
  Key: string;
  DataModel: DataModel;
  TableName: 'deals';
  Namespace: string;
}>(components.aggregateDealsByStage, {
  namespace: (d) => d.organizationId,
  sortKey: (d) => d.stage,
  sumValue: (d) => d.value ?? 0,
});

// Activities count per organization
export const aggregateActivitiesByOrg = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: 'activities';
  Namespace: string;
}>(components.aggregateActivitiesByOrg, {
  namespace: (d) => d.organizationId,
  sortKey: (d) => d._creationTime,
});

// Companies count per organization
export const aggregateCompaniesByOrg = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: 'companies';
  Namespace: string;
}>(components.aggregateCompaniesByOrg, {
  namespace: (d) => d.organizationId,
  sortKey: (d) => d._creationTime,
});
