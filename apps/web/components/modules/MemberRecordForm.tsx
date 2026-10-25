'use client';
// The member record form (Sprint 10 Revision 3.0): the add / edit form that used to sit on the Affiliated Roster page
// (/members, now removed). The Member Roster (/roster) opens it in a drawer from 'Add Member' and each row's 'Edit'
// button, for the council's Admins (their own council) and Super Admins (any council). Every field is text; numbers
// and ids are converted on save and validated again by the driver, which enforces the same tiers (ADMIN_REQUIRED,
// SUPER_ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED), so a refusal is reported, never hidden. The Designated Budget Director
// flag is no longer set here: the Annual Budget Center assigns it, and an edit keeps the stored value.
import { useEffect, useState } from 'react';
import {
  canCreateMembers,
  canEditMember,
  describeError,
  grantableMemberTypes,
  type Degree,
  type Member,
  type MemberStatus,
  type MemberType,
  type NewMember,
} from '@kofc/shared';
import { Button, Field, Input, Notice, Panel, Pill, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

/** Runs a save, reports the outcome in one place and returns whether it worked. */
function useAction() {
  const [message, setMessage] = useState<Message | null>(null);
  const run = async (action: () => Promise<void>, done: string): Promise<boolean> => {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'info', text: done });
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
      return false;
    }
  };
  return { message, setMessage, run };
}

const Banner = ({ message, onDismiss }: { message: Message | null; onDismiss: () => void }) =>
  message ? (
    <Notice tone={message.tone} onDismiss={onDismiss}>
      {message.text}
    </Notice>
  ) : null;

export interface Lookups {
  statuses: MemberStatus[];
  degrees: Degree[];
  types: MemberType[];
}

// ---- add / edit form ---------------------------------------------------------

/**
 * Every form field is text; numbers and ids are converted on save and validated again by the driver. The photo and
 * biography are the member's own (My Profile), so the roster form leaves them as stored, as it does the member's
 * Large Text Layout Mode choice (Sprint 6C).
 */
type Draft = Record<
  Exclude<keyof NewMember, 'WorkingStatusID' | 'ProfilePhotoURL' | 'Biography' | 'IsBudgetDirector' | 'flag_large_text_mode' | 'flag_charter_member'>,
  string
>;

const TEXT_FIELDS: { key: keyof Draft; label: string; type?: string; maxLength: number; optional?: boolean; wide?: boolean }[] = [
  { key: 'MemberFirstName', label: 'First name', maxLength: 100 },
  { key: 'MemberLastName', label: 'Last name', maxLength: 100 },
  { key: 'MemberNumber', label: 'Member number', type: 'number', maxLength: 10 },
  { key: 'Email', label: 'Email (also the login)', type: 'email', maxLength: 50 },
  { key: 'Phone', label: 'Phone', type: 'tel', maxLength: 50 },
  { key: 'DateOfBirth', label: 'Date of birth', type: 'date', maxLength: 10 },
  // Sprint 6B Patch: from Supreme's roster; the New Member badge shows for 180 days from it.
  { key: 'DateJoinedCouncil', label: 'Date joined council', type: 'date', maxLength: 10, optional: true },
  { key: 'StreetAddress1', label: 'Street address', maxLength: 255, wide: true },
  { key: 'StreetAddress2', label: 'Street address line 2', maxLength: 255, optional: true, wide: true },
  { key: 'City', label: 'City', maxLength: 50 },
  { key: 'State', label: 'State', maxLength: 20 },
  { key: 'ZipCode', label: 'ZIP code', maxLength: 15 },
];

const idOf = (row: { id: number } | undefined): string => (row ? String(row.id) : '');

