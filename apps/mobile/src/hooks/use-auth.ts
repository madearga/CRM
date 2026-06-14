/**
 * Mobile auth state hook.
 *
 * Thin re-export of {@link useAuthContext} so screens import from a single
 * `@/hooks/*` location (consistent with `use-convex`). The provider lives in
 * `@/providers/auth-provider` and is mounted once in the root layout.
 *
 * @example
 * const { status, user, signInEmail, signOut } = useAuth();
 */
export { useAuthContext as useAuth } from '@/providers/auth-provider';
export type { AuthContextValue, SignInResult } from '@/providers/auth-provider';
