import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { createSession, loadGhUser, sessionCookieOptions } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const e = env();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get('bc_oauth_state')?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: 'invalid_oauth_state' }, { status: 400 });
  }
  if (!e.GITHUB_CLIENT_ID || !e.GITHUB_CLIENT_SECRET) {
    return NextResponse.json({ error: 'oauth_not_configured' }, { status: 500 });
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: e.GITHUB_CLIENT_ID,
      client_secret: e.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'token_exchange_failed' }, { status: 502 });
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) {
    return NextResponse.json({ error: tokenJson.error ?? 'no_access_token' }, { status: 502 });
  }

  const user = await loadGhUser(tokenJson.access_token);
  const sessionId = await createSession({
    githubLogin: user.login,
    githubId: user.id,
    accessToken: tokenJson.access_token,
  });

  const secure = url.origin.startsWith('https://');
  const res = NextResponse.redirect(`${url.origin}/admin`);
  const opts = sessionCookieOptions(secure);
  res.cookies.set({ ...opts, value: sessionId });
  res.cookies.delete('bc_oauth_state');
  return res;
}
