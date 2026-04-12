import { query } from "./_generated/server";
import { getEnv } from "./helpers/getEnv";

export const getDebugEnv = query({
  args: {},
  handler: async (ctx) => {
    return {
      env: getEnv(),
      processEnv: {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      }
    };
  },
});
