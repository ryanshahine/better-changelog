/**
 * Small, reused class-name helpers. We keep these centralized so the whole UI
 * has a consistent look without needing a component library.
 */
export const ui = {
  container: 'mx-auto w-full max-w-[760px] px-6 py-12 sm:py-16',
  card: 'rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] p-5 transition hover:border-[var(--body-color)]/20',
  btn: 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] px-3.5 py-1.5 text-[13px] font-medium transition hover:border-[var(--body-color)]/30 disabled:opacity-50',
  btnPrimary:
    'inline-flex items-center gap-1.5 rounded-lg border border-[var(--body-color)] bg-[var(--body-color)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--body-bg)] transition hover:opacity-90 disabled:opacity-50',
  btnDanger:
    'inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-transparent px-3.5 py-1.5 text-[13px] font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50',
  input:
    'block w-full rounded-lg border border-[var(--border-soft)] bg-transparent px-3 py-2 text-[14px] text-[var(--body-color)] placeholder-[var(--muted)] focus:border-[var(--body-color)]/40 focus:outline-none',
  label: 'mb-1 mt-4 block text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]',
  muted: 'text-[var(--muted)]',
  h1: 'text-2xl font-semibold tracking-tight sm:text-[28px]',
  h2: 'text-base font-semibold tracking-tight',
};

const CATEGORY_CLASSES: Record<string, string> = {
  added: 'text-emerald-500 border-emerald-500/40',
  changed: 'text-indigo-500 border-indigo-500/40',
  fixed: 'text-amber-500 border-amber-500/40',
  removed: 'text-rose-500 border-rose-500/40',
  security: 'text-red-500 border-red-500/40',
};

export function categoryBadgeClass(category: string): string {
  return `inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
    CATEGORY_CLASSES[category] ?? 'text-[var(--muted)] border-[var(--border-soft)]'
  }`;
}
