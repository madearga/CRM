import { internalQuery } from './_generated/server';

// Diagnostic configuration status only. Never return environment values.
export const getDebugEnv = internalQuery({
  args: {},
  handler: async () => ({
    authConfigured: Boolean(process.env.BETTER_AUTH_SECRET),
    googleConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
  }),
});
