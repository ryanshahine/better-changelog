import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { deleteEntry, getEntry, updateEntry } from '@/lib/db';
import type { EntryCategory, EntryStatus } from '@/lib/db';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const entry = await getEntry(Number(id));
  if (!entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (entry.status !== 'published') {
    const gate = await checkAdmin();
    if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 401 });
  }
  return NextResponse.json({ entry });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await checkAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as {
    title?: string;
    body?: string;
    category?: EntryCategory;
    status?: EntryStatus;
  };

  const patch: Parameters<typeof updateEntry>[1] = {};
  if (typeof body.title === 'string') patch.title = body.title.slice(0, 500);
  if (typeof body.body === 'string') patch.body = body.body.slice(0, 20_000);
  if (body.category) patch.category = body.category;
  if (body.status === 'draft' || body.status === 'published') patch.status = body.status;

  await updateEntry(Number(id), patch);
  const updated = await getEntry(Number(id));
  return NextResponse.json({ entry: updated });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await checkAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 401 });
  const { id } = await params;
  await deleteEntry(Number(id));
  return NextResponse.json({ ok: true });
}
