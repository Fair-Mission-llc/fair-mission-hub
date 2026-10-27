'use client';
// The Account Owners Matrix (Sprint 10 Revision 3.1): one editable grid row per money account the council keeps, in
// the Standard Bank Accounts drawer of Council Wide Settings. The council's Admins and Super Admins add, change and
// delete rows (canAdministerCouncil; the drivers check assertMayManageCouncilAccounts); everyone else is told who keeps it.
//
// Sprint 11 Revision 2.1 (schema 103, council-accounts.ts): the rows are the council's own chart of accounts - its money
// (Asset) accounts - not a separate table. Each row has the ledger name, the name members see, who owns the account
// (Council or Parish), who to call about it and the holder's EIN. Adding a row adds an Asset account to the chart. A
// Parish account's gifts are parish-held: they stay off the Treasurer's batch coder.
//
// Sprint 11 Revision 2.2: the owner is one of three universal classifications (Internal Operating, Parent Organization,
// Affiliated Entity), labelled in the tenant's vocabulary (accountOwnershipLabel: Council / Parish / Affiliated Entity for a
// Knights of Columbus council). Both external kinds are shielded from the council's operating books.
import { useState } from 'react';
import {
  ACCOUNT_CONTACT_EMAIL_MAX_LENGTH,
  ACCOUNT_CONTACT_NAME_MAX_LENGTH,
  ACCOUNT_CONTACT_NUMBER_MAX_LENGTH,
  ACCOUNT_DISPLAY_NAME_MAX_LENGTH,
  ACCOUNT_OWNERS_MATRIX_TITLE,
  ACCOUNT_OWNERSHIP_COLUMN_LABEL,
  ACCOUNT_OWNERSHIP_TYPES,
  accountOwnershipLabel,
  canAdministerCouncil,
  DEFAULT_ACCOUNT_OWNERSHIP_TYPE,
  isShieldedOwnership,
  describeError,
  GL_ACCOUNT_NAME_MAX_LENGTH,
  type AccountOwnershipType,
  type Council,
  type CouncilAccount,
} from '@kofc/shared';
import { Button, Empty, Input, Notice, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { useTenantType, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type TextKey = 'AccountName' | 'account_display_name' | 'contact_name' | 'contact_number' | 'contact_email' | 'ein_number';
type Draft = { id: number | null; ownership_type: AccountOwnershipType } & Record<TextKey, string>;
const blank: Draft = { id: null, AccountName: '', account_display_name: '', ownership_type: DEFAULT_ACCOUNT_OWNERSHIP_TYPE, contact_name: '', contact_number: '', contact_email: '', ein_number: '' };
const draftOf = (r: CouncilAccount): Draft => ({
  id: r.id,
  AccountName: r.AccountName,
  account_display_name: r.account_display_name ?? '',
  ownership_type: r.ownership_type,
  contact_name: r.contact_name ?? '',
  contact_number: r.contact_number ?? '',
  contact_email: r.contact_email ?? '',
  ein_number: r.ein_number ?? '',
});

const NAME_COLUMNS: { key: TextKey; label: string; max: number }[] = [
  { key: 'AccountName', label: 'Ledger account', max: GL_ACCOUNT_NAME_MAX_LENGTH },
  { key: 'account_display_name', label: 'Name members see', max: ACCOUNT_DISPLAY_NAME_MAX_LENGTH },
];
const CONTACT_COLUMNS: { key: TextKey; label: string; max: number; type?: string }[] = [
  { key: 'contact_name', label: 'Contact name', max: ACCOUNT_CONTACT_NAME_MAX_LENGTH },
  { key: 'contact_number', label: 'Contact number', max: ACCOUNT_CONTACT_NUMBER_MAX_LENGTH, type: 'tel' },
  { key: 'contact_email', label: 'Contact email', max: ACCOUNT_CONTACT_EMAIL_MAX_LENGTH, type: 'email' },
  { key: 'ein_number', label: 'EIN', max: 10 },
];
const HEAD = [...NAME_COLUMNS.map((c) => c.label), ACCOUNT_OWNERSHIP_COLUMN_LABEL, ...CONTACT_COLUMNS.map((c) => c.label), 'Actions'];

export function AccountOwnersMatrix({ council }: { council: Council }) {
  const user = useUser();
  const tenant = useTenantType();
  const mayEdit = canAdministerCouncil(user, council.id);
  const rows = useLoad(() => (mayEdit ? db.councils.listCouncilAccounts(user.memberId, council.id) : Promise.resolve([] as CouncilAccount[])), [user.memberId, council.id, mayEdit]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.councils.saveCouncilAccount(user.memberId, council.id, editing);
      setMessage({ tone: 'info', text: `Saved ${saved.AccountName}.` });
      setEditing(null);
      await rows.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row: CouncilAccount) => {
    setBusy(true);
    setMessage(null);
    try {
      await db.councils.removeCouncilAccount(user.memberId, council.id, row.id);
      setMessage({ tone: 'info', text: `Deleted ${row.AccountName}.` });
      await rows.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const textCell = (draft: Draft, c: { key: TextKey; label: string; max: number; type?: string }) => (
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
  );

  const editRow = (draft: Draft) => (
    <tr key={draft.id ?? 'new'} className="bg-gold/10">
      {NAME_COLUMNS.map((c) => textCell(draft, c))}
      <Td>
        <Select
          aria-label={ACCOUNT_OWNERSHIP_COLUMN_LABEL}
          value={draft.ownership_type}
          onChange={(e) => setEditing({ ...draft, ownership_type: e.target.value as AccountOwnershipType })}
        >
          {ACCOUNT_OWNERSHIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {accountOwnershipLabel(t, tenant)}
            </option>
          ))}
        </Select>
      </Td>
      {CONTACT_COLUMNS.map((c) => textCell(draft, c))}
      <Td className="whitespace-nowrap">
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || draft.AccountName.trim() === ''} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      </Td>
    </tr>
  );

  const list = rows.data ?? [];
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
      <p className="mb-3 text-sm">
        The council&apos;s money accounts (checking, Venmo, Zelle, Zeffy, the parish account), straight from the chart of accounts: who owns each one and who to
        call about it. Gifts paid into a {accountOwnershipLabel('PARENT_ORGANIZATION', tenant)} or {accountOwnershipLabel('AFFILIATED_ENTITY', tenant)} account are
        not the council&apos;s: they stay off the Treasurer&apos;s batch coder and the operating books.
      </p>
      {!mayEdit ? <Notice tone="info">Only the council&apos;s Admins and Super Admins keep the accounts.</Notice> : null}
      {rows.error ? <Notice tone="error">{rows.error}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {mayEdit ? (
        <div className="overflow-x-auto">
          {rows.data && list.length === 0 && editing === null ? <Empty>No accounts yet. Select Add account.</Empty> : null}
          {list.length > 0 || editing ? (
            <Table caption={ACCOUNT_OWNERS_MATRIX_TITLE} head={HEAD}>
              {list.map((r) =>
                editing?.id === r.id ? (
                  editRow(editing)
                ) : (
                  <tr key={r.id}>
                    <Td className="font-bold">{r.AccountName}</Td>
                    <Td>{r.account_display_name ?? '–'}</Td>
                    <Td>
                      <Pill tone={isShieldedOwnership(r.ownership_type) ? 'gold' : 'navy'}>{accountOwnershipLabel(r.ownership_type, tenant)}</Pill>
                    </Td>
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
