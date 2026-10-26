'use client';
// Council Lookups: the lookup rows each council keeps for itself (Activities, DonationType, CouncilDonationMethod, and
// CouncilBudgetCategory - the funds its annual budget is grouped under, Sprint 5Y-3),
// read and written through the actor-checked lookups.listCouncilSpecific/saveCouncilSpecific/removeCouncilSpecific.
// Council Admins work on their own council and Super Admins pick any; the council's Financial Secretary and Treasurer
// see only the donation tables and budget categories (councilLookupTablesFor). The drivers apply the same rule (ADMIN_REQUIRED,
// COUNCIL_ACCESS_DENIED), so hiding a tab is not the only gate.
//
// Each grid is edited in place and saved as one batch, all or nothing: a clash anywhere (a duplicate name, an
// unknown method) leaves every row as it was and the drafts stay on screen to fix. Deletes are one row at a time
// and are refused (RECORD_IN_USE) while logged time or donations still point at the row; they never cascade.
//
// Officer Election Parameters (Sprint 5U): the council's Admins and Super Admins tick which elected offices are open
// for nomination this season (elections.toggleRoleBallotStatus, saved per click). Appointed offices and the trustee
// ladder are never on a ballot, so only elected seats are listed.
//
// Meeting Agenda Templates (Sprint 5Y-6): the council's Admins, its Grand Knight and Super Admins pick one of the
// council's own meeting types (CouncilMeetingType) and write its default agenda outline (meetings.saveAgendaTemplate,
// CouncilAgendaTemplate). The Meeting center's schedule form pre-fills its agenda from it. Sprint 11 Revision 1.0: a live
// preview under the editor draws the outline through the markdown renderer (components/Markdown.tsx).
//
// Sprint 6L Extension: the Outbound Email Gateway tab moved to the Credentials Vault page (/credentials-vault), and the
// Base Dues Rate tab is gone - Council.base_dues_rate is set only on the Global Parameters Dashboard (/lookups).
//
// Sprint 8O: the Enabled donation methods grid is the payment configuration drawer. Each method names who owns the account
// it pays into - Council, Parish or Third party (account-ownership.ts). A new row starts with no owner, and the save is
// held, with the gate's message, until every edited row has one; the drivers refuse a missing owner too (INVALID_INPUT).
//
// Sprint 11 Revision 1.0 (schema 102): every grid has a Status column bound to Active or Inactive (lookup_status); an
// Inactive row stays for history but leaves the entry screens. Budget categories left this screen (the Annual Budget
// Center keeps them). On the payment methods grid the QR code is a checkbox that reveals a small upload button and a
// compact thumbnail - the text URL column is gone - and it is disabled for Cash, Check, card readers and Physical Items
// (methodAcceptsQrCode). The Account column lists the council's AccountOwners rows after the default 'Council Account'
// token, and a blank 'Account Name Members See' takes the picked account's name when the row is saved.
import { useEffect, useRef, useState } from 'react';
import {
  ACCOUNT_PICKER_COLUMN_LABEL,
  COUNCIL_ACCOUNT_TOKEN_LABEL,
  defaultAccountIdentityLabel,
  LOOKUP_STATUSES,
  methodAcceptsQrCode,
  ACCOUNT_OWNER_COLUMN_LABEL,
  ACCOUNT_OWNER_ENTITIES,
  ACCOUNT_OWNER_LABELS,
  accountOwnerGateMessage,
  ACCOUNT_IDENTITY_LABEL_COLUMN_LABEL,
  ACCOUNT_IDENTITY_LABEL_MAX_LENGTH,
  AGENDA_TEMPLATE_MAX_LENGTH,
  canConfigureBallot,
  canManageAgendaTemplates,
  councilLookupTablesFor,
  describeError,
  formatTimestamp,
  type CouncilLookupRecord,
  type CouncilLookupTableName,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { QrThumbnail, uploadPaymentQrImage } from '@/components/PaymentQrUploader';
import { Markdown } from '@/components/Markdown';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Pill, Select, Table, Tabs, Td, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

interface Column {
  key: string;
  label: string;
  maxLength?: number;
  optional?: boolean;
  /** A drop-down of ids; the value is stored as a number. */
  options?: { value: number; label: string }[];
  /** Sprint 8O: a drop-down of text codes that starts blank, so the choice must be made explicitly. */
  choices?: { value: string; label: string }[];
  /** Sprint 11 Revision 1.0: with `options`, a first choice stored as null (the 'Council Account' token), and the default. */
  emptyOption?: string;
  /** Sprint 11 Revision 1.0: 'status' is the Active/Inactive select; 'qr' the QR checkbox and upload button. */
  kind?: 'status' | 'qr';
  /** Sprint 11 Revision 1.0: placeholder text for a free-text cell, from the row's values. */
  placeholderFor?: (values: Values) => string | undefined;
}

type Values = Record<string, string>;
interface DraftRow {
  /** Stable React key: the row id, or a local key for a row not yet saved. */
  key: string;
  id: number | null;
  values: Values;
  /** The stored values, to tell a changed row from an untouched one; null for a new row. */
  saved: Values | null;
}

const TAB_LABELS: Record<CouncilLookupTableName, string> = {
  Activities: 'Activities',
  DonationType: 'Donation types',
  CouncilDonationMethod: 'Enabled donation methods',
  CouncilBudgetCategory: 'Budget categories',
};

const NOUNS: Record<CouncilLookupTableName, string> = {
  Activities: 'activity',
  DonationType: 'donation type',
  CouncilDonationMethod: 'donation method',
  CouncilBudgetCategory: 'budget category',
};

/** The Status column every grid ends with (Sprint 11 Revision 1.0): Active or Inactive. */
const STATUS_COLUMN: Column = { key: 'lookup_status', label: 'Status', kind: 'status' };

interface ColumnData {
  columns: Column[] | null;
  error: string | null;
  /** AccountOwners names by id, for the payment methods grid's account picker and name default. */
  accountNames: Map<number, string>;
}

function useColumns(table: CouncilLookupTableName, councilId: number): ColumnData {
  const user = useUser();
  const options = useLoad(async () => {
    if (table === 'Activities') return { options: (await db.lookups.list('Category')).map((c) => ({ value: c.id, label: c.Category })), owners: [] };
    if (table === 'CouncilDonationMethod') {
      const methods = (await db.donations.listAllMethods()).map((m) => ({ value: m.id, label: m.DonationMethod }));
      // The account list is read by the council's Admins and Super Admins; a finance officer sees only the token.
      const owners = await db.councils.listAccountOwners(user.memberId, councilId).catch(() => []);
      return { options: methods, owners: owners.map((o) => ({ value: o.id, label: o.account_name })) };
    }
    return { options: [], owners: [] };
  }, [table, councilId, user.memberId]);
  const accountNames = new Map((options.data?.owners ?? []).map((o) => [o.value, o.label]));
  if (!options.data) return { columns: null, error: options.error, accountNames };
  const columns: Record<CouncilLookupTableName, Column[]> = {
    Activities: [
      { key: 'ActivityName', label: 'Activity name', maxLength: 100 },
      { key: 'ActivityDescription', label: 'Description', maxLength: 255 },
      { key: 'CategoryID', label: 'Category', options: options.data.options },
      STATUS_COLUMN,
    ],
    DonationType: [{ key: 'DonationType', label: 'Donation type', maxLength: 100 }, STATUS_COLUMN],
    CouncilDonationMethod: [
      { key: 'DonationMethodID', label: 'Method', options: options.data.options },
      { key: 'account_owner_id', label: ACCOUNT_PICKER_COLUMN_LABEL, options: options.data.owners, emptyOption: COUNCIL_ACCOUNT_TOKEN_LABEL },
      { key: 'account_owner_entity', label: ACCOUNT_OWNER_COLUMN_LABEL, choices: ACCOUNT_OWNER_ENTITIES.map((o) => ({ value: o, label: ACCOUNT_OWNER_LABELS[o] })) },
      // Sprint 9 Revision 6.0: the name the phone's QR screen shows. Sprint 11 Revision 1.0: blank takes the account's name.
      {
        key: 'account_identity_label',
        label: ACCOUNT_IDENTITY_LABEL_COLUMN_LABEL,
        maxLength: ACCOUNT_IDENTITY_LABEL_MAX_LENGTH,
        optional: true,
        placeholderFor: (v) => (v.account_owner_id ? accountNames.get(Number(v.account_owner_id)) : undefined),
      },
      { key: 'DonationMethodURL', label: 'QR code', kind: 'qr', optional: true },
      STATUS_COLUMN,
    ],
    CouncilBudgetCategory: [{ key: 'CategoryName', label: 'Budget category (fund)', maxLength: 255 }],
  };
  return { columns: columns[table], error: options.error, accountNames };
}

/**
 * The QR code cell (Sprint 11 Revision 1.0): a checkbox that reveals a small upload button and a compact thumbnail.
 * Unticking clears the image. Disabled for the payment methods that never show a QR code.
 */
function QrCodeCell({ councilId, methodName, value, onChange }: { councilId: number; methodName: string; value: string; onChange: (url: string) => void }) {
  const accepts = methodAcceptsQrCode(methodName);
  const [enabled, setEnabled] = useState(value !== '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const on = accepts && (enabled || value !== '');
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadPaymentQrImage(councilId, file));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className={cx('flex items-center gap-1 text-sm', !accepts && 'cursor-not-allowed text-muted')} title={accepts ? undefined : 'This payment method takes no QR code.'}>
          <input
            type="checkbox"
            checked={on}
            disabled={!accepts || busy}
            onChange={(e) => {
              setEnabled(e.target.checked);
              if (!e.target.checked) onChange('');
            }}
          />
          <span>{accepts ? 'QR code' : 'No QR'}</span>
        </label>
        {on ? (
          <>
            <QrThumbnail url={value || null} name={methodName} />
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            </Button>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label={`Upload the ${methodName} QR code`}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </>
        ) : null}
      </div>
      {error ? <span className="text-xs text-brand-red">{error}</span> : null}
    </div>
  );
}

