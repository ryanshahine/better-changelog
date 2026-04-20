/**
 * GitHub webhook receiver. Configured via the /setup GUI — the setup page
 * shows you the exact Payload URL and Secret to paste into GitHub.
 *
 * GitHub → repo → Settings → Webhooks:
 *   - Payload URL: <your-app-url>/api/webhooks/github
 *   - Content type: application/json
 *   - Secret: the `webhook_secret` from /setup
 *   - Events: "Pull requests"
 */
import { NextRequest, NextResponse } from 'next/server';
import { categorizePr, cleanPrBody, verifyWebhookSignature } from '@/lib/github';
import { insertDraftFromPr } from '@/lib/db';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cfg = await getConfig();
  if (!cfg.webhook_secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const signature = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event');
  const payload = await req.text();

  const ok = await verifyWebhookSignature(cfg.webhook_secret, payload, signature);
  if (!ok) return NextResponse.json({ error: 'bad_signature' }, { status: 401 });

  if (event === 'ping') return NextResponse.json({ ok: true, pong: true });
  if (event !== 'pull_request') return NextResponse.json({ ok: true, ignored: event });

  const data = JSON.parse(payload) as PullRequestPayload;
  if (data.action !== 'closed' || !data.pull_request?.merged) {
    return NextResponse.json({ ok: true, ignored: 'not_merged' });
  }

  const prodBranch = cfg.prod_branch || 'main';
  if (data.pull_request.base?.ref !== prodBranch) {
    return NextResponse.json({ ok: true, ignored: 'wrong_base' });
  }

  // Guard: reject payloads from repos other than the configured tracked repo.
  const expected = cfg.tracked_repo;
  const incoming = data.repository?.full_name;
  if (expected && incoming && expected.toLowerCase() !== incoming.toLowerCase()) {
    return NextResponse.json({ error: 'repo_mismatch' }, { status: 403 });
  }

  const pr = data.pull_request;
  await insertDraftFromPr({
    pr_number: pr.number,
    commit_sha: pr.merge_commit_sha ?? null,
    title: pr.title,
    body: cleanPrBody(pr.body),
    category: categorizePr({ title: pr.title, labels: pr.labels }),
    author: pr.user?.login ?? null,
    merged_at: pr.merged_at ? Math.floor(new Date(pr.merged_at).getTime() / 1000) : null,
  });

  return NextResponse.json({ ok: true, drafted: pr.number });
}

// -- minimal local typings for the bits we consume --------------------------
interface PullRequestPayload {
  action: string;
  repository?: { full_name?: string };
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    merged: boolean;
    merged_at: string | null;
    merge_commit_sha: string | null;
    base?: { ref?: string };
    user?: { login?: string };
    labels?: { name: string }[];
  };
}
