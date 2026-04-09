import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal';
import { admin, organization } from 'better-auth/plugins';
import { ac, roles } from './authPermissions';
import authConfig from './auth.config';

// ============================================================
// Auth Options (used for schema generation & adapter)
// Split from createAuth so it can be called without env vars
// for schema generation in the component directory.
// ============================================================

export const createAuthOptions = (): BetterAuthOptions => {
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

  return {
    account: {
      accountLinking: {
        enabled: true,
        updateUserInfoOnLink: true,
        trustedProviders,
      },
    },
    baseURL,
    trustedOrigins: [
      baseURL,
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL || '',
      'http://localhost:3000',
      'http://localhost:3005',
    ].filter(Boolean),
    plugins: [
      admin(),
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
        sendInvitationEmail: async (data) => {
          console.log('Invitation email would be sent to:', data.email);
        },
      }),
      convex({ authConfig }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 15,
    },
    socialProviders,
    telemetry: { enabled: false },
    user: {
      additionalFields: {
        bio: { required: false, type: 'string', input: false },
        firstName: { required: false, type: 'string', input: false },
        lastName: { required: false, type: 'string', input: false },
        linkedin: { required: false, type: 'string', input: false },
        location: { required: false, type: 'string', input: false },
        website: { required: false, type: 'string', input: false },
        x: { required: false, type: 'string', input: false },
      },
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
  };
};
