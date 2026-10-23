/**
 * Safe callback URL handling for the sign in form.
 *
 * The callback URL comes from the browser query string, so it is untrusted
 * input. Only same origin targets are allowed. Everything else falls back to
 * the site root.
 *
 * The module is free of framework imports on purpose. It stays testable
 * without a browser or a Convex deployment.
 */

const isSafePath = (value: string): boolean => {
  if (!value.startsWith('/')) {
    return false;
  }
  // "//host" leaves the site.
  if (value.startsWith('//')) {
    return false;
  }
  return true;
};

/**
 * Control characters and backslashes are never allowed. The URL parser
 * removes control characters, so a value can hide a second host.
 */
const hasUnsafeCharacters = (value: string): boolean =>
  /[\u0000-\u001f\u007f]/.test(value) || value.includes('\\');

const stripTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, '');

export type ResolveCallbackUrlArgs = {
  callbackUrl?: string | null;
  siteUrl?: string | null;
};

/**
 * Build the callback URL for a social sign in.
 *
 * The result is an absolute URL on the site origin, or a root relative path
 * when the site URL is unknown. An external or malformed callback value is
 * rejected and the site root is used instead.
 */
export const resolveCallbackUrl = ({
  callbackUrl,
  siteUrl,
}: ResolveCallbackUrlArgs): string => {
  const site = (siteUrl ?? '').trim();
  const fallback = site ? `${stripTrailingSlash(site)}/` : '/';

  const raw = (callbackUrl ?? '').trim();
  if (!raw) {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw).trim();
  } catch {
    return fallback;
  }

  if (!decoded) {
    return fallback;
  }

  if (hasUnsafeCharacters(decoded)) {
    return fallback;
  }

  if (!site) {
    // Without a site URL only a root relative path can be same origin.
    return isSafePath(decoded) ? decoded : fallback;
  }

  let base: URL;
  try {
    base = new URL(site);
  } catch {
    return fallback;
  }

  let target: URL;
  try {
    target = new URL(decoded, base);
  } catch {
    return fallback;
  }

  if (target.origin !== base.origin) {
    return fallback;
  }

  return target.toString();
};
