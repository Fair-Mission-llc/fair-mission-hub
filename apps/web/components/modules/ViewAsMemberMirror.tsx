'use client';
// View As Member (Sprint 10 Revision 3.0): a council Admin's read-only picture of what one member of their OWN council
// sees - the member's sidebar pillars and links (portalSidebar, with the council's feature flags and tenant type), the
// Active Desks tabs they would get (dashboardTabsFor) and their coming shifts. Nothing is switched: the Admin stays
// signed in as themself, no session token changes hands, and nothing on the page writes. members.getViewAsMirror checks
// on the server that the reader is an Active Admin (or Super Admin) of that member's council (assertMayViewAsMember).
// Token-level impersonation stays with Super Admins helping a council Admin (/system-settings/impersonate).
import { useState } from 'react';
import {
  councilFeatureFlags,
  councilLabel,
  councilTenantType,
  dashboardTabsFor,
  formatShiftWhen,
  mayViewAsMember,
  portalSidebar,
  toIsoDate,
  type Member,
} from '@kofc/shared';
import { NAV } from '@/components/Sidebar';
import { Button, cx, Empty, Field, Input, Notice, Panel, Pill, Table, Td } from '@/components/ui';
import { formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function Mirror({ memberId }: { memberId: number }) {
  const user = useUser();
  const mirror = useLoad(async () => {
    const view = await db.members.getViewAsMirror(user.memberId, memberId);
    const shifts = await db.events.listMemberShifts(memberId, { fromDate: toIsoDate(new Date()) }).catch(() => []);
    return { view, shifts };
  }, [user.memberId, memberId]);
  if (mirror.error) return <Notice tone="error">{mirror.error}</Notice>;
  if (!mirror.data) return <p className="text-sm text-muted">Building the read-only view…</p>;
  const { view, shifts } = mirror.data;
  const m = view.member;
  const actor = {
    memberId: m.id,
    councilId: m.CouncilID,
    memberType: view.memberType as never,
    isOfficer: view.roles.some((r) => r.Officer === 1),
    roles: view.roles.map((r) => r.Role),
    isBudgetDirector: m.IsBudgetDirector === 1,
  };
  const sidebar = portalSidebar(actor, councilFeatureFlags(view.council), councilTenantType(view.council));
  const desks = dashboardTabsFor(actor, m.CouncilID);

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <Notice tone="info">
        Read-only mirror of {formatPersonName(m.MemberFirstName, m.MemberLastName)}&apos;s portal. You are still signed in as yourself; nothing here changes their
        account.
      </Notice>
      <Panel title={formatPersonName(m.MemberFirstName, m.MemberLastName)}>
        <p className="text-sm">
          {view.memberType ?? 'Member'} · #{m.MemberNumber}
          {view.council ? <> · {councilLabel(view.council)}</> : null}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {view.roles.length === 0 ? <span className="text-sm text-muted">No council roles.</span> : null}
          {view.roles.map((r) => (
            <Pill key={r.id} tone={r.Officer === 1 ? 'gold' : 'outline'}>
              {r.Role}
            </Pill>
          ))}
        </div>
      </Panel>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Panel title="Their sidebar">
          <div className="flex flex-col gap-3">
            {sidebar.map((g) => (
              <section key={g.id}>
                <h3 className="font-serif text-base font-bold text-navy">{g.label}</h3>
                <ul className="ml-4 list-disc text-sm">
                  {g.entries.map((e) => (
                    <li key={e.item}>{NAV[e.item]?.label ?? e.item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="Their Active Desks">
            <ul className="flex flex-wrap gap-2">
              {desks.map((d) => (
                <li key={d.id}>
                  <Pill tone="navy">{d.label}</Pill>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={`Their coming shifts (${shifts.length})`}>
            {shifts.length === 0 ? (
              <Empty>No coming shifts.</Empty>
            ) : (
              <Table caption="Coming shifts" head={['When', 'Event', 'Shift']}>
                {shifts.slice(0, 10).map((s) => (
                  <tr key={s.signup.id}>
                    <Td className="whitespace-nowrap">{formatShiftWhen(s.shift)}</Td>
                    <Td>{s.event.EventName}</Td>
                    <Td>{s.shift.ShiftName}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function ViewAsMemberMirror() {
  const user = useUser();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<number | null>(null);
  // Only the reader's own council is ever listed (mayViewAsMember; the server checks again).
  const members = useLoad(() => db.members.listByCouncil(user.councilId), [user.councilId]);
  const q = query.trim().toLowerCase();
  const list = (members.data ?? [])
    .filter((m: Member) => m.id !== user.memberId && mayViewAsMember(user, { councilId: m.CouncilID }))
    .filter((m) => !q || `${m.MemberFirstName} ${m.MemberLastName} ${m.MemberNumber}`.toLowerCase().includes(q));

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel title="Members of your council">
        <Field label="Search by name or number">{(id) => <Input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}</Field>
        {members.error ? <Notice tone="error">{members.error}</Notice> : null}
        <ul className="mt-3 flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
          {list.map((m) => (
            <li key={m.id}>
              <Button
                variant="secondary"
                size="sm"
                className={cx('w-full justify-start', chosen === m.id && 'ring-4 ring-gold')}
                aria-pressed={chosen === m.id}
                onClick={() => setChosen(m.id)}
              >
                {m.MemberLastName}, {m.MemberFirstName} · #{m.MemberNumber}
              </Button>
            </li>
          ))}
        </ul>
        {members.data && list.length === 0 ? <Empty>Nobody matches.</Empty> : null}
      </Panel>
      {chosen === null ? <Empty>Choose a member to see their portal, read-only.</Empty> : <Mirror key={chosen} memberId={chosen} />}
    </div>
  );
}
