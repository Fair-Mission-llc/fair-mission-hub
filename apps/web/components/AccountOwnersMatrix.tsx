'use client';
// The Account Owners Matrix (Sprint 10 Revision 3.1, account-owners.ts): one editable grid row per electronic account the
// council keeps - the account's name, who to call about it (name, number, email) and the account holder's EIN. It sits
// in the Standard Bank Accounts drawer of Council Wide Settings. The council's Admins and Super Admins add, change and
// delete rows (canAdministerCouncil; the drivers check assertMayManageAccountOwners); everyone else is told who keeps it.
import { useState } from 'react';
import {
  ACCOUNT_CONTACT_EMAIL_MAX_LENGTH,
  ACCOUNT_CONTACT_NAME_MAX_LENGTH,
  ACCOUNT_CONTACT_NUMBER_MAX_LENGTH,
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_OWNERS_MATRIX_TITLE,
  canAdministerCouncil,
  describeError,
  type AccountOwner,

  type Council,
} from '@kofc/shared';
import { Button, Empty, Input, Notice, Panel, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Draft = { id: number | null; account_name: string; contact_name: string; contact_number: string; contact_email: string; ein_number: string };
const blank: Draft = { id: null, account_name: '', contact_name: '', contact_number: '', contact_email: '', ein_number: '' };
const draftOf = (r: AccountOwner): Draft => ({
  id: r.id,
  account_name: r.account_name,
  contact_name: r.contact_name ?? '',
  contact_number: r.contact_number ?? '',
  contact_email: r.contact_email ?? '',
  ein_number: r.ein_number ?? '',
});

const COLUMNS: { key: keyof Omit<Draft, 'id'>; label: string; max: number; type?: string }[] = [
  { key: 'account_name', label: 'Account name', max: ACCOUNT_NAME_MAX_LENGTH },
  { key: 'contact_name', label: 'Contact name', max: ACCOUNT_CONTACT_NAME_MAX_LENGTH },
  { key: 'contact_number', label: 'Contact number', max: ACCOUNT_CONTACT_NUMBER_MAX_LENGTH, type: 'tel' },
  { key: 'contact_email', label: 'Contact email', max: ACCOUNT_CONTACT_EMAIL_MAX_LENGTH, type: 'email' },
  { key: 'ein_number', label: 'EIN', max: 10 },
];

export function AccountOwnersMatrix({ council }: { council: Council }) {
  const user = useUser();
  const mayEdit = canAdministerCouncil(user, council.id);
  const rows = useLoad(() => (mayEdit ? db.councils.listAccountOwners(user.memberId, council.id) : Promise.resolve([])), [user.memberId, council.id, mayEdit]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.councils.saveAccountOwner(user.memberId, council.id, editing);
      setMessage({ tone: 'info', text: `Saved ${saved.account_name}.` });
      setEditing(null);
      await rows.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row: AccountOwner) => {
    setBusy(true);
    setMessage(null);
    try {
      await db.councils.removeAccountOwner(user.memberId, council.id, row.id);
      setMessage({ tone: 'info', text: `Deleted ${row.account_name}.` });
      await rows.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const editRow = (draft: Draft) => (
    <tr key={draft.id ?? 'new'} className="bg-gold/10">
      {COLUMNS.map((c) => (
        <Td key={c.key}>
          <Input
            aria-label={c.label}
            type={c.type ?? 'text'}
            value={draft[c.key]}
            maxLength={c.max}
            placeholder={c.key === 'ein_number' ? '12-3456789' : undefined}
            onChange={(e) => setEditing({ ...draft, [c.key]: e.target.value })}
          />
        </Td>
      ))}
      <Td className="whitespace-nowrap">
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || draft.account_name.trim() === ''} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      </Td>
    </tr>
  );

  return (
    <Panel
      title={ACCOUNT_OWNERS_MATRIX_TITLE}
      className="mt-6"
      actions={
        mayEdit && editing === null ? (
          <Button size="sm" onClick={() => setEditing({ ...blank })}>
            Add account
          </Button>
        ) : undefined
      }
    >
      <p className="mb-3 text-sm">The council&apos;s electronic accounts (Venmo, Zelle, Zeffy, the parish account) and who to call about each one.</p>
      {!mayEdit ? <Notice tone="info">Only the council&apos;s Admins and Super Admins keep the account owners.</Notice> : null}
      {rows.error ? <Notice tone="error">{rows.error}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {mayEdit ? (
        <div className="overflow-x-auto">
          {rows.data && rows.data.length === 0 && editing === null ? <Empty>No accounts yet. Select Add account.</Empty> : null}
          {(rows.data?.length ?? 0) > 0 || editing ? (
            <Table caption={ACCOUNT_OWNERS_MATRIX_TITLE} head={[...COLUMNS.map((c) => c.label), 'Actions']}>
              {(rows.data ?? []).map((r) =>
                editing?.id === r.id ? (
                  editRow(editing)
                ) : (
                  <tr key={r.id}>
                    <Td className="font-bold">{r.account_name}</Td>
                    <Td>{r.contact_name ?? '–'}</Td>
                    <Td className="whitespace-nowrap">{r.contact_number ?? '–'}</Td>
                    <Td className="break-all">{r.contact_email ?? '–'}</Td>
                    <Td className="whitespace-nowrap">{r.ein_number ?? '–'}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" disabled={busy || editing !== null} onClick={() => setEditing(draftOf(r))}>
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary" disabled={busy || editing !== null} onClick={() => void remove(r)}>
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ),
              )}
              {editing && editing.id === null ? editRow(editing) : null}
            </Table>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