function draftFrom(member: Member | null, councilId: number, lookups: Lookups): Draft {
  if (!member) {
    return {
      CouncilID: String(councilId),
      MemberNumber: '',
      MemberFirstName: '',
      MemberLastName: '',
      Phone: '',
      StreetAddress1: '',
      StreetAddress2: '',
      City: '',
      State: '',
      ZipCode: '',
      Email: '',
      DateOfBirth: '',
      DateJoinedCouncil: '',
      StatusID: idOf(lookups.statuses.find((s) => s.Status === 'Active') ?? lookups.statuses[0]),
      DegreeID: idOf(lookups.degrees[0]),
      MemberTypeID: idOf(lookups.types.find((t) => t.Type === 'Member') ?? lookups.types[0]),
    };
  }
  const text = (v: string | number | null | undefined) => (v == null ? '' : String(v));
  return {
    CouncilID: text(member.CouncilID),
    MemberNumber: text(member.MemberNumber),
    MemberFirstName: member.MemberFirstName,
    MemberLastName: member.MemberLastName,
    Phone: member.Phone,
    StreetAddress1: member.StreetAddress1,
    StreetAddress2: text(member.StreetAddress2),
    City: member.City,
    State: member.State,
    ZipCode: member.ZipCode,
    Email: member.Email,
    DateOfBirth: member.DateOfBirth,
    DateJoinedCouncil: text(member.DateJoinedCouncil),
    StatusID: text(member.StatusID),
    DegreeID: text(member.DegreeID),
    MemberTypeID: text(member.MemberTypeID),
  };
}

/** IsBudgetDirector is left out, so an edit keeps the stored flag; the Annual Budget Center assigns it (Sprint 10 Revision 3.0). */
function toNewMember(d: Draft, charter: boolean): NewMember {
  return {
    CouncilID: Number(d.CouncilID),
    MemberNumber: Number(d.MemberNumber),
    MemberFirstName: d.MemberFirstName,
    MemberLastName: d.MemberLastName,
    Phone: d.Phone,
    StreetAddress1: d.StreetAddress1,
    StreetAddress2: d.StreetAddress2.trim() === '' ? undefined : d.StreetAddress2,
    City: d.City,
    State: d.State,
    ZipCode: d.ZipCode,
    Email: d.Email,
    DateOfBirth: d.DateOfBirth,
    DateJoinedCouncil: d.DateJoinedCouncil.trim() === '' ? null : d.DateJoinedCouncil,
    StatusID: Number(d.StatusID),
    DegreeID: Number(d.DegreeID),
    MemberTypeID: Number(d.MemberTypeID),
    flag_charter_member: charter ? 1 : 0,
  };
}

