import Link from 'next/link';
import { redirect } from 'next/navigation';
import { checkAdmin } from '@/lib/auth';
import { listEntries } from '@/lib/db';
import { env } from '@/lib/env';
import { getConfig, isConfigured } from '@/lib/config';
import { categoryBadgeClass, ui } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const gate = await checkAdmin();
  const changelogRepo = env().CHANGELOG_REPO;

  if (!gate.ok) {
    return (
      <main className={ui.container}>
        <header className="mb-10 flex items-baseline justify-between">
          <h1 className={ui.h1}>Admin</h1>
          <Link className={`text-[13px] ${ui.muted} hover:text-[var(--body-color)]`} href="/">
            public changelog →
          </Link>
        </header>
        <div
          className={`rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-6 text-[14px] ${ui.muted}`}
        >
          {gate.reason === 'misconfigured' ? (
            <>
              <strong className="text-[var(--body-color)]">App not configured.</strong> Set{' '}
              <code className="rounded bg-[var(--border-soft)] px-1.5 py-0.5 text-[12px]">CHANGELOG_REPO</code>{' '}
              (and OAuth client id/secret + session secret) on your Worker, then redeploy.
            </>
          ) : gate.reason === 'no-access' ? (
            <>
              You&apos;re signed in, but your GitHub account doesn&apos;t have write access to{' '}
              <code className="rounded bg-[var(--border-soft)] px-1.5 py-0.5 text-[12px]">{changelogRepo}</code>.
              Only people who can push to this changelog repo can manage it.
              <div className="mt-4">
                <a className={ui.btn} href="/api/auth/logout">
                  Sign out
                </a>
              </div>
            </>
          ) : (
            <>
              Sign in with GitHub to manage changelog entries. Only users with write access to{' '}
              <code className="rounded bg-[var(--border-soft)] px-1.5 py-0.5 text-[12px]">
                {changelogRepo || 'this changelog repo'}
              </code>{' '}
              will be allowed in.
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

  // Signed-in admin but app not yet set up? Send them through the wizard.
  if (!(await isConfigured())) {
    redirect('/setup');
  }

  const [drafts, published, cfg] = await Promise.all([
    listEntries({ status: 'draft', limit: 100 }),
    listEntries({ status: 'published', limit: 20 }),
    getConfig(),
  ]);

  return (
    <main className={ui.container}>
      <header className="mb-10 flex items-baseline justify-between">
        <div>
          <h1 className={ui.h1}>Admin</h1>
          <div className={`mt-1 text-[13px] ${ui.muted}`}>
            Signed in as{' '}
            <span className="font-semibold text-[var(--body-color)]">{gate.session.github_login}</span> ·{' '}
            <a className="hover:text-[var(--body-color)]" href="/api/auth/logout">
              sign out
            </a>
            {' · '}
            <Link href="/setup" className="hover:text-[var(--body-color)]">
              settings
            </Link>
          </div>
        </div>
        <Link className={`text-[13px] ${ui.muted} hover:text-[var(--body-color)]`} href="/">
          public changelog →
        </Link>
      </header>

      <h2 className={`mb-3 ${ui.h2}`}>Drafts ({drafts.length})</h2>
      <div className="grid gap-3">
        {drafts.length === 0 && (
          <div
            className={`rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-5 text-[14px] ${ui.muted}`}
          >
            No drafts yet. Drafts appear here automatically when PRs are merged into{' '}
            <code className="rounded bg-[var(--border-soft)] px-1.5 py-0.5 text-[12px]">
              {cfg.tracked_repo}:{cfg.prod_branch}
            </code>
            .
          </div>
        )}
        {drafts.map((e) => (
          <Link key={e.id} href={`/admin/entry/${e.id}`} className={`${ui.card} block no-underline`}>
            <div className="flex items-center justify-between">
              <span className={categoryBadgeClass(e.category)}>{e.category}</span>
              <span className={`text-[12px] ${ui.muted}`}>
                {e.pr_number ? `#${e.pr_number}` : 'manual'}
                {e.author ? ` · ${e.author}` : ''}
              </span>
            </div>
            <h3 className="mt-2 text-[15px] font-semibold tracking-tight">{e.title}</h3>
          </Link>
        ))}
      </div>

      <h2 className={`mt-12 mb-3 ${ui.h2}`}>Recently published</h2>
      <div className="grid gap-3">
        {published.map((e) => (
          <Link key={e.id} href={`/admin/entry/${e.id}`} className={`${ui.card} block no-underline`}>
            <div className="flex items-center justify-between">
              <span className={categoryBadgeClass(e.category)}>{e.category}</span>
              <span className={`text-[12px] ${ui.muted}`}>
                {e.published_at ? new Date(e.published_at * 1000).toLocaleDateString() : ''}
              </span>
            </div>
            <h3 className="mt-2 text-[15px] font-semibold tracking-tight">{e.title}</h3>
          </Link>
        ))}
      </div>
    </main>
  );
}
