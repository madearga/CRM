/**
 * Tests for the organization access rules.
 *
 * The rules split the CRM business features from the organizational actions.
 * A feature action that the permission system does not define is never
 * granted.
 */
import { describe, expect, it } from 'vitest';

import {
  canAssignRole,
  canInviteRole,
  isCrmFeature,
  isCrmFeatureAction,
  isOrganizationalResource,
  roleAllows,
} from '../orgAccess';

describe('isCrmFeature', () => {
  it('accepts the features of the permission system', () => {
    expect(isCrmFeature('contacts')).toBe(true);
    expect(isCrmFeature('deals')).toBe(true);
    expect(isCrmFeature('team')).toBe(true);
  });

  it('rejects the organizational resources', () => {
    expect(isCrmFeature('organization')).toBe(false);
    expect(isCrmFeature('member')).toBe(false);
    expect(isCrmFeature('invitation')).toBe(false);
  });
});

describe('isOrganizationalResource', () => {
  it('accepts the resources of the access control definition', () => {
    expect(isOrganizationalResource('organization')).toBe(true);
    expect(isOrganizationalResource('member')).toBe(true);
    expect(isOrganizationalResource('invitation')).toBe(true);
  });

  it('rejects an unknown resource', () => {
    expect(isOrganizationalResource('contacts')).toBe(false);
    expect(isOrganizationalResource('unknown')).toBe(false);
  });
});

describe('isCrmFeatureAction', () => {
  it('accepts a defined action', () => {
    expect(isCrmFeatureAction('contacts', 'view')).toBe(true);
    expect(isCrmFeatureAction('contacts', 'delete')).toBe(true);
    expect(isCrmFeatureAction('team', 'invite')).toBe(true);
  });

  it('rejects an action that the feature does not define', () => {
    expect(isCrmFeatureAction('contacts', 'invite')).toBe(false);
    expect(isCrmFeatureAction('dashboard', 'delete')).toBe(false);
  });

  it('rejects an unknown feature', () => {
    expect(isCrmFeatureAction('unknown', 'view')).toBe(false);
  });
});

describe('canAssignRole', () => {
  it('allows an owner to give the owner role', () => {
    expect(
      canAssignRole({
        currentRole: 'owner',
        destinationRole: 'owner',
        sourceRole: 'member',
      }).allowed
    ).toBe(true);
  });

  it('denies an admin that promotes a member to owner', () => {
    const decision = canAssignRole({
      currentRole: 'admin',
      destinationRole: 'owner',
      sourceRole: 'member',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Only an owner can change the owner role');
  });

  it('denies an admin that promotes itself to owner', () => {
    expect(
      canAssignRole({
        currentRole: 'admin',
        destinationRole: 'owner',
        sourceRole: 'admin',
      }).allowed
    ).toBe(false);
  });

  it('denies an admin that demotes an owner', () => {
    expect(
      canAssignRole({
        currentRole: 'admin',
        destinationRole: 'member',
        sourceRole: 'owner',
      }).allowed
    ).toBe(false);
  });

  it('allows an admin that changes a member role', () => {
    expect(
      canAssignRole({
        currentRole: 'admin',
        destinationRole: 'member',
        sourceRole: 'member',
      }).allowed
    ).toBe(true);
  });

  it('denies a member that changes a role', () => {
    expect(
      canAssignRole({
        currentRole: 'member',
        destinationRole: 'member',
        sourceRole: 'member',
      }).allowed
    ).toBe(true);
    expect(
      canAssignRole({
        currentRole: 'member',
        destinationRole: 'owner',
        sourceRole: 'member',
      }).allowed
    ).toBe(false);
  });
});

describe('canInviteRole', () => {
  it('allows an owner to invite an owner', () => {
    expect(
      canInviteRole({ currentRole: 'owner', invitedRole: 'owner' }).allowed
    ).toBe(true);
  });

  it('denies an admin that invites an owner', () => {
    const decision = canInviteRole({
      currentRole: 'admin',
      invitedRole: 'owner',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Only an owner can invite an owner');
  });

  it('allows an admin that invites a member', () => {
    expect(
      canInviteRole({ currentRole: 'admin', invitedRole: 'member' }).allowed
    ).toBe(true);
  });
});

describe('roleAllows', () => {
  it('allows the owner to manage the organization', () => {
    expect(roleAllows('owner', 'organization', ['update'])).toBe(true);
    expect(roleAllows('owner', 'organization', ['delete'])).toBe(true);
    expect(roleAllows('owner', 'member', ['delete'])).toBe(true);
    expect(roleAllows('owner', 'invitation', ['create'])).toBe(true);
  });

  it('allows the admin to manage members but not to delete the organization', () => {
    expect(roleAllows('admin', 'member', ['update'])).toBe(true);
    expect(roleAllows('admin', 'invitation', ['cancel'])).toBe(true);
    expect(roleAllows('admin', 'organization', ['update'])).toBe(true);
    expect(roleAllows('admin', 'organization', ['delete'])).toBe(false);
  });

  it('denies the member for organizational actions', () => {
    expect(roleAllows('member', 'organization', ['update'])).toBe(false);
    expect(roleAllows('member', 'member', ['delete'])).toBe(false);
    expect(roleAllows('member', 'invitation', ['create'])).toBe(false);
  });

  it('denies an unknown role', () => {
    expect(roleAllows('superuser', 'organization', ['update'])).toBe(false);
  });
});
