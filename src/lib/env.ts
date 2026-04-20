import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Resolve the Cloudflare env (D1, vars, secrets) from within a Next.js
 * route handler, server component, or server action.
 */
export function env(): CloudflareEnv {
  return getCloudflareContext().env as CloudflareEnv;
}

export function db(): D1Database {
  return env().DB;
}
