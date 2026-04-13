import { createAccessControl } from 'better-auth/plugins/access';
import {
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

// Define access control statements for resources
const statement = {
  ...defaultStatements,
  projects: ['create', 'update', 'delete'],
} as const;

export const ac = createAccessControl(statement);

const member = ac.newRole({
  ...memberAc.statements,
  invitation: [],
  projects: ['create', 'update'],
});

const owner = ac.newRole({
  ...ownerAc.statements,
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update', 'delete'],
  projects: ['create', 'update', 'delete'],
});

const admin = ac.newRole({
  ...ownerAc.statements,
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update'],
  ac: ['create', 'read', 'update', 'delete'],
  projects: ['create', 'update', 'delete'],
});

export const roles = { admin, member, owner };
