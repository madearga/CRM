import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// Type for our tool definitions compatible with OpenAI function calling
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// --------------- CRM CORE ---------------

export const crmCoreTools: ToolDefinition[] = [
  {
    name: 'listCompanies',
    description: 'List companies in the organization. Supports filtering by status, industry, and search term.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive', 'prospect'], description: 'Filter by company status' },
        industry: { type: 'string', description: 'Filter by industry' },
        search: { type: 'string', description: 'Search companies by name' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'getCompany',
    description: 'Get detailed information about a specific company by ID.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Company ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'listContacts',
    description: 'List contacts in the organization. Supports filtering by company, lifecycle stage, and search.',
    parameters: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'Filter by company ID' },
        lifecycleStage: { type: 'string', enum: ['lead', 'prospect', 'customer', 'churned'], description: 'Filter by lifecycle stage' },
        search: { type: 'string', description: 'Search contacts by name or email' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'getContact',
    description: 'Get detailed information about a specific contact by ID.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contact ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'listDeals',
    description: 'List deals in the organization. Supports filtering by stage, owner, and date range.',
    parameters: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: ['new', 'contacted', 'proposal', 'won', 'lost'], description: 'Filter by deal stage' },
        ownerId: { type: 'string', description: 'Filter by deal owner user ID' },
        search: { type: 'string', description: 'Search deals by title' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'getDeal',
    description: 'Get detailed information about a specific deal by ID.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'createActivity',
    description: 'Create a new activity (call, email, meeting, note) linked to a company, contact, or deal.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['call', 'email', 'meeting', 'note'], description: 'Activity type' },
        entityType: { type: 'string', enum: ['company', 'contact', 'deal'], description: 'Parent entity type' },
        entityId: { type: 'string', description: 'Parent entity ID' },
        title: { type: 'string', description: 'Activity title' },
        description: { type: 'string', description: 'Activity description' },
        dueAt: { type: 'number', description: 'Due date as Unix timestamp (ms)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' },
      },
      required: ['type', 'entityType', 'entityId', 'title'],
    },
  },
  {
    name: 'updateDealStage',
    description: 'Update the stage of a deal.',
    parameters: {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'Deal ID' },
        stage: { type: 'string', enum: ['new', 'contacted', 'proposal', 'won', 'lost'], description: 'New stage' },
        lostReason: { type: 'string', description: 'Required if stage is "lost"' },
      },
      required: ['dealId', 'stage'],
    },
  },
  {
    name: 'searchEntities',
    description: 'Search across companies, contacts, deals, and employees by keyword.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results per entity type (default 10)' },
      },
      required: ['query'],
    },
  },
];

// --------------- HR ---------------

export const hrTools: ToolDefinition[] = [
  {
    name: 'listEmployees',
    description: 'List employees in the organization. Supports filtering by branch, department, status, and search.',
    parameters: {
      type: 'object',
      properties: {
        branchId: { type: 'string', description: 'Filter by branch ID' },
        department: { type: 'string', description: 'Filter by department' },
        status: { type: 'string', enum: ['active', 'inactive', 'resigned'], description: 'Filter by employment status' },
        search: { type: 'string', description: 'Search by name or NIK' },
        limit: { type: 'number', description: 'Max results (default 100)' },
      },
    },
  },
  {
    name: 'getAttendance',
    description: 'Get attendance records for a specific date or date range.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        startDate: { type: 'string', description: 'Start date for range (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date for range (YYYY-MM-DD)' },
        branchId: { type: 'string', description: 'Filter by branch' },
        status: { type: 'string', enum: ['present', 'absent', 'alpha', 'late', 'izin', 'sakit', 'cuti'], description: 'Filter by attendance status' },
      },
    },
  },
  {
    name: 'markAttendance',
    description: 'Create attendance correction requests for employees. Use this to request status changes (alpha, izin, sakit, cuti) for one or more employees.',
    parameters: {
      type: 'object',
      properties: {
        employeeIds: { type: 'array', items: { type: 'string' }, description: 'Employee IDs to create corrections for' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        status: { type: 'string', enum: ['alpha', 'izin', 'sakit', 'cuti'], description: 'Requested attendance status' },
        reason: { type: 'string', description: 'Reason for the correction' },
      },
      required: ['employeeIds', 'date', 'status'],
    },
  },
  {
    name: 'listShifts',
    description: 'List shift schedules. Supports filtering by branch and date.',
    parameters: {
      type: 'object',
      properties: {
        branchId: { type: 'string', description: 'Filter by branch' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
    },
  },
  {
    name: 'getAttendanceCorrections',
    description: 'List attendance correction requests. Supports filtering by status.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'approved', 'rejected'], description: 'Filter by correction status' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'approveCorrection',
    description: 'Approve or reject an attendance correction request.',
    parameters: {
      type: 'object',
      properties: {
        correctionId: { type: 'string', description: 'Correction request ID' },
        action: { type: 'string', enum: ['approve', 'reject'], description: 'Approve or reject' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['correctionId', 'action'],
    },
  },
  {
    name: 'getHolidays',
    description: 'List holidays for a given month or year.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Month in YYYY-MM format' },
        year: { type: 'number', description: 'Year (e.g. 2026)' },
      },
    },
  },
];

// --------------- COMMERCE ---------------

export const commerceTools: ToolDefinition[] = [
  {
    name: 'listInvoices',
    description: 'List invoices. Supports filtering by status, company, and date range.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], description: 'Filter by invoice status' },
        companyId: { type: 'string', description: 'Filter by company' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'getInvoice',
    description: 'Get detailed information about a specific invoice.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'listProducts',
    description: 'List products. Supports filtering by category and search.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search by product name or SKU' },
        categoryId: { type: 'string', description: 'Filter by category' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'getSaleOrders',
    description: 'List sale orders. Supports filtering by status and company.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by order status' },
        companyId: { type: 'string', description: 'Filter by company' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'getRevenueSummary',
    description: 'Get revenue summary for a period (month, quarter, or year).',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['month', 'quarter', 'year'], description: 'Aggregation period' },
        date: { type: 'string', description: 'Reference date (YYYY-MM-DD or YYYY-MM). Defaults to current month.' },
      },
    },
  },
];

// --------------- REPORTS ---------------

export const reportTools: ToolDefinition[] = [
  {
    name: 'getDashboardStats',
    description: 'Get CRM dashboard statistics: total companies, contacts, deals by stage, revenue summary.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getAttendanceReport',
    description: 'Generate attendance report for a period. Returns summary with counts per status.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        branchId: { type: 'string', description: 'Filter by branch' },
        department: { type: 'string', description: 'Filter by department' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'getDealPipelineReport',
    description: 'Get deal pipeline report: counts and total values per stage.',
    parameters: {
      type: 'object',
      properties: {
        ownerId: { type: 'string', description: 'Filter by deal owner' },
      },
    },
  },
  {
    name: 'getRevenueReport',
    description: 'Get revenue report: total invoiced, paid, outstanding amounts.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['startDate', 'endDate'],
    },
  },
];

// All tools combined
export const allToolDefinitions: ToolDefinition[] = [
  ...crmCoreTools,
  ...hrTools,
  ...commerceTools,
  ...reportTools,
];

// Convert to OpenAI ChatCompletionTool format
export function toOpenAITools(): ChatCompletionTool[] {
  return allToolDefinitions.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
