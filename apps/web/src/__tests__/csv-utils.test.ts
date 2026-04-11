import { describe, it, expect } from 'vitest';
import { autoMapColumns, validateRows, getMappedContact } from '@/components/csv-import/csv-utils';
import { CONTACT_FIELDS } from '@/components/csv-import/import-types';

describe('autoMapColumns', () => {
  it('maps headers that match field keys exactly', () => {
    const headers = ['email', 'firstName', 'lastName', 'phone'];
    const result = autoMapColumns(
      headers,
      CONTACT_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    );
    expect(result.email).toBe('email');
    expect(result.firstName).toBe('firstName');
    expect(result.lastName).toBe('lastName');
    expect(result.phone).toBe('phone');
  });

  it('maps headers case-insensitively', () => {
    const headers = ['Email', 'First Name', 'LASTNAME'];
    const result = autoMapColumns(
      headers,
      CONTACT_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    );
    expect(result.email).toBe('Email');
    expect(result.firstName).toBe('First Name');
    // LASTNAME normalizes to "lastname" which matches "lastName" → "lastname"
    expect(result.lastName).toBe('LASTNAME');
  });

  it('maps using label names', () => {
    const headers = ['First Name', 'Last Name', 'Job Title'];
    const result = autoMapColumns(
      headers,
      CONTACT_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    );
    expect(result.firstName).toBe('First Name');
    expect(result.lastName).toBe('Last Name');
    expect(result.jobTitle).toBe('Job Title');
  });

  it('returns empty map when no headers match', () => {
    const headers = ['foo', 'bar', 'baz'];
    const result = autoMapColumns(
      headers,
      CONTACT_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    );
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('does not partial match', () => {
    const headers = ['telephone', 'emailer'];
    const result = autoMapColumns(
      headers,
      CONTACT_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    );
    expect(result.phone).toBeUndefined();
    expect(result.email).toBeUndefined();
  });
});

describe('validateRows', () => {
  it('marks rows with valid emails as valid', () => {
    const rows = [{ email: 'alice@test.com' }, { email: 'bob@test.com' }];
    const result = validateRows(rows, { email: 'email' });
    expect(result.every((r) => r.status === 'valid')).toBe(true);
  });

  it('marks rows with missing email as invalid', () => {
    const rows = [{ email: '' }, { email: 'bob@test.com' }];
    const result = validateRows(rows, { email: 'email' });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toBe('Missing email');
    expect(result[1].status).toBe('valid');
  });

  it('marks rows with invalid email format as invalid', () => {
    const rows = [{ email: 'not-an-email' }, { email: 'bob@test.com' }];
    const result = validateRows(rows, { email: 'email' });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toBe('Invalid email');
  });

  it('marks all invalid when email column not mapped', () => {
    const rows = [{ name: 'Alice' }];
    const result = validateRows(rows, {});
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toBe('Missing email');
  });

  it('marks invalid lifecycleStage values', () => {
    const rows = [
      { email: 'a@test.com', stage: 'Opportunity' },
      { email: 'b@test.com', stage: 'lead' },
    ];
    const result = validateRows(rows, {
      email: 'email',
      lifecycleStage: 'stage',
    });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toContain('Invalid lifecycle stage');
    expect(result[1].status).toBe('valid');
  });

  it('accepts valid lifecycleStage values', () => {
    for (const stage of ['lead', 'prospect', 'customer', 'churned']) {
      const rows = [{ email: 'a@test.com', stage }];
      const result = validateRows(rows, {
        email: 'email',
        lifecycleStage: 'stage',
      });
      expect(result[0].status).toBe('valid');
    }
  });

  it('accepts case-insensitive lifecycleStage', () => {
    const rows = [{ email: 'a@test.com', stage: 'LEAD' }];
    const result = validateRows(rows, {
      email: 'email',
      lifecycleStage: 'stage',
    });
    expect(result[0].status).toBe('valid');
  });
});

describe('getMappedContact', () => {
  it('maps basic fields', () => {
    const row = {
      email: 'alice@test.com',
      firstName: 'Alice',
      lastName: 'Smith',
    };
    const columnMap = {
      email: 'email',
      firstName: 'firstName',
      lastName: 'lastName',
    };
    const result = getMappedContact(row, columnMap);
    expect(result.email).toBe('alice@test.com');
    expect(result.firstName).toBe('Alice');
    expect(result.lastName).toBe('Smith');
  });

  it('parses tags from comma-separated string', () => {
    const row = { email: 'a@test.com', tags: 'vip, enterprise' };
    const columnMap = { email: 'email', tags: 'tags' };
    const result = getMappedContact(row, columnMap);
    expect(result.tags).toEqual(['vip', 'enterprise']);
  });

  it('trims tags', () => {
    const row = { email: 'a@test.com', tags: '  vip ,  enterprise  ' };
    const columnMap = { email: 'email', tags: 'tags' };
    const result = getMappedContact(row, columnMap);
    expect(result.tags).toEqual(['vip', 'enterprise']);
  });

  it('filters empty tags', () => {
    const row = { email: 'a@test.com', tags: 'vip,,enterprise,' };
    const columnMap = { email: 'email', tags: 'tags' };
    const result = getMappedContact(row, columnMap);
    expect(result.tags).toEqual(['vip', 'enterprise']);
  });

  it('normalizes lifecycleStage to lowercase', () => {
    const row = { email: 'a@test.com', stage: 'LEAD' };
    const columnMap = { email: 'email', lifecycleStage: 'stage' };
    const result = getMappedContact(row, columnMap);
    expect(result.lifecycleStage).toBe('lead');
  });

  it('drops invalid lifecycleStage silently', () => {
    const row = { email: 'a@test.com', stage: 'Opportunity' };
    const columnMap = { email: 'email', lifecycleStage: 'stage' };
    const result = getMappedContact(row, columnMap);
    expect(result.lifecycleStage).toBeUndefined();
  });

  it('truncates notes longer than 5000 chars', () => {
    const longNotes = 'x'.repeat(6000);
    const row = { email: 'a@test.com', notes: longNotes };
    const columnMap = { email: 'email', notes: 'notes' };
    const result = getMappedContact(row, columnMap);
    expect((result.notes as string).length).toBe(5000);
  });

  it('keeps notes under 5000 chars unchanged', () => {
    const shortNotes = 'Just a note';
    const row = { email: 'a@test.com', notes: shortNotes };
    const columnMap = { email: 'email', notes: 'notes' };
    const result = getMappedContact(row, columnMap);
    expect(result.notes).toBe('Just a note');
  });

  it('skips empty values', () => {
    const row = { email: 'a@test.com', firstName: '', phone: '   ' };
    const columnMap = { email: 'email', firstName: 'firstName', phone: 'phone' };
    const result = getMappedContact(row, columnMap);
    expect(result.firstName).toBeUndefined();
    expect(result.phone).toBeUndefined();
  });
});
