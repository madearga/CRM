import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Monday 08:00 Asia/Jakarta (01:00 UTC)
crons.weekly(
  'weekly-pipeline-digest',
  { dayOfWeek: 'monday', hourUTC: 1, minuteUTC: 0 },
  internal.weeklyDigest.sendWeeklyPipelineDigest,
  {}
);

// Daily at 02:00 UTC — process recurring invoices that are due
crons.daily(
  'process-recurring-invoices',
  { hourUTC: 2, minuteUTC: 0 },
  internal.recurringInvoices.processDueRecurringInvoices,
  {},
);

// Daily 00:05 Asia/Jakarta (17:05 UTC previous day) — close attendance records without clock-out
crons.daily(
  'auto-close-open-attendance-records',
  { hourUTC: 17, minuteUTC: 5 },
  internal.hrAttendance.autoCloseOpenRecords,
  {},
);

export default crons;
