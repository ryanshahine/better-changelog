import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { listEntries } from '@/lib/db';
import type { EntryStatus } from '@/lib/db';

export const runtime = 'nodejs';

/** List entries. Public: published only. Admin: any. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status') as EntryStatus | null;

  if (statusParam && statusParam !== 'published') {
    const gate = await checkAdmin();
    if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 401 });
  }

  const entries = await listEntries({
    status: statusParam ?? 'published',
    limit: 200,
  });
  return NextResponse.json({ entries });
}
