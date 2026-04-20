import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export const runtime = 'nodejs';

async function handle(req: NextRequest) {
  await destroySession();
  const base = new URL(req.url).origin;
  return NextResponse.redirect(`${base}/`, { status: 303 });
}

export const POST = handle;
export const GET = handle;
