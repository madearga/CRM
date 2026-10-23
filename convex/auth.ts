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
} from './_generated/server';
import { entsTableFactory } from 'convex-ents';
import schema, { entDefinitions } from './schema';
import { createPersonalOrganization } from './organizationHelpers';
import { getEnv } from './helpers/getEnv';
import { DataModel } from './_generated/dataModel';
import { findMainUserByEmail } from './authHelpers';

// TYPE SAFETY NOTE: These `as any` casts are necessary because Better Auth's
// AuthFunctions type expects specific function signatures that don't perfectly
// match our internal mutation references. The actual runtime behavior is safe
// because Better Auth invokes these by function reference, not by type contract.
const authFunctions: AuthFunctions = {
  onCreate: internal.auth.onCreate as any,
  onDelete: internal.auth.onDelete as any,
  onUpdate: internal.auth.onUpdate as any,
};

// TYPE SAFETY NOTE: `components.betterAuth as any` and `authFunctions as any`
// are required because the Better Auth Convex component's generated types don't
// perfectly align with our DataModel generic. The runtime behavior is correct.
export const authClient = createClient<DataModel>(
  components.betterAuth as any,
  {
    authFunctions: authFunctions as any,
    triggers: {
      user: {
        onCreate: async (ctx, user) => {
          // ──── COMPONENT vs MAIN TABLE ID EXPLANATION ────
          // user._id here is a COMPONENT table ID from Better Auth's internal tables.
          // It is NOT the same as our main `user` table ID. We bridge the gap
          // by looking up users in the main table by email (unique field).
          // Never pass user._id directly as a main-table foreign key.
          // ────────────────────────────────────────────────
          const table: any = entsTableFactory(ctx as any, entDefinitions);

          // Runtime validation: ensure we have required fields
          if (!user.email || typeof user.email !== 'string') {
            console.error('[user.onCreate] Missing or invalid email, cannot create main user:', user);
            return;
          }

          // Find user in main table by email using shared helper
          let mainUser = await findMainUserByEmail(table, user.email);

          if (!mainUser) {
            // Create user in main table
            const safeName = (typeof user.name === 'string' && user.name.trim()) ? user.name : user.email;
            const id = await table('user').insert({
              email: user.email,
              name: safeName,
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

          // Create personal organization if not exists.
          // The helper owns the personal organization, the owner membership
          // and the default permission templates.
          const safeName =
            (typeof user.name === 'string' && user.name.trim()) || 'User';

          await createPersonalOrganization(ctx as any, {
            image: user.image || null,
            name: safeName,
            userId: mainUser._id,
          });
        },
      },
      session: {
        onCreate: async (ctx, session) => {
          // The session document of the auth component has no organization
          // field. The active organization lives in the CRM user row, so this
          // trigger only makes sure that the CRM user and the personal
          // organization exist.
          const componentUserId = session.userId as any;
          let componentUser: any = null;
          try {
            componentUser = await authClient.getAnyUserById(
              ctx as any,
              componentUserId
            );
          } catch (err) {
            console.warn('[session.onCreate] Failed to read the component user:', err);
            return;
          }

          const email = componentUser?.email;
          if (!email) {
            console.warn('[session.onCreate] No email found on component user for session:', session._id);
            return;
          }

          // Use shared helper to find main user by email
          const table: any = entsTableFactory(ctx as any, entDefinitions);
          const mainUser = await findMainUserByEmail(table, email);
          if (!mainUser) return;

          const safeName =
            (typeof componentUser?.name === 'string' &&
              componentUser.name.trim()) ||
            'User';

          await createPersonalOrganization(ctx as any, {
            image: componentUser?.image || null,
            name: safeName,
            userId: mainUser._id,
          });
        },
      },
    } as any,
  } as any
);

// `convex/server` no longer exports `GenericCtx`, so the context type that the
// Better Auth adapter accepts is spelled out here.
type GenericCtx = QueryCtx | MutationCtx | ActionCtx;

export const createAuth = (ctx: GenericCtx, { optionsOnly = false } = {}) => {
  const baseURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  // The Google provider needs the server side variables. The browser only
  // knows the client id. When the server side variables are missing the
  // provider is not registered and the sign in fails with an unknown
  // provider. The variables must be set on the deployment that runs the
  // functions.
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

// The options only instance carries the options for the client plugins and
// for the request instances. It has no database, so Better Auth falls back to
// the memory adapter and logs a warning. The memory adapter never stores a
// request. Every request uses getAuth below, which uses the adapter of the
// auth component.
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
