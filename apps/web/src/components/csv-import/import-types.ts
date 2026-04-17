/** Contact fields available for CSV column mapping */
export type ContactField =
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'jobTitle'
  | 'phone'
  | 'lifecycleStage'
  | 'tags'
  | 'notes'
  | 'companyName';

/** Company fields available for CSV column mapping */
export type CompanyField =
  | 'name'
  | 'website'
  | 'industry'
  | 'size'
  | 'address'
  | 'country'
  | 'source'
  | 'tags'
  | 'status'
  | 'notes';

export type EntityField = ContactField | CompanyField;

export interface FieldDef<T extends string> {
  key: T;
  label: string;
  required: boolean;
}

export const CONTACT_FIELDS: FieldDef<ContactField>[] = [
  { key: 'email', label: 'Email', required: true },
  { key: 'firstName', label: 'First Name', required: false },
  { key: 'lastName', label: 'Last Name', required: false },
  { key: 'jobTitle', label: 'Job Title', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'lifecycleStage', label: 'Lifecycle Stage', required: false },
  { key: 'tags', label: 'Tags (comma-separated)', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'companyName', label: 'Company Name', required: false },
];

export const COMPANY_FIELDS: FieldDef<CompanyField>[] = [
  { key: 'name', label: 'Company Name', required: true },
  { key: 'website', label: 'Website', required: false },
  { key: 'industry', label: 'Industry', required: false },
  { key: 'size', label: 'Size', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'country', label: 'Country', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'tags', label: 'Tags (comma-separated)', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

/** Maps an entity field key to a CSV header name */
export type ColumnMap<T extends string = string> = Partial<Record<T, string>>;

/** A single parsed CSV row as key-value pairs */
export type ParsedRow = Record<string, string>;

/** A row that has been validated against the column map */
export interface ValidatedRow {
  rowIndex: number;
  data: ParsedRow;
  status: 'valid' | 'invalid';
  reason?: string;
}

/** Result of the full import operation */
export interface ImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; identifier: string; reason: string }>;
}
