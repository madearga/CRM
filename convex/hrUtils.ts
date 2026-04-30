import { ConvexError } from 'convex/values';
import type { Id } from './_generated/dataModel';

export function getDateKey(timestamp: number, timeZone = 'Asia/Jakarta') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

export function getMondayBasedDay(timestamp: number, timeZone = 'Asia/Jakarta') {
  const localDate = new Date(new Date(timestamp).toLocaleString('en-US', { timeZone }));
  return (localDate.getDay() + 6) % 7;
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

export function minutesSinceMidnight(timestamp: number, timeZone = 'Asia/Jakarta') {
  const localDate = new Date(new Date(timestamp).toLocaleString('en-US', { timeZone }));
  return localDate.getHours() * 60 + localDate.getMinutes();
}

export function calculateAttendanceTiming(args: {
  timestamp: number;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
}) {
  const nowMinutes = minutesSinceMidnight(args.timestamp);
  const startMinutes = timeToMinutes(args.startTime);
  const endMinutes = timeToMinutes(args.endTime);
  const lateDiff = nowMinutes - startMinutes;
  const earlyDiff = endMinutes - nowMinutes;

  return {
    isLate: lateDiff > args.lateToleranceMinutes,
    lateMinutes: lateDiff > args.lateToleranceMinutes ? lateDiff : null,
    isEarlyLeave: earlyDiff > 0,
    earlyLeaveMinutes: earlyDiff > 0 ? earlyDiff : null,
  };
}

export function calculateWorkHours(clockIn: number, clockOut: number) {
  return Math.max(0, Math.round(((clockOut - clockIn) / 3_600_000) * 100) / 100);
}

export function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function makeBranchQrCode(orgId: Id<'organization'>, branchName: string) {
  const safeName = branchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `br_${orgId}_${safeName}_${Date.now()}`;
}

export async function getUserBranchScope(ctx: any): Promise<Id<'branches'> | null> {
  const userId = ctx.user?._id ?? ctx.userId;
  if (!userId) return null;
  const employees = await ctx
    .table('employees', 'organizationId_userId', (q: any) =>
      q.eq('organizationId', ctx.orgId).eq('userId', userId)
    )
    .take(1);
  return employees[0]?.branchId ?? null;
}

export async function assertBranchAccess(ctx: any, branchId: Id<'branches'>) {
  const role = ctx.user?.activeOrganization?.role ?? ctx.user?.role;
  if (role !== 'branch_manager') return;
  const scopedBranchId = await getUserBranchScope(ctx);
  if (scopedBranchId !== branchId) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Branch manager can only access their assigned branch',
    });
  }
}
