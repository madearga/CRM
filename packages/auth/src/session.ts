/**
 * Platform-agnostic session primitives.
 *
 * These types describe the shape of a Better Auth session as exposed to
 * clients. Importing this module pulls in ZERO runtime dependencies — it is
 * pure type information plus a couple of tiny helper functions that operate
 * on plain values. Safe for both web (`apps/web`) and mobile (`apps/mobile`).
 */

/**
 * The user record returned by Better Auth on the client side. This mirrors
 * the subset of fields the CRM actually consumes across web and mobile; it
 * is intentionally permissive (`Record<string, unknown>`) for forward-compat
 * with additional fields the server may add.
 */
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  role?: string | null;
  [key: string]: unknown;
}

/**
 * A Better Auth session object.
 */
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date | number | string;
  createdAt?: Date | number | string;
  updatedAt?: Date | number | string;
  [key: string]: unknown;
}

/**
 * Normalize a session-user object coming back from Better Auth into the
 * shared {@link SessionUser} shape. Returns `null` when the input is missing.
 * Used by both web and mobile providers to coalesce server variance.
 */
export function toSessionUser(raw: unknown): SessionUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.email !== 'string') {
    return null;
  }
  const { id, email, name, image, emailVerified, role, ...rest } = value;
  return {
    id,
    email,
    name: typeof name === 'string' ? name : null,
    image: typeof image === 'string' ? image : null,
    emailVerified: typeof emailVerified === 'boolean' ? emailVerified : undefined,
    role: typeof role === 'string' ? role : null,
    ...rest,
  };
}

/**
 * Convenience guard for any value that quacks like a Better Auth session
 * payload (`{ session, user }`).
 */
export function isSessionPayload(
  value: unknown,
): value is { session: Session; user: SessionUser } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const session = v.session as Record<string, unknown> | undefined;
  const user = v.user as Record<string, unknown> | undefined;
  return (
    !!session &&
    typeof session.token === 'string' &&
    typeof session.userId === 'string' &&
    !!user &&
    typeof user.id === 'string'
  );
}
