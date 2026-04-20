/**
 * Runtime config stored in D1 (table `config`). Everything a user would normally
 * need to put in env vars — tracked repo, prod branch, webhook secret, public
 * app URL — lives here and is edited via `/setup`.
 *
 * The only things that remain env-only are things the deploy button must set
 * before the Worker can run at all: GitHub OAuth Client ID/Secret, session
 * secret, and CHANGELOG_REPO (so we can gate /setup itself).
 */
import { db } from "./env";

export type ConfigKey =
  | "tracked_repo"
  | "prod_branch"
  | "app_url"
  | "webhook_secret";

export interface AppConfig {
  tracked_repo: string;
  prod_branch: string;
  app_url: string;
  webhook_secret: string;
}

export async function getConfig(): Promise<Partial<AppConfig>> {
  const rows = await db()
    .prepare(`SELECT key, value FROM config`)
    .all<{ key: ConfigKey; value: string }>();
  const out: Partial<AppConfig> = {};
  for (const r of rows.results ?? []) out[r.key] = r.value;
  return out;
}

export async function isConfigured(): Promise<boolean> {
  const cfg = await getConfig();
  return Boolean(cfg.tracked_repo && cfg.prod_branch && cfg.webhook_secret);
}

export async function setConfig(patch: Partial<AppConfig>): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => typeof v === "string" && v.length > 0);
  if (entries.length === 0) return;
  // D1 supports batch for atomic writes.
  const stmts = entries.map(([k, v]) =>
    db()
      .prepare(
        `INSERT INTO config (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
      )
      .bind(k, v),
  );
  await db().batch(stmts);
}

export async function getConfigValue(key: ConfigKey): Promise<string | null> {
  const row = await db()
    .prepare(`SELECT value FROM config WHERE key = ?1`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

/** Generate a webhook secret on first setup. 32 bytes of randomness. */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
