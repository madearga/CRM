import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';

interface ToolExecutionContext {
  ctx: ActionCtx;
  orgId: Id<'organization'>;
  userId: Id<'user'>;
}

/**
 * Execute a tool by name with the given arguments.
 * Returns a JSON-serializable result.
 *
 * All tools route through internal queries/mutations that accept explicit
 * organizationId/userId from the verified HTTP action context, avoiding
 * a second auth lookup in public Convex functions.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  execCtx: ToolExecutionContext
): Promise<unknown> {
  const { ctx, orgId, userId } = execCtx;

  try {
    switch (toolName) {
      // ---- CRM Core ----
      case 'listCompanies':
        return await ctx.runQuery(internal.aiToolInternals.listCompanies, {
          organizationId: orgId,
          search: args.search as string | undefined,
          limit: (args.limit as number) ?? 50,
          includeArchived: false,
        });

      case 'getCompany':
        return await ctx.runQuery(internal.aiToolInternals.getCompanyById, {
          organizationId: orgId,
          id: args.id as Id<'companies'>,
        });

      case 'listContacts':
        return await ctx.runQuery(internal.aiToolInternals.listContacts, {
          organizationId: orgId,
          companyId: args.companyId as Id<'companies'> | undefined,
          search: args.search as string | undefined,
          limit: (args.limit as number) ?? 50,
        });

      case 'getContact':
        return await ctx.runQuery(internal.aiToolInternals.getContactById, {
          organizationId: orgId,
          id: args.id as Id<'contacts'>,
        });

      case 'listDeals':
        return await ctx.runQuery(internal.aiToolInternals.listDeals, {
          organizationId: orgId,
          stage: args.stage as string | undefined,
          limit: (args.limit as number) ?? 50,
        });

      case 'getDeal':
        return await ctx.runQuery(internal.aiToolInternals.getDealById, {
          organizationId: orgId,
          id: args.id as Id<'deals'>,
        });

      case 'createActivity':
        return await ctx.runMutation(internal.aiToolInternals.createActivityForHttp, {
          organizationId: orgId,
          userId,
          type: args.type as string,
          entityType: args.entityType as string,
          entityId: args.entityId as string,
          title: args.title as string,
          description: args.description as string | undefined,
          dueAt: args.dueAt as number | undefined,
        });

      case 'updateDealStage':
        return await ctx.runMutation(internal.aiToolInternals.updateDealStageForHttp, {
          organizationId: orgId,
          id: args.dealId as Id<'deals'>,
          stage: args.stage as string,
          lostReason: args.lostReason as string | undefined,
        });

      case 'searchEntities': {
        const query = args.query as string;
        const limit = (args.limit as number) ?? 10;
        const [companies, contacts, deals] = await Promise.all([
          ctx.runQuery(internal.aiToolInternals.listCompanies, {
            organizationId: orgId,
            search: query,
            limit,
            includeArchived: false,
          }),
          ctx.runQuery(internal.aiToolInternals.listContacts, {
            organizationId: orgId,
            search: query,
            limit,
          }),
          ctx.runQuery(internal.aiToolInternals.listDeals, {
            organizationId: orgId,
            limit,
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
        return {
          info: 'Untuk mengubah status absensi, gunakan fitur koreksi absensi (approveCorrection). Saya bisa membantu melihat daftar koreksi yang pending.',
          requestedStatus: args.status,
          employeeCount: (args.employeeIds as string[])?.length ?? 0,
          date: args.date,
        };

      case 'listShifts':
        return await ctx.runQuery(internal.aiToolInternals.listShifts, {
          organizationId: orgId,
          branchId: args.branchId as Id<'branches'> | undefined,
        });

      case 'getAttendanceCorrections':
        // TODO: add internal query if this tool is actively used
        return { info: 'Fitur koreksi absensi belum tersedia via chat untuk saat ini.' };

      case 'approveCorrection':
        // TODO: add internal mutation if this tool is actively used
        return { info: 'Fitur approve koreksi absensi belum tersedia via chat untuk saat ini.' };

      case 'getHolidays':
        return await ctx.runQuery(internal.aiToolInternals.listHolidays, {
          organizationId: orgId,
        });

      // ---- Commerce ----
      case 'listInvoices':
        return await ctx.runQuery(internal.aiToolInternals.listInvoices, {
          organizationId: orgId,
          state: args.status as string | undefined,
          companyId: args.companyId as Id<'companies'> | undefined,
          search: args.search as string | undefined,
          limit: (args.limit as number) ?? 50,
        });

      case 'getInvoice':
        return await ctx.runQuery(internal.aiToolInternals.getInvoiceById, {
          organizationId: orgId,
          id: args.id as Id<'invoices'>,
        });

      case 'listProducts':
        return await ctx.runQuery(internal.aiToolInternals.listProducts, {
          organizationId: orgId,
          search: args.search as string | undefined,
          limit: (args.limit as number) ?? 50,
        });

      case 'getSaleOrders':
        return await ctx.runQuery(internal.aiToolInternals.listSaleOrders, {
          organizationId: orgId,
          state: args.status as string | undefined,
          companyId: args.companyId as Id<'companies'> | undefined,
          search: args.search as string | undefined,
          limit: (args.limit as number) ?? 50,
        });

      case 'getRevenueSummary':
        return await ctx.runQuery(internal.aiToolInternals.getDashboardStats, {
          organizationId: orgId,
          userId,
        });

      // ---- Reports ----
      case 'getDashboardStats':
        return await ctx.runQuery(internal.aiToolInternals.getDashboardStats, {
          organizationId: orgId,
          userId,
        });

      case 'getAttendanceReport':
        // TODO: add internal monthly summary if actively used
        return { info: 'Laporan bulanan absensi belum tersedia via chat untuk saat ini.' };

      case 'getDealPipelineReport':
        return await ctx.runQuery(internal.aiToolInternals.listDeals, {
          organizationId: orgId,
        });

      case 'getRevenueReport':
        return await ctx.runQuery(internal.aiToolInternals.listInvoices, {
          organizationId: orgId,
          limit: 200,
        });

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`[AI Tool] ${toolName} failed:`, err.message);
    return { error: err.message ?? 'Tool execution failed' };
  }
}
