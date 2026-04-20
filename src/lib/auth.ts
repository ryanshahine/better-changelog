/**
 * Session auth.
 *
 * Flow:
 *   1. GET /api/auth/login  -> redirect to github.com/login/oauth/authorize
 *   2. GitHub -> /api/auth/callback?code=...&state=...
 *   3. We exchange code for access_token, fetch user, create row in `sessions`,
 *      and set a signed httpOnly cookie holding the opaque session id.
 *
 * Authorization model:
 *   - The user is "admin" iff they have push/maintain/admin access to
 *     env.CHANGELOG_REPO (the fork of better-changelog itself).
 *   - This is checked live on every request, so revoking collaborator access
 *     in GitHub immediately locks the user out.
 *
 * Why the changelog repo? Because the user deployed this via the CF "Deploy to
 * Cloudflare" button, which forks better-changelog into their own account.
 * Anyone who can push to that fork is trusted by definition — no separate
 * setup-token dance required.
 */
import { cookies } from 'next/headers';
import { db, env } from './env';
import { fetchGhUser, hasRepoWriteAccess } from './github';

const COOKIE = 'bc_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface Session {
  id: string;
  github_login: string;
  github_id: number;
  access_token: string;
  expires_at: number;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(opts: {
  githubLogin: string;
  githubId: number;
  accessToken: string;
}): Promise<string> {
  const id = randomToken();
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await db()
    .prepare(
      `INSERT INTO sessions (id, github_login, github_id, access_token, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(id, opts.githubLogin, opts.githubId, opts.accessToken, expires)
    .run();
  return id;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const row = await db()
    .prepare(`SELECT * FROM sessions WHERE id = ?1 AND expires_at > unixepoch()`)
    .bind(raw)
    .first<Session>();
  return row ?? null;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    await db().prepare(`DELETE FROM sessions WHERE id = ?1`).bind(raw).run();
  }
  jar.delete(COOKIE);
}

export function sessionCookieOptions(secure: boolean) {
  return {
    name: COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export { COOKIE as SESSION_COOKIE_NAME };

/**
 * Authorization gate for the admin UI & mutation endpoints.
 * The user must have write access to env.CHANGELOG_REPO (the fork itself).
 */
export async function checkAdmin(): Promise<
  { ok: true; session: Session } | { ok: false; reason: 'no-session' | 'no-access' | 'misconfigured' }
> {
  const repo = env().CHANGELOG_REPO;
  if (!repo) return { ok: false, reason: 'misconfigured' };
  // Guard against the common mis-input of a full GitHub URL; `owner/repo` only.
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false, reason: 'misconfigured' };
  const session = await getSession();
  if (!session) return { ok: false, reason: 'no-session' };
  const ok = await hasRepoWriteAccess(session.access_token, repo, session.github_login);
  if (!ok) return { ok: false, reason: 'no-access' };
  return { ok: true, session };
}

/** Tiny helper for the OAuth callback. */
export async function loadGhUser(accessToken: string) {
  return fetchGhUser(accessToken);
}

/** Sweep expired sessions. Cheap — call from infrequent paths. */
export async function gcSessions(): Promise<void> {
  await db().prepare(`DELETE FROM sessions WHERE expires_at <= unixepoch()`).run();
}
