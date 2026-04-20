/**
 * Minimal typed D1 helpers. Keep it boring and small.
 */
import { db } from './env';

export type EntryStatus = 'draft' | 'published';
export type EntryCategory = 'added' | 'changed' | 'fixed' | 'removed' | 'security';

export interface Entry {
  id: number;
  pr_number: number | null;
  commit_sha: string | null;
  title: string;
  body: string;
  category: EntryCategory;
  author: string | null;
  status: EntryStatus;
  merged_at: number | null;
  published_at: number | null;
  created_at: number;
  updated_at: number;
}

export async function listEntries(opts: { status?: EntryStatus; limit?: number } = {}): Promise<Entry[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const stmt = opts.status
    ? db()
        .prepare(
          `SELECT * FROM entries WHERE status = ?1
           ORDER BY COALESCE(published_at, merged_at, created_at) DESC
           LIMIT ?2`,
        )
        .bind(opts.status, limit)
    : db()
        .prepare(
          `SELECT * FROM entries
           ORDER BY COALESCE(published_at, merged_at, created_at) DESC
           LIMIT ?1`,
        )
        .bind(limit);
  const res = await stmt.all<Entry>();
  return res.results ?? [];
}

export async function getEntry(id: number): Promise<Entry | null> {
  const row = await db().prepare(`SELECT * FROM entries WHERE id = ?1`).bind(id).first<Entry>();
  return row ?? null;
}

export async function getEntryByPr(prNumber: number): Promise<Entry | null> {
  const row = await db().prepare(`SELECT * FROM entries WHERE pr_number = ?1`).bind(prNumber).first<Entry>();
  return row ?? null;
}

export async function insertDraftFromPr(input: {
  pr_number: number;
  commit_sha: string | null;
  title: string;
  body: string;
  category: EntryCategory;
  author: string | null;
  merged_at: number | null;
}): Promise<number> {
  const res = await db()
    .prepare(
      `INSERT INTO entries (pr_number, commit_sha, title, body, category, author, merged_at, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'draft')
       ON CONFLICT(pr_number) DO UPDATE SET
         commit_sha = excluded.commit_sha,
         merged_at  = excluded.merged_at,
         updated_at = unixepoch()
       RETURNING id`,
    )
    .bind(input.pr_number, input.commit_sha, input.title, input.body, input.category, input.author, input.merged_at)
    .first<{ id: number }>();
  if (!res) throw new Error('insert failed');
  return res.id;
}

export async function updateEntry(
  id: number,
  patch: Partial<Pick<Entry, 'title' | 'body' | 'category' | 'status'>>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?${i++}`);
    values.push(v);
  }
  if (!fields.length) return;
  fields.push(`updated_at = unixepoch()`);
  if (patch.status === 'published') {
    fields.push(`published_at = COALESCE(published_at, unixepoch())`);
  }
  values.push(id);
  await db()
    .prepare(`UPDATE entries SET ${fields.join(', ')} WHERE id = ?${i}`)
    .bind(...values)
    .run();
}

export async function deleteEntry(id: number): Promise<void> {
  await db().prepare(`DELETE FROM entries WHERE id = ?1`).bind(id).run();
}