const toValues = (row: Record<string, unknown>, columns: Column[]): Values =>
  Object.fromEntries(columns.map((c) => [c.key, row[c.key] == null ? '' : String(row[c.key])]));

const isChanged = (row: DraftRow) => row.saved === null || Object.keys(row.values).some((k) => row.values[k] !== row.saved![k]);

function toRecord(row: DraftRow, columns: Column[], accountNames: Map<number, string>): Record<string, unknown> {
  const out: Record<string, unknown> = row.id === null ? {} : { id: row.id };
  for (const c of columns) {
    const text = row.values[c.key] ?? '';
    out[c.key] = c.options ? (text === '' ? null : Number(text)) : c.choices ? (text === '' ? null : text) : c.optional && text.trim() === '' ? null : text;
  }
  // Sprint 11 Revision 1.0: a blank name members see takes the picked account's name.
  if ('account_identity_label' in out && 'account_owner_id' in out) {
    out.account_identity_label = defaultAccountIdentityLabel(out.account_identity_label as string | null, accountNames.get(out.account_owner_id as number));
  }
  return out;
}

let nextLocalKey = 0;

function LookupEditor({ councilId, table }: { councilId: number; table: CouncilLookupTableName }) {
  const user = useUser();
  const { columns, error: columnsError, accountNames } = useColumns(table, councilId);
  const rows = useLoad(
    async () => (await db.lookups.listCouncilSpecific(user.memberId, councilId, table)) as unknown as Record<string, unknown>[],
    [user.memberId, councilId, table],
  );
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  // A fresh load (first open, after a save or delete) replaces the drafts with the stored rows.
  useEffect(() => {
    if (!rows.data || !columns) return;
    setDrafts(rows.data.map((r) => ({ key: String(r.id), id: r.id as number, values: toValues(r, columns), saved: toValues(r, columns) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.data, columns === null]);

  if (!columns) return columnsError ? <Notice tone="error">{columnsError}</Notice> : <p className="text-sm text-muted">Loading…</p>;

  const noun = NOUNS[table];
  const pending = drafts.filter(isChanged);
  // Sprint 8O: the payment configuration gate - every edited payment method must name its account owner.
  const gate = table === 'CouncilDonationMethod' ? accountOwnerGateMessage(pending.map((d) => d.values.account_owner_entity)) : null;
  const set = (key: string, field: string, value: string) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, values: { ...d.values, [field]: value } } : d)));
  const addRow = () =>
    setDrafts((ds) => [
      ...ds,
      {
        key: `new-${nextLocalKey++}`,
        id: null,
        saved: null,
        values: Object.fromEntries(
          columns.map((c) => [c.key, c.kind === 'status' ? 'Active' : c.emptyOption !== undefined ? '' : c.options?.[0] ? String(c.options[0].value) : '']),
        ),
      },
    ]);

  const act = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'info', text: done });
      await rows.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  };

  const save = () =>
    void act(async () => {
      const records = pending.map((d) => toRecord(d, columns, accountNames)) as CouncilLookupRecord<typeof table>[];
      await db.lookups.saveCouncilSpecific(user.memberId, councilId, table, records);
    }, `Saved ${pending.length} ${noun} row${pending.length === 1 ? '' : 's'}.`);

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {rows.error ? <Notice tone="error">{rows.error}</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={addRow}>
          Add {noun}
        </Button>
        <Button disabled={busy || pending.length === 0 || gate !== null} onClick={save}>
          {busy ? 'Saving…' : `Save changes${pending.length ? ` (${pending.length})` : ''}`}
        </Button>
        {pending.length > 0 ? (
          <Button variant="secondary" disabled={busy} onClick={() => void rows.reload()}>
            Discard changes
          </Button>
        ) : null}
        <p className="text-xs text-muted">Changes are saved together: if one row is refused, none are written.</p>
      </div>
      {gate ? <Notice tone="error">{gate}</Notice> : null}

      <Table caption={`${TAB_LABELS[table]} for the council`} head={['ID', ...columns.map((c) => (c.optional && !c.kind ? `${c.label} (optional)` : c.label)), 'Actions']}>
        {drafts.map((d) => {
          const changed = isChanged(d);
          return (
            <tr key={d.key} className={cx(changed && 'outline outline-2 -outline-offset-2 outline-gold')}>
              <Td className="text-muted">
                <span className="flex flex-col items-start gap-1">
                  {d.id ?? 'new'}
                  {d.id === null ? <Pill tone="gold">New</Pill> : changed ? <Pill tone="gold">Edited</Pill> : null}
                </span>
              </Td>
              {columns.map((c) => (
                <Td key={c.key}>
                  {c.kind === 'status' ? (
                    <Select aria-label={c.label} value={d.values[c.key] || 'Active'} onChange={(e) => set(d.key, c.key, e.target.value)}>
                      {LOOKUP_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  ) : c.kind === 'qr' ? (
                    <QrCodeCell
                      councilId={councilId}
                      methodName={columns[0].options?.find((o) => String(o.value) === d.values.DonationMethodID)?.label ?? ''}
                      value={d.values[c.key]}
                      onChange={(url) => set(d.key, c.key, url)}
                    />
                  ) : c.options ? (
                    <Select aria-label={c.label} value={d.values[c.key]} onChange={(e) => set(d.key, c.key, e.target.value)}>
                      {c.emptyOption !== undefined ? <option value="">{c.emptyOption}</option> : null}
                      {c.emptyOption !== undefined && d.values[c.key] !== '' && !c.options.some((o) => String(o.value) === d.values[c.key]) ? (
                        <option value={d.values[c.key]}>Account {d.values[c.key]}</option>
                      ) : null}
                      {c.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : c.choices ? (
                    <Select
                      aria-label={c.label}
                      aria-invalid={d.values[c.key] === ''}
                      value={d.values[c.key]}
                      onChange={(e) => set(d.key, c.key, e.target.value)}
                      className={cx(d.values[c.key] === '' && 'border-brand-red')}
                    >
                      <option value="">Choose…</option>
                      {c.choices.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      aria-label={c.label}
                      value={d.values[c.key]}
                      maxLength={c.maxLength}
                      placeholder={c.placeholderFor?.(d.values)}
                      onChange={(e) => set(d.key, c.key, e.target.value)}
                    />
                  )}
                </Td>
              ))}
              <Td>
                {d.id === null ? (
                  <Button size="sm" variant="secondary" onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}>
                    Remove
                  </Button>
                ) : confirmId === d.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void act(() => db.lookups.removeCouncilSpecific(user.memberId, councilId, table, d.id!), `Deleted the ${noun}.`)}>
                      Confirm delete
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" disabled={changed} title={changed ? 'Save or discard the edit first' : undefined} onClick={() => setConfirmId(d.id)}>
                    Delete…
                  </Button>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>
      {rows.data && drafts.length === 0 ? <Empty>No {noun} rows yet. Use “Add {noun}” to create the first.</Empty> : null}
    </div>
  );
}

function ElectionParameters({ councilId }: { councilId: number }) {
  const user = useUser();
  const seats = useLoad(async () => (await db.elections.listOfficerSeats(councilId)).filter((s) => s.kind === 'elected'), [councilId]);
  const [busyRoleId, setBusyRoleId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const toggle = async (roleId: number, roleName: string, isOpen: boolean) => {
    setBusyRoleId(roleId);
    setMessage(null);
    try {
      await db.elections.toggleRoleBallotStatus(user.memberId, councilId, roleId, isOpen);
      setMessage({ tone: 'info', text: `${roleName} is ${isOpen ? 'now open for nomination' : 'off the ballot'} this season.` });
      await seats.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusyRoleId(null);
    }
  };

  if (seats.error) return <Notice tone="error">{seats.error}</Notice>;
  if (!seats.data) return <p className="text-sm text-muted">Loading…</p>;
  const openCount = seats.data.filter((s) => s.ballot?.IsUpForElection === 1).length;

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <p className="text-xs text-muted">
        Tick each elected office open for nomination this season ({openCount} of {seats.data.length} open). Leave the Grand Knight unticked in the
        second year of a two-year term: the Grand Knight and trustees then keep their chairs when the year concludes. Each change saves at once.
      </p>
      <Table caption="Elected offices and their ballot status" head={['Office', 'Sitting officer', 'Status', 'Open for nomination']}>
        {seats.data.map((seat) => {
          const open = seat.ballot?.IsUpForElection === 1;
          const midYear = seat.ballot?.IsMidYearElection === 1;
          return (
            <tr key={seat.roleId} className={cx(open && 'outline outline-2 -outline-offset-2 outline-gold')}>
              <Td className="font-bold">{seat.roleName}</Td>
              <Td>{seat.holder ? `${seat.holder.firstName} ${seat.holder.lastName}` : <span className="text-muted">Vacant</span>}</Td>
              <Td>
                {midYear ? (
                  <Pill tone="red">Mid-year · closes {formatTimestamp(seat.ballot?.NominationsCloseAt)}</Pill>
                ) : open ? (
                  <Pill tone="navy">On ballot</Pill>
                ) : (
                  <Pill tone="outline">Not on ballot</Pill>
                )}
              </Td>
              <Td>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={open}
                    disabled={busyRoleId !== null}
                    onChange={(e) => void toggle(seat.roleId, seat.roleName, e.target.checked)}
                  />
                  <span className="sr-only">Open {seat.roleName} for nomination</span>
                  <span aria-hidden="true">{busyRoleId === seat.roleId ? 'Saving…' : open ? 'Open' : 'Closed'}</span>
                </label>
              </Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}

const AGENDA_PLACEHOLDER = ['1. Opening prayer', '2. Roll call of officers', '3. Reading of the minutes', '4. Reports', '5. Old business', '6. New business', '7. Closing prayer'].join('\n');

function AgendaTemplates({ councilId }: { councilId: number }) {
  const user = useUser();
  const types = useLoad(() => db.meetings.listCouncilMeetingTypes(councilId), [councilId]);
  const [picked, setPicked] = useState<number | null>(null);
  const typeId = picked !== null && types.data?.some((t) => t.id === picked) ? picked : (types.data?.[0]?.id ?? null);
  // Tagged with its type so a slower answer for a type no longer shown is never put in the editor.
  const saved = useLoad(
    async () => ({ typeId, text: typeId === null ? '' : ((await db.meetings.getAgendaTemplate(councilId, typeId))?.TemplateText ?? '') }),
    [councilId, typeId],
  );
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const current = saved.data?.typeId === typeId ? saved.data : undefined;

  useEffect(() => {
    if (current) setText(current.text);
  }, [current]);

  if (types.error) return <Notice tone="error">{types.error}</Notice>;
  if (!types.data) return <p className="text-sm text-muted">Loading…</p>;
  if (types.data.length === 0) return <Empty>This council has no meeting types yet, so there is nothing to write an agenda template for.</Empty>;

  const typeName = types.data.find((t) => t.id === typeId)?.TypeName ?? '';
  const dirty = current !== undefined && text.trim() !== current.text;

  const save = async (value: string) => {
    if (typeId === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await db.meetings.saveAgendaTemplate(user.memberId, councilId, typeId, value);
      setMessage({ tone: 'info', text: result ? `Saved the ${typeName} agenda template.` : `Removed the ${typeName} agenda template.` });
      await saved.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {saved.error ? <Notice tone="error">{saved.error}</Notice> : null}
      <p className="text-xs text-muted">
        Pick one of the council&apos;s meeting types and write the outline its agendas start from. When anyone schedules a meeting of that type in the
        Meeting center, the agenda box fills with this outline, and they can still edit it for that meeting.
      </p>
      <Field label="Meeting type">
        {(id) => (
          <Select
            id={id}
            value={typeId ?? ''}
            disabled={busy}
            onChange={(e) => {
              setPicked(Number(e.target.value));
              setMessage(null);
            }}
          >
            {types.data!.map((t) => (
              <option key={t.id} value={t.id}>
                {t.TypeName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Default agenda outline" hint={`Up to ${AGENDA_TEMPLATE_MAX_LENGTH.toLocaleString()} characters. Leave it empty and save to remove the template.`}>
        {(id) => (
          <Textarea
            id={id}
            rows={14}
            className="text-sm"
            value={text}
            maxLength={AGENDA_TEMPLATE_MAX_LENGTH}
            disabled={!current || busy}
            placeholder={AGENDA_PLACEHOLDER}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
      {/* Sprint 11 Revision 1.0: the outline as it will read, styled live by the markdown renderer as each line is typed. */}
      <section aria-label="Agenda preview" className="rounded border-2 border-navy border-t-8 border-t-gold bg-white px-4 py-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted">Preview</p>
        <Markdown source={text.trim() === '' ? AGENDA_PLACEHOLDER : text} idPrefix="agenda-preview" />
      </section>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy || !dirty} onClick={() => void save(text)}>
          {busy ? 'Saving…' : 'Save template'}
        </Button>
        {dirty ? (
          <Button variant="secondary" disabled={busy} onClick={() => setText(current?.text ?? '')}>
            Discard changes
          </Button>
        ) : null}
        {current && current.text !== '' ? <Pill tone="navy">Template saved</Pill> : <Pill tone="outline">No template yet</Pill>}
        {dirty ? <Pill tone="gold">Unsaved changes</Pill> : null}
      </div>
    </div>
  );
}

type LookupTab = CouncilLookupTableName | 'elections' | 'agenda';

function CouncilLookups() {
  const user = useUser();
  const scope = useCouncilScope();
  // Sprint 11 Revision 1.0: budget categories are kept on the Annual Budget Center, not here.
  const tables = councilLookupTablesFor(user, scope.councilId).filter((t) => t !== 'CouncilBudgetCategory');
  const tabs: { id: LookupTab; label: string }[] = [
    ...tables.map((t) => ({ id: t, label: TAB_LABELS[t] })),
    ...(canConfigureBallot(user, scope.councilId) ? [{ id: 'elections' as const, label: 'Officer Election Parameters' }] : []),
    ...(canManageAgendaTemplates(user, scope.councilId) ? [{ id: 'agenda' as const, label: 'Meeting Agenda Templates' }] : []),
  ];
  const [chosen, setChosen] = useState<LookupTab | null>(null);
  const table = chosen && tabs.some((t) => t.id === chosen) ? chosen : tabs[0]?.id;

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Council lookups</PageTitle>
      {tables.length > 0 && !tables.includes('Activities') ? (
        <p className="mb-3 text-sm text-muted">As your council&apos;s finance officer you maintain its donation types and enabled donation methods.</p>
      ) : null}
      {table ? (
        <>
          <Tabs tabs={tabs} value={table} onChange={setChosen} label="Council lookup tables" idPrefix="council-lookup" />
          <div id="council-lookup-panel" role="tabpanel" aria-labelledby={`council-lookup-tab-${table}`} className="pt-4">
            {table === 'elections' ? (
              <ElectionParameters key={scope.councilId} councilId={scope.councilId} />
            ) : table === 'agenda' ? (
              <AgendaTemplates key={scope.councilId} councilId={scope.councilId} />
            ) : (
              <LookupEditor key={`${scope.councilId}-${table}`} councilId={scope.councilId} table={table} />
            )}
          </div>
        </>
      ) : (
        <Notice tone="error">Your role cannot maintain this council&apos;s lookups.</Notice>
      )}
    </>
  );
}

export default function CouncilLookupsPage() {
  return (
    <RequireArea area="council-lookups">
      <CouncilLookups />
    </RequireArea>
  );
}
