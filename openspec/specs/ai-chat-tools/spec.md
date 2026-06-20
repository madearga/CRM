# ai-chat-tools Specification

## Purpose
TBD - created by archiving change ai-chat-assistant. Update Purpose after archive.
## Requirements
### Requirement: Tool definition schema
Each tool SHALL be defined with a name (string), description (natural language for the LLM), and parameters (JSON Schema). Tools SHALL be grouped by category: CRM Core, HR, Commerce, Reports.

#### Scenario: Tool definition format
- **WHEN** tools are registered
- **THEN** each tool SHALL have: `{ name: string, description: string, parameters: { type: "object", properties: {...}, required: [...] } }`

### Requirement: Tool executor
The system SHALL map each tool name to a Convex internal function (query or mutation). The executor SHALL validate parameters against the tool's JSON Schema, inject `organizationId` and `userId` from the authenticated session, and call the corresponding function.

#### Scenario: Query tool execution
- **WHEN** the LLM calls `listEmployees` with `{ status: "active" }`
- **THEN** the executor injects `organizationId`, calls `internal.hrEmployees.list` with merged args, and returns the result as JSON

#### Scenario: Mutation tool execution
- **WHEN** the LLM calls `markAttendance` with `{ employeeId: "abc", status: "alpha" }`
- **THEN** the executor injects `organizationId` and `userId`, calls `internal.hrAttendance.mark`, and returns `{ success: true }` or an error message

#### Scenario: Invalid tool parameters
- **WHEN** the LLM calls a tool with invalid parameters
- **THEN** the executor SHALL return an error message to the LLM describing the validation failure, allowing it to retry

### Requirement: CRM Core tools
The system SHALL provide the following CRM tools: `listCompanies`, `getCompany`, `listContacts`, `getContact`, `listDeals`, `getDeal`, `createActivity`, `updateDealStage`, `searchEntities`.

#### Scenario: Search across entities
- **WHEN** the LLM calls `searchEntities` with `{ query: "budi" }`
- **THEN** the system SHALL search across companies, contacts, deals, and employees matching the query within the organization

### Requirement: HR tools
The system SHALL provide the following HR tools: `listEmployees`, `getAttendance`, `markAttendance`, `listShifts`, `getAttendanceCorrections`, `approveCorrection`, `getHolidays`.

#### Scenario: Attendance query
- **WHEN** the LLM calls `getAttendance` with `{ date: "2026-05-03" }`
- **THEN** the system returns all attendance records for that date in the organization, including employee name, status (present/absent/alpha/late/izin/sakit), check-in/out times

### Requirement: Commerce tools
The system SHALL provide the following Commerce tools: `listInvoices`, `getInvoice`, `listProducts`, `getSaleOrders`, `getRevenueSummary`.

#### Scenario: Revenue summary
- **WHEN** the LLM calls `getRevenueSummary` with `{ period: "month", month: "2026-05" }`
- **THEN** the system returns total revenue, number of invoices, paid vs unpaid counts for that period

### Requirement: Report tools
The system SHALL provide the following Report tools: `getDashboardStats`, `getAttendanceReport`, `getDealPipelineReport`, `getRevenueReport`.

#### Scenario: Deal pipeline report
- **WHEN** the LLM calls `getDealPipelineReport`
- **THEN** the system returns counts and total values per deal stage (new, contacted, proposal, won, lost)

