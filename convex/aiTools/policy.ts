// The legacy assistant is read-only until its writes use the approval ledger.
// A closed allowlist also prevents a newly added tool from gaining write access.
const LEGACY_READ_TOOLS = new Set([
  'listCompanies',
  'getCompany',
  'listContacts',
  'getContact',
  'listDeals',
  'getDeal',
  'searchEntities',
  'listEmployees',
  'getAttendance',
  'listShifts',
  'getAttendanceCorrections',
  'getHolidays',
  'listInvoices',
  'getInvoice',
  'listProducts',
  'getSaleOrders',
  'getRevenueSummary',
  'getDashboardStats',
  'getAttendanceReport',
  'getDealPipelineReport',
  'getRevenueReport',
]);

export function isLegacyReadTool(name: string): boolean {
  return LEGACY_READ_TOOLS.has(name);
}
