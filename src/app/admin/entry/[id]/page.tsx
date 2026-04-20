import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { checkAdmin } from '@/lib/auth';
import { getEntry } from '@/lib/db';
import { ui } from '@/lib/ui';
import EntryEditor from './EntryEditor';

export const dynamic = 'force-dynamic';

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await checkAdmin();
  if (!gate.ok) redirect('/admin');

  const { id } = await params;
  const entry = await getEntry(Number(id));
  if (!entry) notFound();

  return (
    <main className={ui.container}>
      <header className="mb-10 flex items-baseline justify-between">
        <h1 className={ui.h1}>{entry.status === 'draft' ? 'Review draft' : 'Edit entry'}</h1>
        <Link className={`text-[13px] ${ui.muted} hover:text-[var(--body-color)]`} href="/admin">
          ← back
        </Link>
      </header>
      <EntryEditor entry={entry} />
    </main>
  );
}
