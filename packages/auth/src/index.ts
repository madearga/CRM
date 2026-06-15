export {
  createCrmAuthClient,
  crmAuthClientPlugins,
  type CrmAuthClient,
  type CreateCrmAuthClientOptions,
  type CrmAuthClientPluginsOptions,
  type CrmAuthStorage,
  type SignIn,
  type SignOut,
  type SignUp,
  type UseSession,
} from './auth-client';

export {
  type SessionUser,
  type Session,
  type SessionState,
  type EmailSignInInput,
  type EmailSignUpInput,
  type SignOutInput,
  type ConvexTokenResult,
  toSessionUser,
  isSessionPayload,
} from './session';
