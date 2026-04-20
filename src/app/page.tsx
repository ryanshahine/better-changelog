import { headers } from 'next/headers';
import Link from 'next/link';
import { listEntries } from '@/lib/db';
import { getConfig, isConfigured } from '@/lib/config';
import { env } from '@/lib/env';
import { categoryBadgeClass, ui } from '@/lib/ui';

export const dynamic = 'force-dynamic';

function formatDate(unix: number | null): string {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function HomePage() {
  // Not set up yet? Show the onboarding card instead of an empty changelog.
  if (!(await isConfigured())) {
    const e = env();
    const changelogRepo = e.CHANGELOG_REPO;
    const clientId = e.GITHUB_CLIENT_ID;
    const needsDeployVars = !changelogRepo || !clientId;

    // Derive the public origin from the incoming request so we can show the
    // exact OAuth callback URL the user needs to paste into GitHub.
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    const origin = `${proto}://${host}`;
    const callbackUrl = `${origin}/api/auth/callback`;

    const code = 'rounded bg-[var(--border-soft)] px-1.5 py-0.5 font-mono text-[12px]';
    const codeBlock =
      'block w-full overflow-x-auto whitespace-pre rounded-md bg-[var(--border-soft)] px-3 py-2 font-mono text-[12px]';

    return (
      <main className={ui.container}>
        <header className="mb-10">
          <h1 className={ui.h1}>Welcome to better-changelog</h1>
          <div className={`mt-1 text-[13px] ${ui.muted}`}>
            Almost there — this instance just needs a one-time setup.
          </div>
        </header>

        {needsDeployVars ? (
          (() => {
            const steps: Array<{ key: string; render: (n: number) => React.ReactNode }> = [];

            if (!clientId) {
              steps.push({
                key: 'oauth',
                render: (n) => (
                  <section
                    key="oauth"
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 text-[14px]"
                  >
                    <h2 className="text-[15px] font-semibold">
                      Step {n}. Create a GitHub OAuth App
                    </h2>
                    <p className={`mt-1 ${ui.muted}`}>
                      This is how admins sign in to approve changelog drafts. Open{' '}
                      <a
                        className="underline underline-offset-2 hover:text-[var(--body-color)]"
                        href="https://github.com/settings/applications/new"
                        target="_blank"
                        rel="noreferrer"
                      >
                        github.com/settings/applications/new
                      </a>{' '}
                      and fill in:
                    </p>
                    <dl className="mt-3 space-y-2 text-[13px]">
                      <div>
                        <dt className={ui.muted}>Application name</dt>
                        <dd>
                          <code className={code}>better-changelog</code> — or anything; it&apos;s shown on sign-in.
                        </dd>
                      </div>
                      <div>
                        <dt className={ui.muted}>Homepage URL</dt>
                        <dd>
                          <code className={code}>{origin}</code>
                        </dd>
                      </div>
                      <div>
                        <dt className={ui.muted}>Authorization callback URL</dt>
                        <dd>
                          <code className={code}>{callbackUrl}</code>
                        </dd>
                      </div>
                    </dl>
                    <p className={`mt-3 ${ui.muted}`}>
                      After creating, you&apos;ll get a <strong>Client ID</strong> and can generate a{' '}
                      <strong>Client Secret</strong>. Keep both handy for the next step.
                    </p>
                  </section>
                ),
              });
            }

            if (!changelogRepo) {
              steps.push({
                key: 'repo',
                render: (n) => (
                  <section
                    key="repo"
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 text-[14px]"
                  >
                    <h2 className="text-[15px] font-semibold">
                      Step {n}. Pick the repo that hosts this app
                    </h2>
                    <p className={`mt-1 ${ui.muted}`}>
                      Admin access is gated on having push permission to this repo — usually your fork of
                      better-changelog. You&apos;ll use it as the value for{' '}
                      <code className={code}>CHANGELOG_REPO</code> below.
                    </p>
                    <p className={`mt-2 ${ui.muted}`}>
                      Format: <code className={code}>owner/repo</code> (just the slug, no{' '}
                      <code className={code}>https://github.com/</code> prefix). Example:{' '}
                      <code className={code}>your-username/better-changelog</code>.
                    </p>
                  </section>
                ),
              });
            }

            steps.push({
              key: 'apply',
              render: (n) => (
                <section
                  key="apply"
                  className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 text-[14px]"
                >
                  <h2 className="text-[15px] font-semibold">
                    Step {n}. Add them in Cloudflare
                  </h2>
                  <p className={`mt-1 ${ui.muted}`}>
                    Cloudflare dashboard → <strong>Workers &amp; Pages → better-changelog → Settings →
                    Variables &amp; Secrets</strong>. Add the following (Text = plain var, Secret = encrypted):
                  </p>
                  <code className={`mt-3 ${codeBlock}`}>{`CHANGELOG_REPO        Text     your-username/better-changelog
GITHUB_CLIENT_ID      Text     Ov23li...                    (from Step 1)
GITHUB_CLIENT_SECRET  Secret   ********                     (from Step 1)
SESSION_SECRET        Secret   ********                     (openssl rand -hex 32)`}</code>
                  <p className={`mt-3 ${ui.muted}`}>
                    Then <strong>Deployments → Redeploy</strong>. Reload this page and you&apos;ll be moved on
                    to the sign-in step.
                  </p>
                </section>
              ),
            });

            const missing = [
              !changelogRepo && 'CHANGELOG_REPO',
              !clientId && 'GITHUB_CLIENT_ID',
            ].filter(Boolean) as string[];

            return (
              <div className="space-y-6">
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 text-[14px]">
                  <p>
                    Detected this instance is running at <code className={code}>{origin}</code>, but the Worker
                    is missing {missing.length > 1 ? 'these variables' : 'this variable'}:{' '}
                    {missing.map((m, i) => (
                      <span key={m}>
                        <code className={code}>{m}</code>
                        {i < missing.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    . Follow the steps below to get this instance online.
                  </p>
                </div>
                {steps.map((s, i) => s.render(i + 1))}
              </div>
            );
          })()
        ) : (
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 text-[14px]">
            <strong className="text-[var(--body-color)]">Finish setup to publish your first release.</strong>
            <p className={`mt-2 ${ui.muted}`}>
              Sign in with the GitHub account that has push access to{' '}
              <code className={code}>{changelogRepo}</code>. You&apos;ll be walked through picking the repo to
              track, the public URL for this changelog, and the GitHub webhook.
            </p>
            <div className="mt-4">
              <a className={ui.btnPrimary} href="/api/auth/login">
                Sign in with GitHub to set up
              </a>
            </div>
          </div>
        )}
      </main>
    );
  }

  const [entries, cfg] = await Promise.all([
    listEntries({ status: 'published', limit: 200 }),
    getConfig(),
  ]);
  const repo = cfg.tracked_repo;

  return (
    <main className={ui.container}>
      <header className="mb-10 flex items-baseline justify-between">
        <div>
          <h1 className={ui.h1}>Changelog</h1>
          {repo && (
            <div className={`mt-1 text-[13px] ${ui.muted}`}>
              Updates for{' '}
              <a
                className="underline underline-offset-2 hover:text-[var(--body-color)]"
                href={`https://github.com/${repo}`}
                target="_blank"
                rel="noreferrer"
              >
                {repo}
              </a>
            </div>
          )}
        </div>
        <Link className={`text-[13px] ${ui.muted} hover:text-[var(--body-color)]`} href="/admin">
          admin →
        </Link>
      </header>

      {entries.length === 0 ? (
        <div className={`py-16 text-center ${ui.muted}`}>No releases published yet.</div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)]">
          {entries.map((e) => (
            <article key={e.id} className="py-6 first:pt-0">
              <div className={`mb-2 flex items-center gap-3 text-[12px] ${ui.muted}`}>
                <span className={categoryBadgeClass(e.category)}>{e.category}</span>
                <span>{formatDate(e.published_at ?? e.merged_at)}</span>
                {e.pr_number && repo && (
                  <a
                    className="hover:text-[var(--body-color)]"
                    href={`https://github.com/${repo}/pull/${e.pr_number}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{e.pr_number}
                  </a>
                )}
              </div>
              <h2 className="mb-1.5 text-[17px] font-semibold tracking-tight">{e.title}</h2>
              {e.body && (
                <div className="whitespace-pre-wrap break-words text-[14px] text-[var(--body-color)]/85">{e.body}</div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
