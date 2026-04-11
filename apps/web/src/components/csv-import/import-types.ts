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

export interface ContactFieldDef {
  key: ContactField;
  label: string;
  required: boolean;
}

export const CONTACT_FIELDS: ContactFieldDef[] = [
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

/** Maps a contact field key to a CSV header name */
export type ColumnMap = Partial<Record<ContactField, string>>;

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
  errors: Array<{ row: number; email: string; reason: string }>;
}
