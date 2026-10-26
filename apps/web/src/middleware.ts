import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The root stays the dashboard for a signed-in person; everyone else gets
  // the landing page at the same URL.
  if (pathname === '/' && !getSessionCookie(request)) {
    // A rewrite proxies back through the dev server's own origin, which breaks
    // behind the TLS tunnel; a redirect to the landing route stays same-origin.
    const url = request.nextUrl.clone();
    url.pathname = '/welcome';
    return NextResponse.redirect(url);
  }

  // Skip static files, api routes, _next
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    /\/[^/]*\.[^/]*$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
