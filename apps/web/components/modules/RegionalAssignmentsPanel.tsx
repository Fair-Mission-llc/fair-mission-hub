'use client';
// Regional Jurisdiction Assignments (Sprint 11 Revision 5.0, /system-settings/regional-assignments, regional.ts).
// Super Admins name District Deputies, State Officers and State Admins anywhere; a State Admin names District Deputies
// and State Officers inside their own state only (the drivers apply assertMayAssignRegional). Each row binds the
// councils the member oversees. Saving gives the member the matching role; the member sees the new desk the next time
// they sign in.
import { useState } from 'react';
import {
  describeError,
  REGIONAL_ASSIGNMENT_LABELS,
  REGIONAL_ASSIGNMENT_TYPES,
  REGIONAL_ASSIGNMENTS_TITLE,
  type RegionalAssignmentType,
} from '@kofc/shared';
import { Button, Empty, Field, HelpTip, Input, Notice, PageTitle, Panel, Select, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export function RegionalAssignmentsPanel() {
  const user = useUser();
  const workspace = useLoad(() => db.regional.getAssignmentWorkspace(user.memberId), [user.memberId]);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [type, setType] = useState<RegionalAssignmentType>('DISTRICT_DEPUTY');
  const [stateCode, setStateCode] = useState('');
  const [councilIds, setCouncilIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const data = workspace.data;
  const stateLimit = data?.stateLimit ?? null;
  const state = stateLimit ?? stateCode;
  const types = REGIONAL_ASSIGNMENT_TYPES.filter((t) => stateLimit === null || t !== 'STATE_ADMIN');
  const councilsInState = (data?.councils ?? []).filter((c) => !state || c.state.toUpperCase() === state.toUpperCase());
  const label = new Map((data?.councils ?? []).map((c) => [c.id, c.label]));

  const run = async (task: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await task();
      setSaved(done);
      await workspace.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (memberId === null) throw new Error('Choose the member to assign.');
      await db.regional.saveAssignment(user.memberId, { memberId, assignmentType: type, stateCode: state, councilIds });
      setCouncilIds([]);
    }, 'Saved. The member sees the new desk the next time they sign in.');

  return (
    <>
      <PageTitle>{REGIONAL_ASSIGNMENTS_TITLE}</PageTitle>
      {workspace.error ? <Notice tone="error">{workspace.error}</Notice> : null}
      {stateLimit ? <Notice tone="info">As a State Admin you assign District Deputies and State Officers in {stateLimit} only.</Notice> : null}
      {data ? (
        <div className="flex flex-col gap-4">
          <Panel title="Current jurisdictions">
            {data.assignments.length === 0 ? (
              <Empty>No member holds a regional jurisdiction yet.</Empty>
            ) : (
              <Table caption="Regional jurisdictions" head={['Member', 'Office', 'State', 'Bound councils', '']}>
                {data.assignments.map((a) => (
                  <tr key={a.id}>
                    <Td>{a.memberName}</Td>
                    <Td>{REGIONAL_ASSIGNMENT_LABELS[a.assignmentType]}</Td>
                    <Td>{a.stateCode}</Td>
                    <Td>{a.councilIds.length === 0 ? 'Every council in the state' : a.councilIds.map((id) => label.get(id) ?? `Council ${id}`).join(', ')}</Td>
                    <Td>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => void run(() => db.regional.removeAssignment(user.memberId, a.memberId), 'Removed.')}>
                        Remove
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Assign a member">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Member" help="Anyone on a council roster you may manage. A member holds one regional office; saving replaces the old one.">
                {(id) => (
                  <Select id={id} value={memberId ?? ''} onChange={(e) => setMemberId(e.target.value === '' ? null : Number(e.target.value))}>
                    <option value="">Choose a member</option>
                    {data.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({label.get(m.councilId) ?? `Council ${m.councilId}`})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Office" help="District Deputy opens the District Desk; State Officer and State Admin open the State Desk. Only a Super Admin makes a State Admin.">
                {(id) => (
                  <Select id={id} value={type} onChange={(e) => setType(e.target.value as RegionalAssignmentType)}>
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {REGIONAL_ASSIGNMENT_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="State" help="The two-letter state the office covers, for example OR. A State Admin's own state is filled in and fixed.">
                {(id) => <Input id={id} value={state} disabled={stateLimit !== null} maxLength={50} onChange={(e) => setStateCode(e.target.value.toUpperCase())} />}
              </Field>
            </div>
            <fieldset className="mt-3 flex flex-col gap-1 rounded border border-line p-2">
              <legend className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-navy">
                Bound councils
                <HelpTip text="A District Deputy oversees exactly the councils checked here (at least one). A State Officer or State Admin already sees every council in the state; check more to add councils from elsewhere." />
              </legend>
              {councilsInState.length === 0 ? (
                <p className="text-sm text-muted">Enter a state to list its councils.</p>
              ) : (
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {councilsInState.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={councilIds.includes(c.id)}
                        onChange={() => setCouncilIds((ids) => (ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                      />
                      {c.label}
                      {c.level === 'STATE' ? ' (State Council)' : ''}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={() => void save()} disabled={busy || memberId === null || !state}>
                {busy ? 'Saving…' : 'Save Assignment'}
              </Button>
            </div>
          </Panel>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {saved ? <Notice tone="info">{saved}</Notice> : null}
        </div>
      ) : workspace.loading ? (
        <p className="text-sm">Loading…</p>
      ) : null}
    </>
  );
}
