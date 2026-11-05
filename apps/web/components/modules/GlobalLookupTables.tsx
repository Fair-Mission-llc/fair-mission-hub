'use client';
// System Lookups: one tab per global table, one generic grid driven by LOOKUP_META. Super Admins only.
// Rows the application looks up by name (e.g. member status "Active") are marked built-in and cannot be
// renamed or deleted; a row still referenced elsewhere cannot be deleted and the message says where.
// Rows come from lookups.listForMaintenance, and the drivers enforce the same tier on that read and every write
// (SUPER_ADMIN_REQUIRED), so hiding the page is not the only gate. Drop-downs elsewhere keep the open lookups.list.
// Sprint 7C Extension: the Global Council Parameters Dashboard (Sprint 6I) and the Platform Limits card (Sprint 7C) moved
// to their own page, Global System Parameters (/system-settings/global-settings).
import { useState } from 'react';
import { describeError, LOOKUP_META, LOOKUP_TABLE_ORDER, parentOrgScopeLabel, type LookupTableName, type LookupValues, type ParentOrganizationRecord } from '@kofc/shared';
import { ParentOrgTierSelect, useParentOrganizations } from '@/components/ParentOrganizationParts';

import { Button, cx, Empty, Input, Notice, PageTitle, Pill, Table, Tabs, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Row = { id: number } & Record<string, unknown>;

const blankFor = (table: LookupTableName): LookupValues =>
  Object.fromEntries(LOOKUP_META[table].fields.map((f) => [f.key, f.kind === 'flag' ? 0 : '']));

function LookupGrid({ table, tier, orgs }: { table: LookupTableName; tier: number | null; orgs: readonly ParentOrganizationRecord[] }) {
  const user = useUser();
  const meta = LOOKUP_META[table];
  // Sprint 11 Revision 19.6: the shared rows (parent_org_id NULL), or one parent organization's own rows only.
  const rows = useLoad(
    async () => ((await db.lookups.listForMaintenance(user.memberId, table)) as unknown as Row[]).filter((r) => ((r.parent_org_id as number | null | undefined) ?? null) === tier),
    [user.memberId, table, tier],
  );
  const [adding, setAdding] = useState<LookupValues>(() => blankFor(table));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<LookupValues>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const run = async (action: () => Promise<void>, done: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'info', text: done });
      await rows.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    }
  };

  const isBuiltIn = (row: Row) => meta.protectedValues.some((v) => v.toLowerCase() === String(row[meta.keyField]).toLowerCase());

  const editor = (values: LookupValues, set: (v: LookupValues) => void, onEnter: () => void, onEscape?: () => void) =>
    meta.fields.map((f) => (
      <Td key={f.key}>
        {f.kind === 'flag' ? (
          <input
            type="checkbox"
            aria-label={f.label}
            checked={values[f.key] === 1}
            onChange={(e) => set({ ...values, [f.key]: e.target.checked ? 1 : 0 })}
          />
        ) : (
          <Input
            aria-label={f.label}
            value={String(values[f.key] ?? '')}
            maxLength={f.maxLength}
            className={f.kind === 'code' ? 'w-16 uppercase' : undefined}
            onChange={(e) => set({ ...values, [f.key]: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEnter();
              if (e.key === 'Escape') onEscape?.();
            }}
          />
        )}
      </Td>
    ));

  const add = () =>
    run(async () => {
      await db.lookups.create(user.memberId, table, adding, tier);
      setAdding(blankFor(table));
    }, `Added to ${meta.label} (${parentOrgScopeLabel(orgs, tier)}).`);

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {rows.error ? <Notice tone="error">{rows.error}</Notice> : null}

      <Table caption={`${meta.label} lookup rows: ${parentOrgScopeLabel(orgs, tier)}`} head={['ID', ...meta.fields.map((f) => f.label), 'Status', 'Actions']}>
        <tr className="bg-white">
          <Td className="text-muted">new</Td>
          {editor(adding, setAdding, () => void add())}
          <Td />
          <Td>
            <Button size="sm" onClick={() => void add()}>
              Add row
            </Button>
          </Td>
        </tr>
        {(rows.data ?? []).map((row) => {
          const editing = editingId === row.id;
          const builtIn = isBuiltIn(row);
          return (
            <tr key={row.id} className={cx(editing && 'bg-white outline outline-2 -outline-offset-2 outline-gold')}>
              <Td className="text-muted">{row.id}</Td>
              {editing
                ? editor(
                    draft,
                    setDraft,
                    () => void run(async () => { await db.lookups.update(user.memberId, table, row.id, draft); setEditingId(null); }, 'Saved.'),
                    () => setEditingId(null),
                  )
                : meta.fields.map((f) => (
                    <Td key={f.key}>{f.kind === 'flag' ? (row[f.key] === 1 ? 'Yes' : 'No') : String(row[f.key] ?? '')}</Td>
                  ))}
              <Td>{builtIn ? <Pill tone="outline">Built in</Pill> : null}</Td>
              <Td>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={() => void run(async () => { await db.lookups.update(user.memberId, table, row.id, draft); setEditingId(null); }, 'Saved.')}>
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : confirmId === row.id ? (
                    <>
                      <Button size="sm" variant="danger" onClick={() => void run(async () => { await db.lookups.remove(user.memberId, table, row.id); setConfirmId(null); }, 'Deleted.')}>
                        Confirm delete
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(row.id);
                          setDraft(Object.fromEntries(meta.fields.map((f) => [f.key, row[f.key] as string | number])));
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="secondary" disabled={builtIn} title={builtIn ? 'The application depends on this value' : undefined} onClick={() => setConfirmId(row.id)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>
      {rows.data?.length === 0 ? <Empty>No rows yet. Add the first one above.</Empty> : null}
      <p className="text-xs text-muted">
        Used by: {meta.references.map((r) => `${r.table}.${r.column}`).join(', ')}. Press Enter to save a row and Esc to cancel an edit.
      </p>
    </div>
  );
}

export function GlobalLookupTables({ embedded = false }: { embedded?: boolean }) {
  const [table, setTable] = useState<LookupTableName>(LOOKUP_TABLE_ORDER[0]);
  const orgs = useParentOrganizations();
  const [tier, setTier] = useState<number | null>(null);
  return (
    <>
      {embedded ? null : <PageTitle>System lookups</PageTitle>}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <ParentOrgTierSelect orgs={orgs.data ?? []} value={tier} onChange={setTier} />
        <p className="max-w-xl text-sm text-muted">
          Shared rows show in every council. Rows filed under a parent organization show only in its councils. A new row is filed under the parent
          organization chosen here.
        </p>
      </div>
      <Tabs
        tabs={LOOKUP_TABLE_ORDER.map((t) => ({ id: t, label: LOOKUP_META[t].label }))}
        value={table}
        onChange={setTable}
        label="Lookup tables"
        idPrefix="lookup"
      />
      <div id="lookup-panel" role="tabpanel" aria-labelledby={`lookup-tab-${table}`} className="pt-4">
        <LookupGrid key={`${table}-${tier ?? 'shared'}`} table={table} tier={tier} orgs={orgs.data ?? []} />
      </div>
    </>
  );
}