export function MemberForm({
  member,
  councilId,
  lookups,
  onSaved,
}: {
  /** null adds a member to `councilId`. */
  member: Member | null;
  councilId: number;
  lookups: Lookups;
  onSaved: (id: number) => void;
}) {
  const user = useUser();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(member, councilId, lookups));
  const [busy, setBusy] = useState(false);
  const { message, setMessage, run } = useAction();
  useEffect(() => setDraft(draftFrom(member, councilId, lookups)), [member, councilId, lookups]);
  // Sprint 7A: Charter Member, kept by the council's Admins and Super Admins.
  const [charter, setCharter] = useState(member?.flag_charter_member === 1);
  useEffect(() => setCharter(member?.flag_charter_member === 1), [member]);
  const mayMarkCharter = canCreateMembers(user, member?.CouncilID ?? councilId);

  const typeName = (id: number) => lookups.types.find((t) => t.id === id)?.Type;
  const currentType = member ? typeName(member.MemberTypeID) : undefined;
  const grantable = grantableMemberTypes(user, currentType);
  const typeOptions = lookups.types.filter((t) => grantable.includes(t.Type));
  const editable = member ? canEditMember(user, member) : canCreateMembers(user, councilId);
  // An Admin may not change a Super Admin's type or status (SUPER_ADMIN_REQUIRED), so both are shown read-only.
  const clearanceLocked = typeOptions.length === 0;

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setBusy(true);
    const ok = await run(async () => {
      const values = toNewMember(draft, charter);
      if (member) {
        const saved = await db.members.update(user.memberId, member.id, values);
        onSaved(saved.id);
      } else {
        const saved = await db.members.create(user.memberId, values);
        onSaved(saved.id);
      }
    }, member ? 'Member saved.' : `Added ${draft.MemberFirstName} ${draft.MemberLastName}. A welcome email with sign-in instructions was queued.`);
    setBusy(false);
    if (ok && !member) {
      setDraft(draftFrom(null, councilId, lookups));
      setCharter(false);
    }
  };

  const lookupSelect = (key: 'StatusID' | 'DegreeID', label: string, rows: { id: number; name: string }[], locked = false) => (
    <Field label={label}>
      {(id) => (
        <Select id={id} value={draft[key]} disabled={!editable || locked} onChange={(e) => set(key)(e.target.value)}>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );

  return (
    <Panel title={member ? `${member.MemberFirstName} ${member.MemberLastName}` : 'Add a member'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Banner message={message} onDismiss={() => setMessage(null)} />
        {!editable ? <Notice tone="info">You can view this member, but only their council&apos;s admins can change the record.</Notice> : null}
        <div className="grid grid-cols-3 gap-3">
          {TEXT_FIELDS.map((f) => (
            <Field key={f.key} label={f.optional ? `${f.label} (optional)` : f.label} className={f.wide ? 'col-span-3' : undefined}>
              {(id) => (
                <Input
                  id={id}
                  type={f.type ?? 'text'}
                  value={draft[f.key]}
                  maxLength={f.maxLength}
                  required={!f.optional}
                  disabled={!editable}
                  onChange={(e) => set(f.key)(e.target.value)}
                />
              )}
            </Field>
          ))}
          {lookupSelect('StatusID', 'Status', lookups.statuses.map((s) => ({ id: s.id, name: s.Status })), clearanceLocked && !!member)}
          {lookupSelect('DegreeID', 'Degree', lookups.degrees.map((d) => ({ id: d.id, name: d.Degree })))}
          <Field label="Member type" hint={clearanceLocked ? 'Only a Super Admin can change this member’s type or status.' : undefined}>
            {(id) =>
              clearanceLocked ? (
                <Input id={id} value={currentType ?? ''} disabled readOnly />
              ) : (
                <Select id={id} value={draft.MemberTypeID} disabled={!editable} onChange={(e) => set('MemberTypeID')(e.target.value)}>
                  {typeOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.Type}
                    </option>
                  ))}
                </Select>
              )
            }
          </Field>
        </div>
        {member?.IsBudgetDirector === 1 ? (
          <p className="text-sm">
            <Pill tone="gold">Designated Budget Director</Pill> <span className="text-xs text-muted">Assigned on the Annual Budget Center.</span>
          </p>
        ) : null}
        {mayMarkCharter ? (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5" checked={charter} onChange={(e) => setCharter(e.target.checked)} />
            <span className="font-bold">Charter member</span>
            <span className="text-xs text-muted">One of the brothers who founded the council.</span>
          </label>
        ) : member?.flag_charter_member === 1 ? (
          <p className="text-sm">
            <Pill tone="gold">Charter member</Pill>
          </p>
        ) : null}
        {editable ? (
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : member ? 'Save member' : 'Add member'}
            </Button>
            {member ? (
              <Button variant="secondary" onClick={() => setDraft(draftFrom(member, councilId, lookups))}>
                Undo changes
              </Button>
            ) : null}
            {/* Sprint 6B Security: the setup code is mandatory, so a member whose code expired needs a fresh one. */}
            {member && canCreateMembers(user, member.CouncilID) ? (
              <Button
                variant="secondary"
                disabled={busy}
                title="For a member who has not chosen a password yet"
                onClick={() =>
                  void run(
                    () => db.members.resendWelcome(user.memberId, member.id),
                    `A new welcome email with a fresh setup code was sent to ${member.Email}.`,
                  )
                }
              >
                Send new setup code
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>
    </Panel>
  );
}

