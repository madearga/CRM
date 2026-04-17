import { describe, it, expect } from 'vitest';
import { autoMapColumns, validateRows, getMappedEntity } from '@/components/csv-import/csv-utils';
import { CONTACT_FIELDS, COMPANY_FIELDS } from '@/components/csv-import/import-types';

describe('autoMapColumns', () => {
  it('maps headers that match field keys exactly', () => {
    const headers = ['email', 'firstName', 'lastName', 'phone'];
    const result = autoMapColumns(headers, CONTACT_FIELDS);
    expect(result.email).toBe('email');
    expect(result.firstName).toBe('firstName');
    expect(result.lastName).toBe('lastName');
    expect(result.phone).toBe('phone');
  });

  it('maps headers case-insensitively', () => {
    const headers = ['Email', 'First Name', 'LASTNAME'];
    const result = autoMapColumns(headers, CONTACT_FIELDS);
    expect(result.email).toBe('Email');
    expect(result.firstName).toBe('First Name');
    // LASTNAME normalizes to "lastname" which matches "lastName" → "lastname"
    expect(result.lastName).toBe('LASTNAME');
  });

  it('maps using label names', () => {
    const headers = ['First Name', 'Last Name', 'Job Title'];
    const result = autoMapColumns(headers, CONTACT_FIELDS);
    expect(result.firstName).toBe('First Name');
    expect(result.lastName).toBe('Last Name');
    expect(result.jobTitle).toBe('Job Title');
  });

  it('returns empty map when no headers match', () => {
    const headers = ['foo', 'bar', 'baz'];
    const result = autoMapColumns(headers, CONTACT_FIELDS);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('does not partial match', () => {
    const headers = ['telephone', 'emailer'];
    const result = autoMapColumns(headers, CONTACT_FIELDS);
    expect(result.phone).toBeUndefined();
    expect(result.email).toBeUndefined();
  });

  it('maps company fields', () => {
    const headers = ['name', 'website', 'industry', 'country'];
    const result = autoMapColumns(headers, COMPANY_FIELDS);
    expect(result.name).toBe('name');
    expect(result.website).toBe('website');
    expect(result.industry).toBe('industry');
    expect(result.country).toBe('country');
  });
});

describe('validateRows (contacts)', () => {
  it('marks rows with valid emails as valid', () => {
    const rows = [{ email: 'alice@test.com' }, { email: 'bob@test.com' }];
    const result = validateRows(rows, { email: 'email' }, {
      requiredField: 'email',
      emailField: 'email',
    });
    expect(result.every((r) => r.status === 'valid')).toBe(true);
  });

  it('marks rows with missing email as invalid', () => {
    const rows = [{ email: '' }, { email: 'bob@test.com' }];
    const result = validateRows(rows, { email: 'email' }, {
      requiredField: 'email',
      emailField: 'email',
    });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toBe('Missing required field: email');
    expect(result[1].status).toBe('valid');
  });

  it('marks rows with invalid email format as invalid', () => {
    const rows = [{ email: 'not-an-email' }, { email: 'bob@test.com' }];
    const result = validateRows(rows, { email: 'email' }, {
      requiredField: 'email',
      emailField: 'email',
    });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toBe('Invalid email');
  });

  it('marks all invalid when email column not mapped', () => {
    const rows = [{ name: 'Alice' }];
    const result = validateRows(rows, {}, {
      requiredField: 'email',
      emailField: 'email',
    });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toBe('Missing required field: email');
  });

  it('marks invalid lifecycleStage values', () => {
    const rows = [
      { email: 'a@test.com', stage: 'Opportunity' },
      { email: 'b@test.com', stage: 'lead' },
    ];
    const result = validateRows(rows, {
      email: 'email',
      lifecycleStage: 'stage',
    }, {
      requiredField: 'email',
      emailField: 'email',
      lifecycleField: 'lifecycleStage',
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
      }, {
        requiredField: 'email',
        emailField: 'email',
        lifecycleField: 'lifecycleStage',
      });
      expect(result[0].status).toBe('valid');
    }
  });

  it('accepts case-insensitive lifecycleStage', () => {
    const rows = [{ email: 'a@test.com', stage: 'LEAD' }];
    const result = validateRows(rows, {
      email: 'email',
      lifecycleStage: 'stage',
    }, {
      requiredField: 'email',
      emailField: 'email',
      lifecycleField: 'lifecycleStage',
    });
    expect(result[0].status).toBe('valid');
  });
});

describe('validateRows (companies)', () => {
  it('marks rows with valid names as valid', () => {
    const rows = [{ name: 'Acme Corp' }, { name: 'Globex' }];
    const result = validateRows(rows, { name: 'name' }, {
      requiredField: 'name',
    });
    expect(result.every((r) => r.status === 'valid')).toBe(true);
  });

  it('marks rows with missing name as invalid', () => {
    const rows = [{ name: '' }];
    const result = validateRows(rows, { name: 'name' }, {
      requiredField: 'name',
    });
    expect(result[0].status).toBe('invalid');
  });

  it('marks invalid company status', () => {
    const rows = [{ name: 'Acme', status: 'unknown' }];
    const result = validateRows(rows, { name: 'name', status: 'status' }, {
      requiredField: 'name',
      companyStatusField: 'status',
    });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toContain('Invalid status');
  });

  it('accepts valid company statuses', () => {
    for (const status of ['active', 'inactive', 'prospect']) {
      const rows = [{ name: 'Acme', status }];
      const result = validateRows(rows, { name: 'name', status: 'status' }, {
        requiredField: 'name',
        companyStatusField: 'status',
      });
      expect(result[0].status).toBe('valid');
    }
  });

  it('marks invalid company size', () => {
    const rows = [{ name: 'Acme', size: '999' }];
    const result = validateRows(rows, { name: 'name', size: 'size' }, {
      requiredField: 'name',
      companySizeField: 'size',
    });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toContain('Invalid size');
  });

  it('marks invalid company source', () => {
    const rows = [{ name: 'Acme', source: 'tiktok' }];
    const result = validateRows(rows, { name: 'name', source: 'source' }, {
      requiredField: 'name',
      companySourceField: 'source',
    });
    expect(result[0].status).toBe('invalid');
    expect(result[0].reason).toContain('Invalid source');
  });

  it('accepts valid company sizes', () => {
    for (const size of ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']) {
      const rows = [{ name: 'Acme', size }];
      const result = validateRows(rows, { name: 'name', size: 'size' }, {
        requiredField: 'name',
        companySizeField: 'size',
      });
      expect(result[0].status).toBe('valid');
    }
  });

  it('accepts valid company sources', () => {
    for (const source of ['referral', 'website', 'linkedin', 'cold', 'event', 'other']) {
      const rows = [{ name: 'Acme', source }];
      const result = validateRows(rows, { name: 'name', source: 'source' }, {
        requiredField: 'name',
        companySourceField: 'source',
      });
      expect(result[0].status).toBe('valid');
    }
  });

  it('validates company with all valid fields combined', () => {
    const rows = [{ name: 'Acme Corp', status: 'active', size: '51-200', source: 'referral' }];
    const result = validateRows(rows, { name: 'name', status: 'status', size: 'size', source: 'source' }, {
      requiredField: 'name',
      companyStatusField: 'status',
      companySizeField: 'size',
      companySourceField: 'source',
    });
    expect(result[0].status).toBe('valid');
  });
});

describe('getMappedEntity', () => {
  it('maps basic contact fields', () => {
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
    const result = getMappedEntity(row, columnMap);
    expect(result.email).toBe('alice@test.com');
    expect(result.firstName).toBe('Alice');
    expect(result.lastName).toBe('Smith');
  });

  it('parses tags from comma-separated string', () => {
    const row = { email: 'a@test.com', tags: 'vip, enterprise' };
    const columnMap = { email: 'email', tags: 'tags' };
    const result = getMappedEntity(row, columnMap);
    expect(result.tags).toEqual(['vip', 'enterprise']);
  });

  it('trims tags', () => {
    const row = { email: 'a@test.com', tags: '  vip ,  enterprise  ' };
    const columnMap = { email: 'email', tags: 'tags' };
    const result = getMappedEntity(row, columnMap);
    expect(result.tags).toEqual(['vip', 'enterprise']);
  });

  it('filters empty tags', () => {
    const row = { email: 'a@test.com', tags: 'vip,,enterprise,' };
    const columnMap = { email: 'email', tags: 'tags' };
    const result = getMappedEntity(row, columnMap);
    expect(result.tags).toEqual(['vip', 'enterprise']);
  });

  it('normalizes lifecycleStage to lowercase', () => {
    const row = { email: 'a@test.com', stage: 'LEAD' };
    const columnMap = { email: 'email', lifecycleStage: 'stage' };
    const result = getMappedEntity(row, columnMap);
    expect(result.lifecycleStage).toBe('lead');
  });

  it('drops invalid lifecycleStage silently', () => {
    const row = { email: 'a@test.com', stage: 'Opportunity' };
    const columnMap = { email: 'email', lifecycleStage: 'stage' };
    const result = getMappedEntity(row, columnMap);
    expect(result.lifecycleStage).toBeUndefined();
  });

  it('normalizes company status to lowercase', () => {
    const row = { name: 'Acme', status: 'ACTIVE' };
    const columnMap = { name: 'name', status: 'status' };
    const result = getMappedEntity(row, columnMap);
    expect(result.status).toBe('active');
  });

  it('normalizes company source to lowercase', () => {
    const row = { name: 'Acme', source: 'LinkedIn' };
    const columnMap = { name: 'name', source: 'source' };
    const result = getMappedEntity(row, columnMap);
    expect(result.source).toBe('linkedin');
  });

  it('truncates notes longer than 5000 chars', () => {
    const longNotes = 'x'.repeat(6000);
    const row = { email: 'a@test.com', notes: longNotes };
    const columnMap = { email: 'email', notes: 'notes' };
    const result = getMappedEntity(row, columnMap);
    expect((result.notes as string).length).toBe(5000);
  });

  it('keeps notes under 5000 chars unchanged', () => {
    const shortNotes = 'Just a note';
    const row = { email: 'a@test.com', notes: shortNotes };
    const columnMap = { email: 'email', notes: 'notes' };
    const result = getMappedEntity(row, columnMap);
    expect(result.notes).toBe('Just a note');
  });

  it('skips empty values', () => {
    const row = { email: 'a@test.com', firstName: '', phone: '   ' };
    const columnMap = { email: 'email', firstName: 'firstName', phone: 'phone' };
    const result = getMappedEntity(row, columnMap);
    expect(result.firstName).toBeUndefined();
    expect(result.phone).toBeUndefined();
  });
});
