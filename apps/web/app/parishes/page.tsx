'use client';
// Parish & Pastors Linkage (Sprint 11 Revision 21.0, schema 113; parish-registry.ts).
//   - Parishes: the parishes the council keeps. Choosing one opens its panel underneath.
//   - Home parish: the selected parish can be linked as the council's home parish (one at a time). Linking provisions
//     the parish's Account Owner and its baseline Asset rows in the council's General Ledger; the panel reports them.
//   - Pastors serving the parish: assign any of the council's pastors, or end an assignment. A pastor may serve
//     several parishes.
//   - Council pastors: the pastors the council keeps, each with the parishes they serve.
// Admins work on their own council, Super Admins pick any. The drivers enforce the same rules (ADMIN_REQUIRED,
// COUNCIL_ACCESS_DENIED); a parish with pastors assigned, or one that is a home parish, cannot be deleted (RECORD_IN_USE).
import { useState } from 'react';
import {
  canMaintainCouncilRecords,
  describeError,
  HOME_PARISH_BADGE,
  LINK_HOME_PARISH_LABEL,
  PARISH_PASTORS_TITLE,
  UNLINK_HOME_PARISH_LABEL,
  type Parish,
  type Pastor,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { RecordGrid, type Draft, type FormField, type Selection } from '@/components/RecordGrid';
import { Button, Empty, Notice, PageTitle, Panel, Pill, Select } from '@/components/ui';
import { blankToNull, formatAddress, formatPersonName, formatPhone } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const PARISH_FIELDS: FormField[] = [
  { key: 'parish_name', label: 'Parish name', maxLength: 100, wide: true },
  { key: 'street_address_1', label: 'Street address', maxLength: 255, wide: true },
  { key: 'street_address_2', label: 'Street address line 2', maxLength: 255, optional: true, wide: true },
  { key: 'city', label: 'City', maxLength: 50 },
  { key: 'state', label: 'State', maxLength: 50 },
  { key: 'phone', label: 'Phone', type: 'tel', maxLength: 50, optional: true },
];

const PASTOR_FIELDS: FormField[] = [
  { key: 'first_name', label: 'First name', maxLength: 50 },
  { key: 'last_name', label: 'Last name', maxLength: 50 },
  { key: 'phone', label: 'Phone', type: 'tel', maxLength: 50, optional: true },
  { key: 'email', label: 'Email', type: 'email', maxLength: 100, optional: true },
];

const parishDraft = (p: Parish): Draft => ({
  parish_name: p.parish_name,
  street_address_1: p.street_address_1,
  street_address_2: p.street_address_2 ?? '',
  city: p.city,
  state: p.state,
  phone: p.phone ?? '',
});

const pastorDraft = (p: Pastor): Draft => ({ first_name: p.first_name, last_name: p.last_name, phone: p.phone ?? '', email: p.email ?? '' });

const parishAddress = (p: Parish) => formatAddress({ StreetAddress1: p.street_address_1, StreetAddress2: p.street_address_2, City: p.city, State: p.state });
const pastorName = (p: Pastor) => formatPersonName(p.first_name, p.last_name);

type Message = { tone: 'error' | 'info'; text: string } | null;

/** The selected parish: its home parish link and the pastors serving it. */
function ParishPanel({
  parish,
  councilId,
  pastors,
  canEdit,
  onChanged,
}: {
  parish: Parish;
  councilId: number;
  pastors: Pastor[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const user = useUser();
  const serving = useLoad(() => db.pastors.listByParish(parish.id), [parish.id]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const linked = parish.associated_council_id === councilId;
  const servingIds = new Set((serving.data ?? []).map((p) => p.id));
  const free = pastors.filter((p) => !servingIds.has(p.id));

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: 'info', text: await work() });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const toggleLink = () =>
    run(async () => {
      const result = await db.parishes.setCouncilAssociation(user.memberId, councilId, linked ? null : parish.id);
      await onChanged();
      if (!result.parish) return `${parish.parish_name} is no longer the home parish. Its ledger accounts stay in the General Ledger.`;
      const names = [result.ownerAccount, ...result.baselineAccounts].filter((a) => a !== null).map((a) => a!.AccountName);
      return result.accountsCreated > 0
        ? `${parish.parish_name} is now the home parish. ${result.accountsCreated} General Ledger accounts were added: ${names.join('; ')}.`
        : `${parish.parish_name} is now the home parish. Its General Ledger accounts were already on file: ${names.join('; ')}.`;
    });

  const assign = () =>
    run(async () => {
      const pastor = pastors.find((p) => String(p.id) === pick);
      if (!pastor) throw new Error('Choose a pastor first.');
      await db.pastors.assignToParish(user.memberId, pastor.id, parish.id);
      setPick('');
      await serving.reload();
      await onChanged();
      return `${pastorName(pastor)} now serves ${parish.parish_name}.`;
    });

  const unassign = (pastor: Pastor) =>
    run(async () => {
      await db.pastors.unassignFromParish(user.memberId, pastor.id, parish.id);
      await serving.reload();
      await onChanged();
      return `${pastorName(pastor)} no longer serves ${parish.parish_name}.`;
    });

  return (
    <Panel
      title={parish.parish_name}
      actions={
        <div className="flex items-center gap-2">
          {linked ? <Pill tone="gold">{HOME_PARISH_BADGE}</Pill> : null}
          {canEdit ? (
            <Button size="sm" variant={linked ? 'secondary' : 'gold'} disabled={busy} onClick={toggleLink}>
              {linked ? UNLINK_HOME_PARISH_LABEL : LINK_HOME_PARISH_LABEL}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        <h3 className="font-bold">Pastors serving this parish</h3>
        {serving.error ? <Notice tone="error">{serving.error}</Notice> : null}
        {serving.data && serving.data.length === 0 ? <Empty>No pastor is assigned to this parish yet.</Empty> : null}
        <ul className="flex flex-col gap-1">
          {(serving.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded border border-line px-3 py-1">
              <span>
                <span className="font-bold">{pastorName(p)}</span> · {formatPhone(p.phone)} · {p.email || '–'}
              </span>
              {canEdit ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => unassign(p)}>
                  End assignment
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="assign-pastor" className="text-sm font-bold">
              Assign a pastor
            </label>
            <Select id="assign-pastor" value={pick} onChange={(e) => setPick(e.target.value)} disabled={busy || free.length === 0}>
              <option value="">{free.length === 0 ? 'Add the pastor under Council pastors first' : 'Choose a pastor'}</option>
              {free.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {pastorName(p)}
                </option>
              ))}
            </Select>
            <Button size="sm" disabled={busy || pick === ''} onClick={assign}>
              Assign
            </Button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function ParishesAndPastors() {
  const user = useUser();
  const scope = useCouncilScope();
  const parishes = useLoad(() => db.parishes.listByCouncil(scope.councilId), [scope.councilId]);
  const pastors = useLoad(() => db.pastors.listByCouncil(scope.councilId), [scope.councilId]);
  const assignments = useLoad(() => db.pastors.listAssignments(scope.councilId), [scope.councilId]);
  const [selected, setSelected] = useState<Selection>(null);
  const [selectedPastor, setSelectedPastor] = useState<Selection>(null);
  const canEdit = canMaintainCouncilRecords(user, scope.councilId);
  const current = typeof selected === 'number' ? parishes.data?.find((p) => p.id === selected) : undefined;
  const parishName = new Map((parishes.data ?? []).map((p) => [p.id, p.parish_name]));
  const parishesOf = (pastorId: number) =>
    (assignments.data ?? [])
      .filter((a) => a.pastor_id === pastorId)
      .map((a) => parishName.get(a.parish_id) ?? `Parish ${a.parish_id}`)
      .join(', ') || '–';

  const reloadAll = async () => {
    await Promise.all([parishes.reload(), pastors.reload(), assignments.reload()]);
  };

  const saveParish = async (d: Draft, row: Parish | null): Promise<Parish> => {
    const values = {
      parish_name: d.parish_name,
      street_address_1: d.street_address_1,
      street_address_2: blankToNull(d.street_address_2),
      city: d.city,
      state: d.state,
      phone: blankToNull(d.phone),
    };
    const saved = row
      ? await db.parishes.update(user.memberId, row.id, values)
      : await db.parishes.create(user.memberId, { ...values, council_id: scope.councilId });
    await parishes.reload();
    return saved;
  };

  const savePastor = async (d: Draft, row: Pastor | null): Promise<Pastor> => {
    const values = { first_name: d.first_name, last_name: d.last_name, phone: blankToNull(d.phone), email: blankToNull(d.email) };
    const saved = row ? await db.pastors.update(user.memberId, row.id, values) : await db.pastors.create(user.memberId, { ...values, council_id: scope.councilId });
    await pastors.reload();
    return saved;
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>{PARISH_PASTORS_TITLE}</PageTitle>
      <div className="flex flex-col gap-6">
        <RecordGrid
          key={`parishes-${scope.councilId}`}
          noun="parish"
          title="Parishes"
          rows={parishes.data}
          error={parishes.error}
          canEdit={canEdit}
          columns={[
            { label: 'Parish', render: (p) => p.parish_name },
            { label: 'Address', render: (p) => parishAddress(p) },
            { label: 'Phone', render: (p) => formatPhone(p.phone), className: 'whitespace-nowrap' },
            { label: 'Home parish', render: (p) => (p.associated_council_id === scope.councilId ? <Pill tone="gold">{HOME_PARISH_BADGE}</Pill> : '–') },
          ]}
          fields={PARISH_FIELDS}
          blank={() => ({ parish_name: '', street_address_1: '', street_address_2: '', city: '', state: '', phone: '' })}
          toDraft={parishDraft}
          rowLabel={(p) => p.parish_name}
          matches={(p, q) => `${p.parish_name} ${p.city}`.toLowerCase().includes(q)}
          onSave={saveParish}
          onRemove={async (p) => {
            await db.parishes.remove(user.memberId, p.id);
            await parishes.reload();
          }}
          selected={selected}
          onSelect={setSelected}
        />
        {current ? (
          <ParishPanel key={current.id} parish={current} councilId={scope.councilId} pastors={pastors.data ?? []} canEdit={canEdit} onChanged={reloadAll} />
        ) : null}
        <RecordGrid
          key={`pastors-${scope.councilId}`}
          noun="pastor"
          title="Council pastors"
          rows={pastors.data}
          error={pastors.error}
          canEdit={canEdit}
          columns={[
            { label: 'Pastor', render: (p) => pastorName(p) },
            { label: 'Phone', render: (p) => formatPhone(p.phone), className: 'whitespace-nowrap' },
            { label: 'Email', render: (p) => p.email || '–' },
            { label: 'Parishes served', render: (p) => parishesOf(p.id) },
          ]}
          fields={PASTOR_FIELDS}
          blank={() => ({ first_name: '', last_name: '', phone: '', email: '' })}
          toDraft={pastorDraft}
          rowLabel={(p) => `${p.first_name} ${p.last_name}`}
          onSave={savePastor}
          onRemove={async (p) => {
            await db.pastors.remove(user.memberId, p.id);
            await reloadAll();
          }}
          selected={selectedPastor}
          onSelect={setSelectedPastor}
        />
      </div>
    </>
  );
}

export default function ParishesPage() {
  return (
    <RequireArea area="parishes">
      <ParishesAndPastors />
    </RequireArea>
  );
}
