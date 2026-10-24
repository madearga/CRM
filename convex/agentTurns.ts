// The cost guard of one agent turn.
//
// A turn calls a model and may read CRM data, so it is limited per person
// and per minute. The limit lives in Convex, not in the web process, so a
// second server instance cannot escape it.

import { createOrgMutation } from './functions';

export const consume = createOrgMutation({
  rateLimit: 'agent/turn',
})({
  args: {},
  handler: async () => ({ ok: true as const }),
});
