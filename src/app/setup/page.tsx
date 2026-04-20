import { redirect } from 'next/navigation';
import Link from 'next/link';
import { checkAdmin } from '@/lib/auth';
import { getConfig, generateWebhookSecret } from '@/lib/config';
import { fetchPushableRepos } from '@/lib/github';
import { env } from '@/lib/env';
import { ui } from '@/lib/ui';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const gate = await checkAdmin();
  const changelogRepo = env().CHANGELOG_REPO;

  if (!gate.ok) {
    return (
      <main className={ui.container}>
        <header className="mb-10">
          <h1 className={ui.h1}>Setup</h1>
          <p className={`mt-2 text-[14px] ${ui.muted}`}>
            Configuration for this changelog. Gated by GitHub write access to{' '}
            <code className="rounded bg-[var(--border-soft)] px-1.5 py-0.5 text-[12px]">
              {changelogRepo || 'the app repo'}
            </code>
            .
          </p>
        </header>
        <div className={`rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 text-[14px] ${ui.muted}`}>
          {gate.reason === 'misconfigured' ? (
            <>
              <strong className="text-[var(--body-color)]">Missing deploy-time config.</strong> Set the{' '}
              <code className="rounded bg-[var(--border-soft)] px-1.5 py-0.5 text-[12px]">CHANGELOG_REPO</code> var on
              your Worker and redeploy.
            </>
          ) : gate.reason === 'no-access' ? (
            <>
              Your GitHub account doesn&apos;t have write access to{' '}
              <code className="rounded bg-[var(--border-soft)] px-1.5 py-0.5 text-[12px]">{changelogRepo}</code>.
              <div className="mt-4">
                <a className={ui.btn} href="/api/auth/logout">
                  Sign out
                </a>
              </div>
            </>
          ) : (
            <>
              Sign in with GitHub to continue.
              <div className="mt-4">
                <a className={ui.btnPrimary} href="/api/auth/login">
                  Sign in with GitHub
                </a>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  const [cfg, repos] = await Promise.all([
    getConfig(),
    fetchPushableRepos(gate.session.access_token),
  ]);

  const initialSecret = cfg.webhook_secret ?? generateWebhookSecret();
  const firstRun = !cfg.tracked_repo;

  return (
    <main className={ui.container}>
      <header className="mb-10 flex items-baseline justify-between">
        <div>
          <h1 className={ui.h1}>{firstRun ? 'Welcome — set up your changelog' : 'Settings'}</h1>
          <div className={`mt-1 text-[13px] ${ui.muted}`}>
            Signed in as{' '}
            <span className="font-semibold text-[var(--body-color)]">{gate.session.github_login}</span>
          </div>
        </div>
        <Link className={`text-[13px] ${ui.muted} hover:text-[var(--body-color)]`} href="/admin">
          ← admin
        </Link>
      </header>

      <SetupForm
        initial={{
          tracked_repo: cfg.tracked_repo ?? '',
          prod_branch: cfg.prod_branch ?? 'main',
          app_url: cfg.app_url ?? '',
          webhook_secret: initialSecret,
        }}
        repos={repos}
        firstRun={firstRun}
      />
    </main>
  );
}
