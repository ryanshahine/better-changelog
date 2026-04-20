import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { setConfig } from '@/lib/config';
import { hasRepoWriteAccess } from '@/lib/github';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    tracked_repo?: string;
    prod_branch?: string;
    app_url?: string;
    webhook_secret?: string;
  } | null;
  if (!body) return NextResponse.json({ error: 'bad_body' }, { status: 400 });

  const tracked = (body.tracked_repo ?? '').trim();
  const branch = (body.prod_branch ?? 'main').trim() || 'main';
  const appUrl = (body.app_url ?? '').trim().replace(/\/$/, '');
  const webhookSecret = (body.webhook_secret ?? '').trim();

  if (!/^[\w.-]+\/[\w.-]+$/.test(tracked)) {
    return NextResponse.json({ error: 'tracked_repo must be "owner/repo"' }, { status: 400 });
  }
  if (!/^https?:\/\//.test(appUrl)) {
    return NextResponse.json({ error: 'app_url must start with http(s)://' }, { status: 400 });
  }
  if (webhookSecret.length < 16) {
    return NextResponse.json({ error: 'webhook_secret is too short' }, { status: 400 });
  }

  // Make sure the admin actually has access to the repo they want to track.
  // We don't require push — read is enough for webhooks and PR metadata, but
  // enforcing push keeps abuse (pointing at random public repos) low.
  const hasAccess = await hasRepoWriteAccess(
    gate.session.access_token,
    tracked,
    gate.session.github_login,
  );
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'you must have write access to the tracked repo' },
      { status: 403 },
    );
  }

  await setConfig({
    tracked_repo: tracked,
    prod_branch: branch,
    app_url: appUrl,
    webhook_secret: webhookSecret,
  });

  return NextResponse.json({ ok: true });
}
