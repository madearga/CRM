import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import { api, internal } from '../_generated/api';

interface ToolExecutionContext {
  ctx: ActionCtx;
  orgId: Id<'organization'>;
  userId: Id<'user'>;
}

/**
 * Execute a tool by name with the given arguments.
 * Returns a JSON-serializable result.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  execCtx: ToolExecutionContext
): Promise<unknown> {
  const { ctx, orgId } = execCtx;

  try {
    switch (toolName) {
      // ---- CRM Core ----
      case 'listCompanies':
        return await ctx.runQuery(api.companies.list, {
          search: args.search as string | undefined,
          includeArchived: false,
          paginationOpts: { numItems: (args.limit as number) ?? 50, cursor: null },
        });

      case 'getCompany':
        return await ctx.runQuery(api.companies.getById, {
          id: args.id as Id<'companies'>,
        });

      case 'listContacts':
        return await ctx.runQuery(api.contacts.list, {
          companyId: args.companyId as Id<'companies'> | undefined,
          search: args.search as string | undefined,
          paginationOpts: { numItems: (args.limit as number) ?? 50, cursor: null },
        });

      case 'getContact':
        return await ctx.runQuery(api.contacts.getById, {
          id: args.id as Id<'contacts'>,
        });

      case 'listDeals':
        return await ctx.runQuery(api.deals.list, {
          stage: args.stage as any,
          paginationOpts: { numItems: (args.limit as number) ?? 50, cursor: null },
        });

      case 'getDeal':
        return await ctx.runQuery(api.deals.getById, {
          id: args.id as Id<'deals'>,
        });

      case 'createActivity':
        return await ctx.runMutation(api.activities.create, {
          type: args.type as any,
          entityType: args.entityType as any,
          entityId: args.entityId as string,
          title: args.title as string,
          description: args.description as string | undefined,
          dueAt: args.dueAt as number | undefined,
        });

      case 'updateDealStage':
        return await ctx.runMutation(api.deals.updateStage, {
          id: args.dealId as Id<'deals'>,
          stage: args.stage as any,
          lostReason: args.lostReason as string | undefined,
        });

      case 'searchEntities': {
        const query = args.query as string;
        const limit = (args.limit as number) ?? 10;
        const [companies, contacts, deals] = await Promise.all([
          ctx.runQuery(api.companies.list, {
            search: query,
            paginationOpts: { numItems: limit, cursor: null },
          }),
          ctx.runQuery(api.contacts.list, {
            search: query,
            paginationOpts: { numItems: limit, cursor: null },
          }),
          ctx.runQuery(api.deals.list, {
            paginationOpts: { numItems: limit, cursor: null },
          }),
        ]);
        return { companies, contacts, deals };
      }

      // ---- HR ----
      case 'listEmployees':
        return await ctx.runQuery(internal.aiToolInternals.listEmployees, {
          organizationId: orgId,
          status: args.status as string | undefined,
          department: args.department as string | undefined,
          search: args.search as string | undefined,
          limit: (args.limit as number) ?? 100,
        });

      case 'getAttendance':
        return await ctx.runQuery(internal.aiToolInternals.getAttendanceDailySummary, {
          organizationId: orgId,
          date: (args.date ?? new Date().toISOString().split('T')[0]) as string,
          branchId: args.branchId as Id<'branches'> | undefined,
        });

      case 'markAttendance':
        // Returns guidance — actual attendance changes go through correction workflow
        return {
          info: 'Untuk mengubah status absensi, gunakan fitur koreksi absensi (approveCorrection). Saya bisa membantu melihat daftar koreksi yang pending.',
          requestedStatus: args.status,
          employeeCount: (args.employeeIds as string[])?.length ?? 0,
          date: args.date,
        };

      case 'listShifts':
        return await ctx.runQuery(api.hrShifts.list, {
          branchId: args.branchId as Id<'branches'> | undefined,
        });

      case 'getAttendanceCorrections':
        return await ctx.runQuery(api.hrCorrections.listPending, {});

      case 'approveCorrection':
        return await ctx.runMutation(api.hrCorrections.review, {
          id: args.correctionId as Id<'attendanceCorrections'>,
          status: args.action === 'approve' ? 'approved' as const : 'rejected' as const,
          reviewNote: args.notes as string | null | undefined,
        });

      case 'getHolidays':
        return await ctx.runQuery(api.hrHolidays.list, {});

      // ---- Commerce ----
      case 'listInvoices':
        return await ctx.runQuery(api.invoices.list, {
          type: args.status === 'overdue' ? 'customer_invoice' as const : undefined,
          state: args.status as any,
          companyId: args.companyId as Id<'companies'> | undefined,
          search: args.search as string | undefined,
          paginationOpts: { numItems: (args.limit as number) ?? 50, cursor: null },
        });

      case 'getInvoice':
        return await ctx.runQuery(api.invoices.getById, {
          id: args.id as Id<'invoices'>,
        });

      case 'listProducts':
        return await ctx.runQuery(api.products.list, {
          search: args.search as string | undefined,
          paginationOpts: { numItems: (args.limit as number) ?? 50, cursor: null },
        });

      case 'getSaleOrders':
        return await ctx.runQuery(api.saleOrders.list, {
          state: args.status as any,
          companyId: args.companyId as Id<'companies'> | undefined,
          search: args.search as string | undefined,
          paginationOpts: { numItems: (args.limit as number) ?? 50, cursor: null },
        });

      case 'getRevenueSummary':
        return await ctx.runQuery(internal.aiToolInternals.getDashboardStats, {
          organizationId: orgId,
          userId: execCtx.userId,
        });

      // ---- Reports ----
      case 'getDashboardStats':
        return await ctx.runQuery(internal.aiToolInternals.getDashboardStats, {
          organizationId: orgId,
          userId: execCtx.userId,
        });

      case 'getAttendanceReport':
        return await ctx.runQuery(api.hrReports.getMonthlySummary, {
          month: ((args.startDate as string) ?? '').slice(0, 7) || new Date().toISOString().slice(0, 7),
          branchId: args.branchId as Id<'branches'> | undefined,
        });

      case 'getDealPipelineReport':
        return await ctx.runQuery(api.deals.listByStage, {});

      case 'getRevenueReport':
        return await ctx.runQuery(api.invoices.list, {
          paginationOpts: { numItems: 200, cursor: null },
        });

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    return { error: err.message ?? 'Tool execution failed' };
  }
}
