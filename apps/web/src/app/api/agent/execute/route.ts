/**
 * Execute one approved agent operation as the signed-in person.
 *
 * The ledger only runs an effect after a person approved it; this route is
 * the human-side trigger for operations proposed through WebMCP (the browser
 * tab cannot call execute itself). The server re-checks the permission
 * (agents:manage) and the approval, so the route adds no authority.
 */
import { ConvexHttpClient } from 'convex/browser';
import type { Id } from '@convex/_generated/dataModel';
import { NextResponse } from 'next/server';

import { getSessionToken } from '@/lib/convex/server';
import { api } from '@convex/_generated/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    operationId?: string;
  } | null;
  if (!body?.operationId) {
    return NextResponse.json(
      { error: 'operationId is required' },
      { status: 400 }
    );
  }

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  try {
    const result = await client.action(api.agentOperations.execute, {
      operationId: body.operationId as Id<'agentOperations'>,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Execution failed' },
      { status: 400 }
    );
  }
}
