'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ui } from '@/lib/ui';

export interface Repo {
  full_name: string;
  default_branch: string;
  private: boolean;
}

export default function SetupForm({
  initial,
  repos,
  firstRun,
}: {
  initial: { tracked_repo: string; prod_branch: string; app_url: string; webhook_secret: string };
  repos: Repo[];
  firstRun: boolean;
}) {
  const router = useRouter();
  const [trackedRepo, setTrackedRepo] = useState(initial.tracked_repo);
  const [prodBranch, setProdBranch] = useState(initial.prod_branch);
  const [appUrl, setAppUrl] = useState(
    initial.app_url || (typeof window !== 'undefined' ? window.location.origin : ''),
  );
  const [webhookSecret, setWebhookSecret] = useState(initial.webhook_secret);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const webhookUrl = useMemo(() => {
    const base = appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base.replace(/\/$/, '')}/api/webhooks/github`;
  }, [appUrl]);

  const pickedRepo = useMemo(
    () => repos.find((r) => r.full_name === trackedRepo),
    [repos, trackedRepo],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracked_repo: trackedRepo.trim(),
          prod_branch: prodBranch.trim() || 'main',
          app_url: appUrl.trim(),
          webhook_secret: webhookSecret.trim(),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSaved(true);
      router.refresh();
      if (firstRun) router.push('/admin');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-5">
        <h2 className={`${ui.h2} mb-1`}>1. Repo to track</h2>
        <p className={`mb-4 text-[13px] ${ui.muted}`}>
          Merged PRs on this repo&apos;s production branch become changelog drafts.
        </p>

        <label className={ui.label}>Repository</label>
        <input
          className={ui.input}
          list="repo-suggestions"
          placeholder="owner/repo"
          value={trackedRepo}
          onChange={(e) => {
            setTrackedRepo(e.target.value);
            const match = repos.find((r) => r.full_name === e.target.value);
            if (match) setProdBranch(match.default_branch);
          }}
          required
        />
        <datalist id="repo-suggestions">
          {repos.map((r) => (
            <option key={r.full_name} value={r.full_name}>
              {r.private ? 'private' : 'public'} · default: {r.default_branch}
            </option>
          ))}
        </datalist>

        <label className={ui.label}>Production branch</label>
        <input
          className={ui.input}
          value={prodBranch}
          onChange={(e) => setProdBranch(e.target.value)}
          placeholder={pickedRepo?.default_branch ?? 'main'}
          required
        />
      </section>

      <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-5">
        <h2 className={`${ui.h2} mb-1`}>2. Public URL</h2>
        <p className={`mb-4 text-[13px] ${ui.muted}`}>
          Where users will read the changelog. Used to build webhook and OAuth callback URLs.
        </p>
        <label className={ui.label}>App URL (no trailing slash)</label>
        <input
          className={ui.input}
          type="url"
          placeholder="https://changelog.yoursite.com"
          value={appUrl}
          onChange={(e) => setAppUrl(e.target.value)}
          required
        />
      </section>

      <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-5">
        <h2 className={`${ui.h2} mb-1`}>3. GitHub webhook</h2>
        <p className={`mb-4 text-[13px] ${ui.muted}`}>
          Save this page first, then add a webhook to{' '}
          {trackedRepo ? (
            <a
              className="underline underline-offset-2 hover:text-[var(--body-color)]"
              href={`https://github.com/${trackedRepo}/settings/hooks/new`}
              target="_blank"
              rel="noreferrer"
            >
              {trackedRepo}
            </a>
          ) : (
            'your tracked repo'
          )}{' '}
          with the values below. Events: <strong>Pull requests</strong>.
        </p>

        <label className={ui.label}>Payload URL (copy to GitHub)</label>
        <input className={ui.input} value={webhookUrl} readOnly />

        <label className={ui.label}>Secret (copy to GitHub)</label>
        <div className="flex gap-2">
          <input className={ui.input} value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
          <button
            type="button"
            className={ui.btn}
            onClick={() => {
              const bytes = new Uint8Array(32);
              crypto.getRandomValues(bytes);
              setWebhookSecret(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));
            }}
          >
            Regenerate
          </button>
        </div>
      </section>

      {error && <div className="text-[13px] text-red-500">{error}</div>}
      {saved && !error && <div className="text-[13px] text-emerald-500">Saved.</div>}

      <div className="flex items-center gap-3">
        <button type="submit" className={ui.btnPrimary} disabled={saving}>
          {saving ? 'Saving…' : firstRun ? 'Finish setup' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
