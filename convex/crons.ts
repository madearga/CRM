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

export default crons;
