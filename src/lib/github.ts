/**
 * GitHub API helpers + PR -> changelog draft heuristics.
 * Zero dependencies — just `fetch`.
 */
import type { EntryCategory } from './db';

const GH_API = 'https://api.github.com';

export interface GitHubUser {
  id: number;
  login: string;
}

export async function fetchGhUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch(`${GH_API}/user`, {
    headers: ghHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`GitHub /user failed: ${res.status}`);
  return (await res.json()) as GitHubUser;
}

/**
 * Returns `true` when the authenticated user has push (write) access on the repo.
 * Uses the `permission` endpoint, which returns one of: admin, maintain, write, triage, read, none.
 */
export async function hasRepoWriteAccess(accessToken: string, repo: string, username: string): Promise<boolean> {
  const res = await fetch(`${GH_API}/repos/${repo}/collaborators/${encodeURIComponent(username)}/permission`, {
    headers: ghHeaders(accessToken),
  });
  if (res.status === 404) return false;
  if (!res.ok) return false;
  const data = (await res.json()) as { permission?: string };
  return data.permission === 'admin' || data.permission === 'maintain' || data.permission === 'write';
}

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'better-changelog',
  };
}

/**
 * Repos the authenticated user has push access to. Used by the /setup GUI to
 * power the "which repo should we track?" picker. Caps at 100 most-recent;
 * the user can always paste a full `owner/repo` manually.
 */
export async function fetchPushableRepos(
  accessToken: string,
): Promise<{ full_name: string; default_branch: string; private: boolean }[]> {
  const res = await fetch(
    `${GH_API}/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member`,
    { headers: ghHeaders(accessToken) },
  );
  if (!res.ok) return [];
  const repos = (await res.json()) as {
    full_name: string;
    default_branch: string;
    private: boolean;
    permissions?: { push?: boolean; admin?: boolean; maintain?: boolean };
  }[];
  return repos
    .filter((r) => r.permissions?.push || r.permissions?.admin || r.permissions?.maintain)
    .map((r) => ({ full_name: r.full_name, default_branch: r.default_branch, private: r.private }));
}

/**
 * Verify a GitHub webhook payload signature (sha256 HMAC).
 */
export async function verifyWebhookSignature(
  secret: string,
  payload: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice('sha256='.length);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const actual = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(actual, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * Derive a changelog category from PR labels / conventional-commit style titles.
 * Cheap heuristics — the user can always edit in the admin UI.
 */
export function categorizePr(pr: { title: string; labels?: { name: string }[] }): EntryCategory {
  const labels = (pr.labels ?? []).map((l) => l.name.toLowerCase());
  if (labels.some((l) => l.includes('security'))) return 'security';
  if (labels.some((l) => /(^|[^a-z])(bug|fix)([^a-z]|$)/.test(l))) return 'fixed';
  if (labels.some((l) => l.includes('feature') || l.includes('enhancement'))) return 'added';
  if (labels.some((l) => l.includes('breaking') || l.includes('removal'))) return 'removed';

  const title = pr.title.toLowerCase();
  if (/^(fix|bugfix)(\(|:|\s)/.test(title)) return 'fixed';
  if (/^(feat|feature)(\(|:|\s)/.test(title)) return 'added';
  if (/^(perf|refactor|chore|docs|style)(\(|:|\s)/.test(title)) return 'changed';
  if (/^(breaking|revert)(\(|:|\s)/.test(title)) return 'removed';
  return 'changed';
}

/**
 * Strip noisy sections from PR body (e.g. "## Checklist", HTML comments) before
 * saving as a changelog draft body.
 */
export function cleanPrBody(body: string | null | undefined): string {
  if (!body) return '';
  return (
    body
      // remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // drop sections that start with common boilerplate headers
      .replace(/^#+\s*(checklist|testing|screenshots?)[\s\S]*$/im, '')
      .trim()
  );
}
