'use node';

import { render } from '@react-email/render';
import { z } from 'zod';

import { internal } from './_generated/api';
import WeeklyPipelineDigestEmail from './emails/weeklyPipelineDigest';
import { resend } from './emails';
import { createInternalAction } from './functions';

export const sendWeeklyPipelineDigest = createInternalAction()({
  args: {},
  returns: z.null(),
  handler: async (ctx) => {
    const targets = await ctx.runQuery(
      internal.weeklyDigestQueries.listDigestTargets,
      {}
    );

    for (const target of targets) {
      const metrics = await ctx.runQuery(
        internal.weeklyDigestQueries.getDigestMetrics,
        {
          organizationId: target.organizationId,
        }
      );

      const html = await render(
        <WeeklyPipelineDigestEmail
          agingDealsCount={metrics.agingDealsCount}
          currency={target.currency}
          dealsMovedLastWeek={metrics.dealsMovedLastWeek}
          generatedAt={new Date().toISOString()}
          organizationName={target.organizationName}
          pipelineValue={metrics.pipelineValue}
          tasksDueThisWeek={metrics.tasksDueThisWeek}
        />
      );

      for (const recipientEmail of target.recipientEmails) {
        await resend.sendEmail(ctx, {
          from: 'CRM <team@notifications.com>',
          html,
          subject: `Weekly pipeline digest - ${target.organizationName}`,
          to: recipientEmail,
        });
      }
    }

    return null;
  },
});
