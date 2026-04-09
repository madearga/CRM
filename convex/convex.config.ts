import aggregate from '@convex-dev/aggregate/convex.config';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import { defineApp } from 'convex/server';
import resend from '@convex-dev/resend/convex.config';
import betterAuth from '@convex-dev/better-auth/convex.config';

const app = defineApp();

app.use(betterAuth);
app.use(rateLimiter);
app.use(resend);

// User count aggregate
app.use(aggregate, { name: 'aggregateUsers' });

// CRM aggregates (Phase 1)
app.use(aggregate, { name: 'aggregateDealsByOrg' });
app.use(aggregate, { name: 'aggregateDealsByStage' });
app.use(aggregate, { name: 'aggregateActivitiesByOrg' });
app.use(aggregate, { name: 'aggregateCompaniesByOrg' });

export default app;
