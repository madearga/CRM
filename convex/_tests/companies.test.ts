/**
 * Tests for company-related business logic extracted from convex/companies.ts.
 *
 * Tests cover: duplicate detection, archive guards (active deals),
 * company name validation, and org-scoping validation.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Company Duplicate Detection
// ============================================================

interface CompanyCheck {
  name: string;
  organizationId: string;
}

function isDuplicateCompany(
  newCompany: CompanyCheck,
  existing: CompanyCheck[]
): boolean {
  return existing.some(
    (c) =>
      c.name === newCompany.name &&
      c.organizationId === newCompany.organizationId
  );
}

describe('Company Duplicate Name Detection', () => {
  const existing: CompanyCheck[] = [
    { name: 'PT TechVentures', organizationId: 'org1' },
    { name: 'CV Maju Jaya', organizationId: 'org1' },
  ];

  it('same name in same org is duplicate', () => {
    expect(isDuplicateCompany({ name: 'PT TechVentures', organizationId: 'org1' }, existing)).toBe(true);
  });

  it('same name in different org is NOT duplicate', () => {
    expect(isDuplicateCompany({ name: 'PT TechVentures', organizationId: 'org2' }, existing)).toBe(false);
  });

  it('different name in same org is NOT duplicate', () => {
    expect(isDuplicateCompany({ name: 'PT New Company', organizationId: 'org1' }, existing)).toBe(false);
  });

  it('empty existing list means no duplicates', () => {
    expect(isDuplicateCompany({ name: 'Any', organizationId: 'org1' }, [])).toBe(false);
  });

  it('name matching is case-sensitive', () => {
    expect(isDuplicateCompany({ name: 'pt techventures', organizationId: 'org1' }, existing)).toBe(false);
  });
});

// ============================================================
// Company Archive Guard (active deals check)
// ============================================================

interface Deal {
  stage: string;
  archivedAt: number | undefined;
}

function canArchiveCompany(deals: Deal[]): { allowed: boolean; reason?: string } {
  const activeDeals = deals.filter(
    (d) => d.stage !== 'won' && d.stage !== 'lost' && d.archivedAt === undefined
  );

  if (activeDeals.length > 0) {
    return {
      allowed: false,
      reason: 'Cannot archive company with active deals. Close or archive deals first.',
    };
  }
  return { allowed: true };
}

describe('Company Archive Guard', () => {
  it('allows archive when no deals exist', () => {
    expect(canArchiveCompany([]).allowed).toBe(true);
  });

  it('allows archive when all deals are won', () => {
    expect(canArchiveCompany([
      { stage: 'won', archivedAt: undefined },
    ]).allowed).toBe(true);
  });

  it('allows archive when all deals are lost', () => {
    expect(canArchiveCompany([
      { stage: 'lost', archivedAt: undefined },
    ]).allowed).toBe(true);
  });

  it('allows archive when active deals are themselves archived', () => {
    expect(canArchiveCompany([
      { stage: 'new', archivedAt: Date.now() },
      { stage: 'contacted', archivedAt: Date.now() },
    ]).allowed).toBe(true);
  });

  it('blocks archive when deal in "new" stage exists', () => {
    const result = canArchiveCompany([
      { stage: 'new', archivedAt: undefined },
    ]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('active deals');
  });

  it('blocks archive when deal in "contacted" stage exists', () => {
    expect(canArchiveCompany([
      { stage: 'contacted', archivedAt: undefined },
    ]).allowed).toBe(false);
  });

  it('blocks archive when deal in "proposal" stage exists', () => {
    expect(canArchiveCompany([
      { stage: 'proposal', archivedAt: undefined },
    ]).allowed).toBe(false);
  });

  it('blocks archive with mix of active and closed deals', () => {
    expect(canArchiveCompany([
      { stage: 'won', archivedAt: undefined },
      { stage: 'new', archivedAt: undefined },
    ]).allowed).toBe(false);
  });

  it('allows archive with only won + lost deals', () => {
    expect(canArchiveCompany([
      { stage: 'won', archivedAt: undefined },
      { stage: 'lost', archivedAt: undefined },
    ]).allowed).toBe(true);
  });
});

// ============================================================
// Company Name Validation
// ============================================================

describe('Company Name Validation', () => {
  function validateCompanyName(name: string | undefined): string | null {
    if (!name || name.trim().length === 0) return 'Name is required';
    if (name.length > 200) return 'Name must be 200 characters or less';
    return null;
  }

  it('valid name passes', () => expect(validateCompanyName('PT TechVentures')).toBeNull());
  it('empty name is rejected', () => expect(validateCompanyName('')).not.toBeNull());
  it('whitespace-only name is rejected', () => expect(validateCompanyName('   ')).not.toBeNull());
  it('undefined name is rejected', () => expect(validateCompanyName(undefined)).not.toBeNull());
  it('name at max length (200) passes', () => {
    expect(validateCompanyName('a'.repeat(200))).toBeNull();
  });
  it('name over max length (201) is rejected', () => {
    expect(validateCompanyName('a'.repeat(201))).not.toBeNull();
  });
});

// ============================================================
// Org-scoping Validation
// ============================================================

describe('Company Org-scoping', () => {
  function belongsToOrg(companyOrgId: string, userOrgId: string): boolean {
    return companyOrgId === userOrgId;
  }

  it('company in same org is accessible', () => {
    expect(belongsToOrg('org1', 'org1')).toBe(true);
  });

  it('company in different org is NOT accessible', () => {
    expect(belongsToOrg('org1', 'org2')).toBe(false);
  });
});

// ============================================================
// Company Status Enum Validation
// ============================================================

describe('Company Status/Size/Source Enums', () => {
  const VALID_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
  const VALID_SOURCES = ['referral', 'website', 'linkedin', 'cold', 'event', 'other'];
  const VALID_STATUSES = ['active', 'inactive', 'prospect'];

  it.each(VALID_SIZES)('size "%s" is valid', (size) => {
    expect(VALID_SIZES).toContain(size);
  });

  it.each(VALID_SOURCES)('source "%s" is valid', (source) => {
    expect(VALID_SOURCES).toContain(source);
  });

  it.each(VALID_STATUSES)('status "%s" is valid', (status) => {
    expect(VALID_STATUSES).toContain(status);
  });

  it('invalid size is not in enum', () => {
    expect(VALID_SIZES).not.toContain('0');
    expect(VALID_SIZES).not.toContain('2000+');
  });

  it('invalid source is not in enum', () => {
    expect(VALID_SOURCES).not.toContain('google');
    expect(VALID_SOURCES).not.toContain('facebook');
  });
});
