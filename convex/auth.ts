import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { admin, organization } from 'better-auth/plugins';
import { ac, roles } from './authPermissions';
import {
  type AuthFunctions,
  createClient,
} from '@convex-dev/better-auth';

import { api, components, internal } from './_generated/api';
import {
  ActionCtx,
  MutationCtx,
  QueryCtx,
  type GenericCtx,
} from './_generated/server';
import { entsTableFactory } from 'convex-ents';
import schema, { entDefinitions } from './schema';
import authSchema from './betterAuth/schema';
import { createAuthOptions } from './authOptions';
import { createPersonalOrganization } from './organizationHelpers';
import { getEnv } from './helpers/getEnv';
import { DataModel } from './_generated/dataModel';

const authFunctions: AuthFunctions = {
  onCreate: internal.auth.onCreate as any,
  onDelete: internal.auth.onDelete as any,
  onUpdate: internal.auth.onUpdate as any,
};

export const authClient = createClient<DataModel, typeof authSchema>(
  components.betterAuth as any,
  {
    authFunctions: authFunctions as any,
    local: { schema: authSchema as any },
    triggers: {
      user: {
        onCreate: async (ctx, user) => {
          const adminEmails = getEnv().ADMIN;
          if (adminEmails?.includes(user.email) && user.role !== 'admin') {
            const table: any = entsTableFactory(ctx as any, entDefinitions);
            await table('user').getX(user._id as any).patch({ role: 'admin' });
          }

          await createPersonalOrganization(ctx as any, {
            email: user.email,
            image: user.image || null,
            name: user.name,
            userId: user._id as any,
          });
        },
      },
      session: {
        onCreate: async (ctx, session) => {
          const table: any = entsTableFactory(ctx as any, entDefinitions);

          if (!session.activeOrganizationId) {
            const user = await table('user').getX(session.userId as any);

            await table('session')
              .getX(session._id as any)
              .patch({
                activeOrganizationId:
                  user.lastActiveOrganizationId || user.personalOrganizationId,
              });
          }
        },
      },
    } as any,
  } as any
);

// ============================================================
// createAuth — runtime auth instance
// ============================================================

export const createAuth = (ctx: GenericCtx, { optionsOnly = false } = {}) => {
  return betterAuth({
    ...createAuthOptions(),
    logger: { disabled: optionsOnly },
    ...(optionsOnly ? {} : { database: authClient.adapter(ctx) }),
  });
};

export const auth = createAuth({} as any, { optionsOnly: true });

export const getAuth = <Ctx extends QueryCtx | MutationCtx>(ctx: Ctx) => {
  return betterAuth({
    ...auth.options,
    database: authClient.adapter(ctx as any),
  });
};

const triggerApi = authClient.triggersApi();

export const { onCreate, onDelete, onUpdate } = triggerApi;
