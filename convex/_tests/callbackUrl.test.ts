/**
 * Tests for the safe callback URL of the sign in form.
 *
 * The callback URL is untrusted input from the query string. Only a target on
 * the same origin is allowed.
 */
import { describe, expect, it } from 'vitest';

import { resolveCallbackUrl } from '../helpers/callbackUrl';

const SITE = 'https://crm.example.com';

describe('resolveCallbackUrl', () => {
  it('returns the site root when no callback URL is given', () => {
    expect(resolveCallbackUrl({ callbackUrl: '', siteUrl: SITE })).toBe(
      'https://crm.example.com/'
    );
    expect(resolveCallbackUrl({ siteUrl: SITE })).toBe(
      'https://crm.example.com/'
    );
  });

  it('keeps a same origin path', () => {
    expect(
      resolveCallbackUrl({ callbackUrl: '/deals?view=grid', siteUrl: SITE })
    ).toBe('https://crm.example.com/deals?view=grid');
  });

  it('keeps a same origin absolute URL', () => {
    expect(
      resolveCallbackUrl({
        callbackUrl: 'https://crm.example.com/invite/abc',
        siteUrl: SITE,
      })
    ).toBe('https://crm.example.com/invite/abc');
  });

  it('decodes an encoded path', () => {
    expect(
      resolveCallbackUrl({
        callbackUrl: '%2Fdeals%3Fview%3Dgrid',
        siteUrl: SITE,
      })
    ).toBe('https://crm.example.com/deals?view=grid');
  });

  it('rejects an external URL', () => {
    expect(
      resolveCallbackUrl({ callbackUrl: 'https://evil.example.com', siteUrl: SITE })
    ).toBe('https://crm.example.com/');
  });

  it('rejects a protocol relative URL', () => {
    expect(
      resolveCallbackUrl({ callbackUrl: '//evil.example.com', siteUrl: SITE })
    ).toBe('https://crm.example.com/');
  });

  it('rejects a backslash URL', () => {
    expect(
      resolveCallbackUrl({ callbackUrl: '/\\evil.example.com', siteUrl: SITE })
    ).toBe('https://crm.example.com/');
    expect(
      resolveCallbackUrl({ callbackUrl: '\\\\evil.example.com', siteUrl: SITE })
    ).toBe('https://crm.example.com/');
  });

  it('rejects a script URL', () => {
    expect(
      resolveCallbackUrl({ callbackUrl: 'javascript:alert(1)', siteUrl: SITE })
    ).toBe('https://crm.example.com/');
  });

  it('rejects a URL with a control character', () => {
    expect(
      resolveCallbackUrl({
        callbackUrl: '/deals\n//evil.example.com',
        siteUrl: SITE,
      })
    ).toBe('https://crm.example.com/');
  });

  it('rejects a malformed percent encoding', () => {
    expect(
      resolveCallbackUrl({ callbackUrl: '%E0%A4%A', siteUrl: SITE })
    ).toBe('https://crm.example.com/');
  });

  it('rejects an external URL with a different port', () => {
    expect(
      resolveCallbackUrl({
        callbackUrl: 'https://crm.example.com:8443/deals',
        siteUrl: SITE,
      })
    ).toBe('https://crm.example.com/');
  });

  it('falls back to a relative path when the site URL is unknown', () => {
    expect(
      resolveCallbackUrl({ callbackUrl: '/deals', siteUrl: undefined })
    ).toBe('/deals');
    expect(
      resolveCallbackUrl({
        callbackUrl: 'https://evil.example.com',
        siteUrl: undefined,
      })
    ).toBe('/');
    expect(
      resolveCallbackUrl({ callbackUrl: '//evil.example.com', siteUrl: undefined })
    ).toBe('/');
  });

  it('does not add a second slash to the site URL', () => {
    expect(
      resolveCallbackUrl({ callbackUrl: '/deals', siteUrl: 'https://crm.example.com/' })
    ).toBe('https://crm.example.com/deals');
  });
});
