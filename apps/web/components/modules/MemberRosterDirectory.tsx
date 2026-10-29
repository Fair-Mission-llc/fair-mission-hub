'use client';
// The Roster & Achievements directory (Sprint 10 Revision 2.0, member-roster.ts): Brother Knights with their council, phone,
// email and degree. It is the /roster page (the sidebar's 'Roster & Achievements' link), the Volunteer Center's Fraternal roster
// tab, and a panel on the Member, Grand Knight and Financial Secretary Desks.
// members.listRoster decides the rows from the signed-in member: their home council and its affiliated councils - or,
// for a Super Admin, every council. Every reader gets a council picker (Sprint 10 Revision 3.0 restored it for the
// Super Admin's global list: 'All councils on the platform' or one council).
//
// Sprint 10 Revision 3.0: the roster is also where member records are kept. The Affiliated Roster page (/members) is
// gone. The council's Admins (their own council) and Super Admins (any council) get:
//   - 'Add Member' (canCreateMembers), adding to the council chosen in the picker, else their own council;
//   - an 'Edit' button on each row they may change (canEditMember), opening the record form in a drawer with the
//     member's Skills & training and their council membership history;
//   - every status, not only Active, for the councils they administer (listRoster { allStatuses: true }), with a Status
//     column;
//   - for a Super Admin, an 'Impersonate Admin' button on each council Admin's row (mayImpersonateMember).
// Sprint 10 Revision 3.1: the council's Financial Secretary gets 'Send new setup code' on each row of their own council
// (canResendSetupCode; the server: assertMayResendSetupCode), without Admin rights.
// The drivers check every write again, so a refusal is reported, never hidden.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  canCreateMembers,
  canEditMember,
  canResendSetupCode,
  councilLabel,
  describeError,
  filterRosterMembers,
  isAdmin,
  mayImpersonateMember,
  rosterAllCouncilsLabel,
  rosterShowsCouncilPicker,
  type Member,
} from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { AffiliationHistoryCard } from '@/components/EngagementParts';
import { MemberForm, type Lookups } from '@/components/modules/MemberRecordForm';
import { ProfileExtensionsEditor } from '@/components/ProfileExtensionsEditor';
import { SkillFilterDrawer } from '@/components/SkillFilterDrawer';
import { Button, cx, Empty, Field, Input, NewMemberBadge, Notice, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { formatPersonName, formatPhone } from '@/lib/format';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Editing = { kind: 'new'; councilId: number } | { kind: 'edit'; member: Member };

function RecordDrawer({ editing, lookups, onClose, onSaved }: { editing: Editing; lookups: Lookups; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const user = useUser();
  const [skillsOpen, setSkillsOpen] = useState(false);
  const member = editing.kind === 'edit' ? editing.member : null;
  const councilId = editing.kind === 'edit' ? editing.member.CouncilID : editing.councilId;
  return (
    <Drawer title={member ? `Edit ${formatPersonName(member.MemberFirstName, member.MemberLastName)}` : 'Add Member'} onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        {member && canEditMember(user, member) ? (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setSkillsOpen((v) => !v)} aria-expanded={skillsOpen}>
              {skillsOpen ? 'Back to the record' : 'Skills & training'}
            </Button>
          </div>
        ) : null}
        {member && skillsOpen ? (
          <ProfileExtensionsEditor memberId={member.id} showWorkingStatus={false} />
        ) : (
          <MemberForm
            member={member}
            councilId={councilId}
            lookups={lookups}
            onSaved={() => {
              void onSaved();
              if (!member) onClose();
            }}
          />
        )}
        {/* Sprint 7A Extension: every council the member has belonged to, kept across transfers. */}
        {member ? <AffiliationHistoryCard key={`${member.id}-${member.CouncilID}-${member.StatusID}`} memberId={member.id} /> : null}
      </div>
    </Drawer>
  );
}

export function MemberRosterDirectory({ compact = false }: { compact?: boolean }) {
  const user = useUser();
  const { impersonate } = useSession();
  const router = useRouter();
  const manager = isAdmin(user);
  const [councilId, setCouncilId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [skillsCouncil, setSkillsCouncil] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roster = useLoad(async () => {
    const [result, degrees, statuses, types] = await Promise.all([
      db.members.listRoster(user.memberId, manager ? { allStatuses: true } : undefined),
      db.lookups.list('Degree'),
      manager ? db.lookups.list('MemberStatus') : Promise.resolve([]),
      db.lookups.list('MemberType'),
    ]);
    return {
      ...result,
      degrees,
      statuses,
      types,
      degree: new Map(degrees.map((d) => [d.id, d.Degree])),
      status: new Map(statuses.map((s) => [s.id, s.Status])),
      type: new Map(types.map((t) => [t.id, t.Type])),
    };
  }, [user.memberId, manager]);
  const data = roster.data;
  const picker = data ? rosterShowsCouncilPicker(data.scope) : false;
  const byId = new Map((data?.councils ?? []).map((c) => [c.id, c]));
  const shown = filterRosterMembers(data?.members ?? [], picker ? councilId : null, query);
  const addTo = councilId ?? user.councilId;
  const mayAdd = manager && canCreateMembers(user, addTo);
  const lookups: Lookups | null = data && manager ? { statuses: data.statuses, degrees: data.degrees, types: data.types } : null;
  const showStatus = manager;
  // Sprint 10 Revision 3.1: the council's Financial Secretary sends setup codes on their own, without Admin rights.
  const onboarder = !manager && canResendSetupCode(user, user.councilId);
  const rowActions = manager || onboarder;
  const [sending, setSending] = useState<number | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const resend = async (m: Member) => {
    setError(null);
    setSent(null);
    setSending(m.id);
    try {
      await db.members.resendWelcome(user.memberId, m.id);
      setSent(`A new welcome email with a fresh setup code was sent to ${m.Email}.`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(null);
    }
  };

  const viewAs = async (memberId: number) => {
    setError(null);
    try {
      await impersonate(memberId);
      // The Admin may not have this page, so the view opens on everyone's Home.
      router.push('/dashboard#home');
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <Panel
      title={`Roster & Achievements (${shown.length})`}
      actions={
        manager ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSkillsCouncil(addTo)}>
              Skills
            </Button>
            {mayAdd && lookups ? (
              <Button size="sm" onClick={() => setEditing({ kind: 'new', councilId: addTo })}>
                Add Member
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-4">
        {picker && data ? (
          <Field label="Council" className="w-full sm:w-80">
            {(id) => (
              <Select id={id} value={councilId ?? 'all'} onChange={(e) => setCouncilId(e.target.value === 'all' ? null : Number(e.target.value))}>
                <option value="all">{rosterAllCouncilsLabel(data.scope)}</option>
                {data.councils.map((c) => (
                  <option key={c.id} value={c.id}>
                    {councilLabel(c)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field label="Search by name or number" className="w-full sm:w-72">
          {(id) => <Input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}
        </Field>
        {mayAdd && byId.get(addTo) ? <p className="pb-2 text-xs text-muted">Add Member adds to {councilLabel(byId.get(addTo)!)}.</p> : null}
      </div>
      {roster.error ? <Notice tone="error">{roster.error}</Notice> : null}
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      {sent ? (
        <Notice tone="info" onDismiss={() => setSent(null)}>
          {sent}
        </Notice>
      ) : null}
      {data && shown.length === 0 ? <Empty>{query.trim() ? 'Nobody matches the search.' : 'No members to show yet.'}</Empty> : null}
      {shown.length > 0 ? (
        <div className={cx('overflow-x-auto', compact && 'max-h-96 overflow-y-auto')}>
          <Table
            caption="Member roster"
            head={['Name', 'Member #', 'Council', 'Phone', 'Email', 'Degree', ...(showStatus ? ['Status'] : []), ...(rowActions ? ['Actions'] : [])]}
          >
            {shown.map((m) => {
              const council = byId.get(m.CouncilID);
              const status = data?.status.get(m.StatusID);
              const typeName = data?.type.get(m.MemberTypeID);
              return (
                <tr key={m.id}>
                  <Td className="font-bold">
                    {formatPersonName(m.MemberFirstName, m.MemberLastName)}
                    <NewMemberBadge member={m} />
                  </Td>
                  <Td>{m.MemberNumber}</Td>
                  <Td>{council ? councilLabel(council) : m.CouncilID}</Td>
                  <Td className="whitespace-nowrap">{formatPhone(m.Phone)}</Td>
                  <Td>
                    {m.Email ? (
                      <a href={`mailto:${m.Email}`} className="break-all underline">
                        {m.Email}
                      </a>
                    ) : (
                      '–'
                    )}
                  </Td>
                  <Td>{data?.degree.get(m.DegreeID) ?? '–'}</Td>
                  {showStatus ? <Td>{status === 'Active' || !status ? (status ?? '–') : <Pill tone="outline">{status}</Pill>}</Td> : null}
                  {rowActions ? (
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {canEditMember(user, m) && lookups ? (
                          <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: 'edit', member: m })} aria-label={`Edit ${m.MemberFirstName} ${m.MemberLastName}`}>
                            Edit
                          </Button>
                        ) : null}
                        {onboarder && canResendSetupCode(user, m.CouncilID) ? (
                          <Button size="sm" variant="secondary" disabled={sending !== null} onClick={() => void resend(m)} aria-label={`Send ${m.MemberFirstName} ${m.MemberLastName} a new setup code`}>
                            {sending === m.id ? 'Sending…' : 'Send new setup code'}
                          </Button>
                        ) : null}
                        {mayImpersonateMember(user, { memberId: m.id, memberType: typeName }) ? (
                          <Button size="sm" variant="secondary" onClick={() => void viewAs(m.id)} aria-label={`Impersonate ${m.MemberFirstName} ${m.MemberLastName}`}>
                            👥 Impersonate Admin
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  ) : null}
                </tr>
              );
            })}
          </Table>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        {manager ? 'Councils you administer show every status; other councils show Active members only.' : 'Active members only.'} You can also reach a Brother
        Knight through the Communications Hub.
      </p>
      {editing && lookups ? <RecordDrawer editing={editing} lookups={lookups} onClose={() => setEditing(null)} onSaved={roster.reload} /> : null}
      {skillsCouncil !== null ? <SkillFilterDrawer councilId={skillsCouncil} onClose={() => setSkillsCouncil(null)} /> : null}
    </Panel>
  );
}
