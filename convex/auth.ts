import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { admin, organization } from 'better-auth/plugins';
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

export const authClient = createClient<DataModel, typeof schema>(
  components.betterAuth as any,
  {
  authFunctions: authFunctions as any,
  local: { schema: schema as any },
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

export const createAuth = (ctx: GenericCtx, { optionsOnly = false } = {}) => {
  const baseURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const socialProviders: Record<string, any> = {};

  if (githubClientId && githubClientSecret) {
    socialProviders.github = {
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      mapProfileToUser: async (profile: any) => {
        return {
          // Better Auth standard fields
          email: profile.email,
          image: profile.avatar_url,
          name: profile.name || profile.login,
          // Additional fields that will be available in onCreateUser
          bio: profile.bio || undefined,
          firstName: profile.name?.split(' ')[0] || undefined,
          github: profile.login,
          lastName: profile.name?.split(' ').slice(1).join(' ') || undefined,
          location: profile.location || undefined,
          username: profile.login,
          x: profile.twitter_username || undefined,
        };
      },
    };
  }

  if (googleClientId && googleClientSecret) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      mapProfileToUser: async (profile: any) => {
        return {
          // Better Auth standard fields
          email: profile.email,
          image: profile.picture,
          name: profile.name,
          // Additional fields that will be available in onCreateUser
          firstName: profile.given_name || undefined,
          lastName: profile.family_name || undefined,
        };
      },
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
    plugins: [
      admin(),
      organization({
        ac,
        roles,
        allowUserToCreateOrganization: true, // Will gate with
        creatorRole: 'owner',
        invitationExpiresIn: 24 * 60 * 60 * 7, // 7 days
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
          // TODO: Send invitation email via Resend (Phase 3)
          console.log('Invitation email would be sent to:', data.email);
        },
      }),
      convex(),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24 * 15, // 15 days
    },
    socialProviders,
    telemetry: { enabled: false },
    user: {
      additionalFields: {
        bio: {
          required: false,
          type: 'string',
        },
        firstName: {
          required: false,
          type: 'string',
        },
        github: {
          required: false,
          type: 'string',
        },
        lastName: {
          required: false,
          type: 'string',
        },
        linkedin: {
          required: false,
          type: 'string',
        },
        location: {
          required: false,
          type: 'string',
        },
        username: {
          required: false,
          type: 'string',
        },
        website: {
          required: false,
          type: 'string',
        },
        x: {
          required: false,
          type: 'string',
        },
      },
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
