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

export default crons;
