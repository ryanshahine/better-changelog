import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/** Kick off GitHub OAuth. */
export async function GET(req: NextRequest) {
  const e = env();
  const clientId = e.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GITHUB_CLIENT_ID not configured' }, { status: 500 });
  }
  const state = crypto.randomUUID();
  const appUrl = new URL(req.url).origin;
  const redirectUri = `${appUrl}/api/auth/callback`;

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read:user repo');
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'false');

  const res = NextResponse.redirect(url.toString());
  res.cookies.set({
    name: 'bc_oauth_state',
    value: state,
    httpOnly: true,
    sameSite: 'lax',
    secure: appUrl.startsWith('https://'),
    path: '/',
    maxAge: 600,
  });
  return res;
}
