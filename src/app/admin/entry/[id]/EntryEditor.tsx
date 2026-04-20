'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Entry, EntryCategory } from '@/lib/db';
import { ui } from '@/lib/ui';

const CATEGORIES: EntryCategory[] = ['added', 'changed', 'fixed', 'removed', 'security'];

export default function EntryEditor({ entry }: { entry: Entry }) {
  const router = useRouter();
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [category, setCategory] = useState<EntryCategory>(entry.category);
  const [status, setStatus] = useState(entry.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function save(nextStatus?: 'draft' | 'published') {
    setError(null);
    const res = await fetch(`/api/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, category, status: nextStatus ?? status }),
    });
    if (!res.ok) {
      setError(`Save failed: ${res.status}`);
      return;
    }
    if (nextStatus) setStatus(nextStatus);
    startTransition(() => router.refresh());
  }

  async function remove() {
    if (!confirm('Delete this entry?')) return;
    const res = await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin');
  }

  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-5">
      <label className={ui.label}>Title</label>
      <input className={ui.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />

      <label className={ui.label}>Category</label>
      <select className={ui.input} value={category} onChange={(e) => setCategory(e.target.value as EntryCategory)}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label className={ui.label}>Body (markdown)</label>
      <textarea
        className={`${ui.input} min-h-[180px] resize-y font-mono text-[13px]`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      {error && <div className="mt-2 text-[13px] text-red-500">{error}</div>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className={`text-[12px] ${ui.muted}`}>
          Status: <strong className="text-[var(--body-color)]">{status}</strong>
          {entry.pr_number && <> · PR #{entry.pr_number}</>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={ui.btnDanger} onClick={remove} disabled={pending}>
            Delete
          </button>
          <button className={ui.btn} onClick={() => save()} disabled={pending}>
            Save
          </button>
          {status === 'draft' ? (
            <button className={ui.btnPrimary} onClick={() => save('published')} disabled={pending}>
              Approve &amp; publish
            </button>
          ) : (
            <button className={ui.btn} onClick={() => save('draft')} disabled={pending}>
              Unpublish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
