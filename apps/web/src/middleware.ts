import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Domains that serve the CRM dashboard directly
const PRIMARY_DOMAINS = ['localhost', '127.0.0.1'];

export async function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl;

  // Skip static files, api routes, _next
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    /\/[^/]*\.[^/]*$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // If already on /shop/[slug] path, pass through
  if (pathname.match(/^\/shop\/[^/]+/)) {
    return NextResponse.next();
  }

  // Custom domain detection
  const isCustomDomain = !PRIMARY_DOMAINS.some(
    (d) =>
      hostname === d ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.localhost')
  );

  if (isCustomDomain && !pathname.startsWith('/shop')) {
    // Rewrite custom domain requests to /shop/[domain]/*
    // Shop layout resolves hostname → slug → orgId client-side
    const url = request.nextUrl.clone();
    url.pathname = `/shop/${hostname}${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
