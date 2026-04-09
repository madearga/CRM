import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { ac, roles } from './authPermissions';
import {
  type AuthFunctions,
  createClient,
  createApi,
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
import { createPersonalOrganization } from './organizationHelpers';
import { getEnv } from './helpers/getEnv';
import { DataModel } from './_generated/dataModel';

const authFunctions: AuthFunctions = {
  onCreate: internal.auth.onCreate as any,
  onDelete: internal.auth.onDelete as any,
  onUpdate: internal.auth.onUpdate as any,
};

export const authClient = createClient<DataModel>(
  components.betterAuth as any,
  {
    authFunctions: authFunctions as any,
    triggers: {
      user: {
        onCreate: async (ctx, user) => {
          // NOTE: user._id is a COMPONENT table ID, not a main table ID.
          // We must find/create the user in main tables by email.
          const table: any = entsTableFactory(ctx as any, entDefinitions);

          // Find user in main table by email
          let mainUser = await table('user')
            .filter((q: any) => q.eq(q.field('email'), user.email))
            .first();

          if (!mainUser) {
            // Create user in main table
            const id = await table('user').insert({
              email: user.email,
              name: user.name,
              image: user.image || undefined,
              emailVerified: user.emailVerified ?? false,
              role: 'user',
              createdAt: user.createdAt || Date.now(),
              updatedAt: user.updatedAt || Date.now(),
            });
            mainUser = await table('user').getX(id);
          }

          // Check admin role
          const adminEmails = getEnv().ADMIN;
          if (adminEmails?.includes(user.email) && mainUser.role !== 'admin') {
            await table('user').getX(mainUser._id).patch({ role: 'admin' });
          }

          // Create personal organization if not exists
          if (!mainUser.personalOrganizationId) {
            const slug = `personal-${String(mainUser._id).slice(-8)}`;
            const orgId = await table('organization').insert({
              logo: user.image || undefined,
              monthlyCredits: 0,
              name: `${user.name}'s Organization`,
              slug,
              createdAt: Date.now(),
            });
            await table('member').insert({
              createdAt: Date.now(),
              role: 'owner',
              organizationId: orgId,
              userId: mainUser._id,
            });
            await table('user').getX(mainUser._id).patch({
              lastActiveOrganizationId: orgId,
              personalOrganizationId: orgId,
            });
          }
        },
      },
      session: {
        onCreate: async (ctx, session) => {
          // Session trigger skipped — activeOrganizationId is set client-side
          // after login via dashboard. The component adapter updateOne
          // validator doesn't support activeOrganizationId field.
        },
      },
    } as any,
  } as any
);

export const createAuth = (ctx: GenericCtx, { optionsOnly = false } = {}) => {
  const baseURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const socialProviders: Record<string, any> = {};

  if (googleClientId && googleClientSecret) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    };
  }

  const trustedProviders = Object.keys(socialProviders);

  return betterAuth({
    account: {
      accountLinking: {
        enabled: true,
        updateUserInfoOnLink: true,
        trustedProviders,
      },
    },
    baseURL,
    logger: { disabled: optionsOnly },
    trustedOrigins: [
      baseURL,
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL || '',
      'http://localhost:3000',
      'http://localhost:3005',
    ].filter(Boolean),
    plugins: [
      organization({
        ac,
        roles,
        allowUserToCreateOrganization: true,
        creatorRole: 'owner',
        invitationExpiresIn: 24 * 60 * 60 * 7,
        membershipLimit: 100,
        organizationLimit: 3,
        schema: {
          organization: {
            additionalFields: {
              monthlyCredits: {
                required: true,
                type: 'number',
              },
            },
          },
        },
        sendInvitationEmail: optionsOnly ? undefined : async (data) => {
          console.log('Invitation email would be sent to:', data.email);
        },
      }),
      convex(),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 15,
    },
    socialProviders,
    telemetry: { enabled: false },
    user: {
      changeEmail: {
        enabled: false,
      },
      deleteUser: {
        enabled: false,
      },
    },
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

export const {
  create,
  deleteMany,
  deleteOne,
  findMany,
  findOne,
  updateMany,
  updateOne,
} = createApi(schema as any, createAuth as any);

const triggerApi = authClient.triggersApi();

export const { onCreate, onDelete, onUpdate } = triggerApi;
