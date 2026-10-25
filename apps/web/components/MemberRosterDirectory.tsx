'use client';
// The Member Roster directory (Sprint 10 Revision 2.0, member-roster.ts): a read-only list of Brother Knights with their
// council, phone, email and degree. It is the /roster page (the sidebar's 'Member Roster' link), the Volunteer Center's
// Fraternal roster tab, and a panel on the Member, Grand Knight and Financial Secretary Desks.
// members.listRoster decides the rows from the signed-in member: their home council and its affiliated councils, with a
// council picker to narrow the list - or, for a Super Admin, every council at once with no picker.
import { useState } from 'react';
import { councilLabel, filterRosterMembers, rosterShowsCouncilPicker } from '@kofc/shared';
import { cx, Empty, Field, Input, NewMemberBadge, Notice, Panel, Select, Table, Td } from '@/components/ui';
import { formatPersonName, formatPhone } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export function MemberRosterDirectory({ compact = false }: { compact?: boolean }) {
  const user = useUser();
  const [councilId, setCouncilId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const roster = useLoad(async () => {
    const [result, degrees] = await Promise.all([db.members.listRoster(user.memberId), db.lookups.list('Degree')]);
    return { ...result, degree: new Map(degrees.map((d) => [d.id, d.Degree])) };
  }, [user.memberId]);
  const data = roster.data;
  const picker = data ? rosterShowsCouncilPicker(data.scope) : false;
  const byId = new Map((data?.councils ?? []).map((c) => [c.id, c]));
  const shown = filterRosterMembers(data?.members ?? [], picker ? councilId : null, query);
  const global = data?.scope === 'global';

  return (
    <Panel title={`Member Roster (${shown.length})`}>
      <div className="mb-3 flex flex-wrap items-end gap-4">
        {picker ? (
          <Field label="Council" className="w-full sm:w-80">
            {(id) => (
              <Select id={id} value={councilId ?? 'all'} onChange={(e) => setCouncilId(e.target.value === 'all' ? null : Number(e.target.value))}>
                <option value="all">All: my council and sister councils</option>
                {(data?.councils ?? []).map((c) => (
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
        {global ? <p className="pb-2 text-xs text-muted">All councils: every Active member on the platform.</p> : null}
      </div>
      {roster.error ? <Notice tone="error">{roster.error}</Notice> : null}
      {data && shown.length === 0 ? <Empty>{query.trim() ? 'Nobody matches the search.' : 'No active members to show yet.'}</Empty> : null}
      {shown.length > 0 ? (
        <div className={cx('overflow-x-auto', compact && 'max-h-96 overflow-y-auto')}>
          <Table caption="Member roster" head={['Name', 'Member #', 'Council', 'Phone', 'Email', 'Degree']}>
            {shown.map((m) => {
              const council = byId.get(m.CouncilID);
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
                </tr>
              );
            })}
          </Table>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted">Active members only. You can also reach a Brother Knight through the Communications Hub.</p>
    </Panel>
  );
}
