# better-changelog

Self-hostable changelog app. Connect a GitHub repo, pick your production branch, and every merged PR becomes a **draft changelog entry** waiting for your approval. Hit "Approve & publish" and it appears on a clean public page at your own subdomain (e.g. `changelog.yoursite.com`).

Runs entirely on **Cloudflare Workers + D1** via [`@opennextjs/cloudflare`](https://github.com/opennextjs/opennextjs-cloudflare). Lightweight. Fits the Cloudflare free tier.

---

## Deploy your own (one click)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ryanshahine/better-changelog)

The [Deploy to Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/) button will:

1. Fork this repo into the user's GitHub account.
2. Auto-provision a fresh **D1 database** and rewrite `wrangler.jsonc` with its ID.
3. Prompt for the 4 values declared in `package.json#cloudflare.bindings`:
   - `CHANGELOG_REPO` — the fork itself, e.g. `you/better-changelog`. Gates admin access.
   - `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` — from a GitHub OAuth App you create ([see below](#1-create-a-github-oauth-app)).
   - `SESSION_SECRET` — any random string (`openssl rand -hex 32`).
4. Run `npm run deploy`, which applies D1 migrations and deploys the Worker.

After deploy the app lives at `better-changelog-<id>.<you>.workers.dev`. Visit the root URL and you'll be walked through the rest of setup via a GUI — no more editing files.

---

## First-run setup (GUI)

Everything that isn't absolutely required at deploy time lives in D1 and is edited via `/setup`:

1. Visit the app's root URL.
2. Click **Sign in with GitHub to set up**.
3. You'll be gated on having push access to `CHANGELOG_REPO` (the fork). If yes, you're sent to the `/setup` wizard:
   - **Tracked repo** — autocomplete picker of every GitHub repo you can push to. Auto-fills the default branch.
   - **App URL** — e.g. `https://changelog.yoursite.com`. Used for OAuth callbacks and the webhook URL.
   - **Webhook** — the wizard generates a secret and shows the exact Payload URL + deep-links to `github.com/{repo}/settings/hooks/new`. Paste and save.
4. Done. Merged PRs on the tracked branch will show up as drafts in `/admin`.

You can revisit `/setup` any time to change the tracked repo, rotate the webhook secret, or update the app URL.

---

## Custom subdomain (`changelog.yoursite.com`)

Cloudflare Workers support free custom domains, as long as the parent zone (`yoursite.com`) is on Cloudflare DNS.

1. Cloudflare Dashboard → **Workers & Pages → better-changelog → Settings → Domains & Routes → Add → Custom Domain**.
2. Enter `changelog.yoursite.com`. Cloudflare creates the DNS record and issues a cert automatically.
3. In your **GitHub OAuth App**, set the Authorization callback URL to `https://changelog.yoursite.com/api/auth/callback`.
4. In `/setup`, update **App URL** to `https://changelog.yoursite.com`.

---

## How it works

```
Merged PR on tracked branch ──► /api/webhooks/github ──► D1 draft row
                                                            │
                                                            ▼
                                                      Admin approves
                                                            │
                                                            ▼
                                                    Published changelog
```

- **Webhook** ([`/api/webhooks/github`](src/app/api/webhooks/github/route.ts)) verifies the `X-Hub-Signature-256` HMAC (timing-safe), drops events whose base branch isn't the configured production branch, and rejects payloads from any repo other than the tracked one. All three values come from D1 config.
- **Admin UI** ([`/admin`](src/app/admin/page.tsx)) is gated by GitHub OAuth **and** a live `repos/{repo}/collaborators/{user}/permission` check against `CHANGELOG_REPO` (the fork itself). Only users with `write` / `maintain` / `admin` on the fork can approve drafts. Revoking access on GitHub locks them out on the next request.
- **Public page** ([`/`](src/app/page.tsx)) renders published entries only, server-rendered from D1. Shows the setup prompt instead of a blank page if the app hasn't been configured yet.
- **Sessions** are opaque tokens in an httpOnly cookie, stored in a `sessions` D1 table.

---

## Setup checklist

### 1. Create a GitHub OAuth App
<https://github.com/settings/developers> → **New OAuth App**
- **Homepage URL**: your app URL (e.g. `https://changelog.yoursite.com`)
- **Authorization callback URL**: `<app-url>/api/auth/callback`

Copy the Client ID (public) and Client Secret (secret). The deploy button will ask for both.

### 2. Deploy
Click the Deploy to Cloudflare button above and fill in the 4 values it asks for.

### 3. Visit the app and finish setup in the GUI
The `/setup` wizard walks you through picking the tracked repo and installing the webhook. No file edits required.

---

## Manual deploy (without the button)

```bash
# public vars — edit wrangler.jsonc > vars
CHANGELOG_REPO     # "you/better-changelog" (the fork itself — gates admin access)
GITHUB_CLIENT_ID   # "Ov23li..."

# secrets — one per command
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SESSION_SECRET

npm run deploy     # build + migrate + deploy
```

Then visit the app URL and run through `/setup`.

---

## Local development

```bash
npm install

# One-time: create your D1 DB locally and point wrangler.jsonc at it
npx wrangler d1 create better-changelog-db

# Secrets for `next dev`
cp .dev.vars.example .dev.vars     # fill in OAuth id/secret, session secret, CHANGELOG_REPO

# Run migrations locally
npm run db:migrations:apply:local

# Start Next (dev server gets D1 bindings via initOpenNextCloudflareForDev)
npm run dev

# Or run the full Workers runtime preview
npm run preview
```

---

## Security notes

- Webhook requests rejected unless HMAC matches the D1-stored `webhook_secret` (timing-safe compare).
- Admin mutations re-check GitHub write access to `CHANGELOG_REPO` on every request.
- `/setup` additionally re-verifies write access to the chosen tracked repo before saving.
- OAuth `state` is bound to an httpOnly cookie.
- Access tokens live in D1 only for the session lifetime, scoped to `read:user repo`.
- Webhook refuses payloads from any repo other than the configured tracked repo.

## Cost / scale

Expected to fit comfortably on the Cloudflare free tier:
- **Workers Free**: 100k req/day — far more than any changelog needs.
- **D1 Free**: 5M row reads/day, 100k writes/day, 5GB storage.
- **Custom domain**: free, as long as the parent zone is on Cloudflare DNS.

## Stack

- [Next.js 15 / App Router](https://nextjs.org) — server components + minimal client JS
- [Tailwind CSS v4](https://tailwindcss.com) — zero config, via `@tailwindcss/postcss`
- [`@opennextjs/cloudflare`](https://github.com/opennextjs/opennextjs-cloudflare) — Next → Workers adapter
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — SQLite on Workers

## License

MIT
