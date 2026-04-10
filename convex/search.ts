import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod';
import { createOrgQuery } from './functions';

export const globalSearch = createOrgQuery()({
  args: {
    query: z.string().min(1),
  },
  returns: z.object({
    companies: z.array(z.object({
      id: zid('companies'),
      name: z.string(),
      industry: z.string().optional(),
    })),
    contacts: z.array(z.object({
      id: zid('contacts'),
      fullName: z.string(),
      email: z.string(),
    })),
    deals: z.array(z.object({
      id: zid('deals'),
      title: z.string(),
      stage: z.string(),
    })),
  }),
  handler: async (ctx, args) => {
    const { orgId } = ctx;
    const query = args.query;

    const [companies, contacts, deals] = await Promise.all([
      ctx.table('companies')
        .search('search_companies', (q: any) =>
          q.search('name', query).eq('organizationId', orgId)
        )
        .take(5),
      ctx.table('contacts')
        .search('search_contacts', (q: any) =>
          q.search('fullName', query).eq('organizationId', orgId)
        )
        .take(5),
      ctx.table('deals')
        .search('search_deals', (q: any) =>
          q.search('title', query).eq('organizationId', orgId)
        )
        .take(5),
    ]);

    return {
      companies: companies.map((c: any) => ({
        id: c._id,
        name: c.name,
        industry: c.industry,
      })),
      contacts: contacts.map((c: any) => ({
        id: c._id,
        fullName: c.fullName,
        email: c.email,
      })),
      deals: deals.map((d: any) => ({
        id: d._id,
        title: d.title,
        stage: d.stage,
      })),
    };
  },
});
