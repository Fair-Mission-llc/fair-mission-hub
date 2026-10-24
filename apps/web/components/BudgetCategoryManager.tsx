'use client';
// Sprint 9 Revision 6.0: the Budget page's 'Budget categories' panel. The council's Financial Secretary, Treasurer or
// Admins (or a Super Admin) define the council's own budget categories (CouncilBudgetCategory) here, beside the lines
// they file, instead of only under Council Lookup Tables: add a category, rename one, or delete one no line uses
// (lookups.saveCouncilSpecific / removeCouncilSpecific, the same rule as the lookup tables). Each line's category is
// picked on its row; the Budget Analyzer's Allocation Pie and spending bars group by these categories.
import { useState } from 'react';
import { describeError, type CouncilBudgetCategory } from '@kofc/shared';
import { Button, Field, Input, Notice } from '@/components/ui';
import { useUser } from '@/lib/session';
import { db } from '@/services/db';

function CategoryRow({ category, councilId, busy, run }: { category: CouncilBudgetCategory; councilId: number; busy: boolean; run: (task: () => Promise<unknown>, done: string) => Promise<void> }) {
  const user = useUser();
  const [name, setName] = useState(category.CategoryName);
  const changed = name.trim() !== category.CategoryName && name.trim() !== '';
  return (
    <li className="flex flex-wrap items-end gap-2">
      <Field label={`Category ${category.id}`} className="min-w-56 flex-1">
        {(id) => <Input id={id} value={name} maxLength={255} onChange={(e) => setName(e.target.value)} disabled={busy} />}
      </Field>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || !changed}
        onClick={() =>
          void run(() => db.lookups.saveCouncilSpecific(user.memberId, councilId, 'CouncilBudgetCategory', [{ id: category.id, CategoryName: name.trim() }]), `Renamed to ${name.trim()}.`)
        }
      >
        Rename
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={busy}
        onClick={() => void run(() => db.lookups.removeCouncilSpecific(user.memberId, councilId, 'CouncilBudgetCategory', category.id), `Deleted ${category.CategoryName}.`)}
      >
        Delete
      </Button>
    </li>
  );
}

export function BudgetCategoryManager({ councilId, categories, onChanged }: { councilId: number; categories: CouncilBudgetCategory[]; onChanged: () => Promise<void> }) {
  const user = useUser();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const run = async (task: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      await onChanged();
      setMessage({ tone: 'info', text: done });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="budget-categories" className="rounded border-2 border-navy bg-white">
      <header className="border-b-2 border-navy bg-navy px-4 py-2 text-white" data-surface="navy">
        <h2 id="budget-categories" className="font-serif text-lg font-bold">
          Budget categories
        </h2>
        <p className="text-sm">The council&apos;s own categories. Pick one on each line below; the Budget Analyzer charts group by them.</p>
      </header>
      <div className="flex flex-col gap-3 p-4">
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {categories.length === 0 ? <p className="text-sm">No categories yet. Every line is Uncategorized until you add one.</p> : null}
        <ul className="flex flex-col gap-3">
          {categories.map((c) => (
            <CategoryRow key={`${c.id}-${c.CategoryName}`} category={c} councilId={councilId} busy={busy} run={run} />
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = name.trim();
            if (!clean) return;
            void run(async () => {
              await db.lookups.saveCouncilSpecific(user.memberId, councilId, 'CouncilBudgetCategory', [{ CategoryName: clean }]);
              setName('');
            }, `Added ${clean}.`);
          }}
        >
          <Field label="New category" className="min-w-56 flex-1">
            {(id) => <Input id={id} value={name} maxLength={255} placeholder="e.g. Youth Programs" onChange={(e) => setName(e.target.value)} disabled={busy} />}
          </Field>
          <Button type="submit" disabled={busy || name.trim() === ''}>
            Add category
          </Button>
        </form>
      </div>
    </section>
  );
}
