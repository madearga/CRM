import { z } from 'zod';

const entity = z.enum(['company', 'contact', 'deal']);
const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(200);
const stage = z.enum(['new', 'contacted', 'proposal', 'won', 'lost']);
const paging = {
  cursor: z.string().max(1000).nullable().optional(),
  limit: z.number().int().min(1).max(5).optional(),
};
const dates = {
  from: z.string().max(100).optional(),
  to: z.string().max(100).optional(),
};
export const inputs = {
  search_records: z
    .object({
      entity,
      query: z.string().max(200),
      stage: stage.optional(),
      ...paging,
    })
    .strict(),
  get_record: z.object({ entity, id }).strict(),
  pipeline_overview: z.object(dates).strict(),
  list_activities: z
    .object({
      entity: entity.optional(),
      entity_id: id.optional(),
      type: z
        .enum(['call', 'email', 'meeting', 'note', 'status_change'])
        .optional(),
      ...paging,
    })
    .strict(),
  list_invoices: z
    .object({
      status: z
        .enum(['unpaid', 'partially_paid', 'paid', 'overdue'])
        .optional(),
      company_id: id.optional(),
      ...paging,
    })
    .strict(),
  propose_activity: z
    .object({
      type: z.enum(['call', 'email', 'meeting', 'note']),
      title: text,
      entity,
      entity_id: id,
      note: z.string().max(4000).optional(),
      scheduled_at: z.string().max(100).optional(),
    })
    .strict(),
  propose_deal_stage: z
    .object({
      deal_id: id,
      stage,
      lost_reason: z.string().max(1000).optional(),
    })
    .strict(),
  propose_deal: z
    .object({
      title: text,
      company_id: id.optional(),
      value: z.number().finite().nonnegative().optional(),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .optional(),
      close_date: z.string().max(100).optional(),
    })
    .strict(),
  propose_company: z
    .object({
      name: text,
      domain: z
        .string()
        .max(200)
        .regex(
          /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/
        )
        .optional(),
      industry: text.optional(),
      location: text.optional(),
    })
    .strict(),
  propose_widget: z
    .object({
      type: z.enum(['bar']),
      title: text,
      source: z.enum(['pipeline_overview']),
    })
    .strict(),
  open_record: z
    .object({
      entity: z.enum(['company', 'contact', 'deal', 'invoices']),
      id: id.optional(),
    })
    .strict(),
};
export type ToolName = keyof typeof inputs;
