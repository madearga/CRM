function handler(request: Request) {
  const requestUrl = new URL(request.url);
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_SITE_URL is not set');
  }

  const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`;
  const nextRequest = new Request(nextUrl, request);
  nextRequest.headers.set('accept-encoding', 'application/json');
  nextRequest.headers.set('x-crm-auth-base-url', requestUrl.origin);

  return fetch(nextRequest, { method: request.method, redirect: 'manual' });
}

export const GET = handler;
export const POST = handler;
