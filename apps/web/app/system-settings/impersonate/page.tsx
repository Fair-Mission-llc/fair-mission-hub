'use client';
// Impersonate Council Admin (Sprint 8B as the View-As Member Lookup; Sprint 10 Revision 3.0 limits it to council Admins):
// the Super Admin's cascading directory for "Login As" a local council Admin they are assisting, across every council.
// buildImpersonationTree offers only Admins (assertMayImpersonate refuses anyone else on the server). A
// predictive search box offers names as they are typed (impersonationSuggestions); under it the tree drills down Council
// -> clearance group (Executive Officers, Finance Officers, Recorder & Historian, Other Officers, Council Admins, Appointed
// Seats, Members) -> person (buildImpersonationTree), so no council's roster has to be scrolled. Typing filters the tree
// too and opens every branch that still matches. "View as" starts the read-only view-as session (lib/session.tsx
// impersonate), which switches the portal to the member's own council - its flags, tenant type and timing settings.
// Super Admins only (canOpenImpersonationLookup); /api/admin/impersonate checks the session again on the server.
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  buildImpersonationTree,
  clearanceGroupOf,
  CLEARANCE_GROUPS,
  councilLabel,
  describeError,
  impersonationSuggestions,
  type ImpersonationCandidate,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const GROUP_LABEL = new Map(CLEARANCE_GROUPS.map((g) => [g.id, g.label]));

function Directory() {
  const user = useUser();
  const { impersonate } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const data = useLoad(async () => {
    const [councils, types] = await Promise.all([db.councils.list(), db.lookups.list('MemberType')]);
    const typeName = new Map(types.map((t) => [t.id, t.Type]));
    const rosters = await Promise.all(councils.map((c) => db.members.listByCouncil(c.id)));
    const members = rosters.flat();
    const roles = await Promise.all(members.map((m) => db.members.listRoles(m.id)));
    const people: ImpersonationCandidate[] = members.map((m, i) => ({
      memberId: m.id,
      councilId: m.CouncilID,
      firstName: m.MemberFirstName,
      lastName: m.MemberLastName,
      memberNumber: m.MemberNumber,
      email: m.Email,
      memberType: typeName.get(m.MemberTypeID),
      roles: roles[i].map((r) => r.Role),
      isOfficer: roles[i].some((r) => r.Officer === 1),
    }));
    return { councils, people };
  }, []);

  const councils = data.data?.councils ?? [];
  const people = data.data?.people ?? [];
  const tree = useMemo(() => buildImpersonationTree(councils, people, query, user.memberId), [councils, people, query, user.memberId]);
  const suggestions = useMemo(() => impersonationSuggestions(councils, people, query, user.memberId), [councils, people, query, user.memberId]);
  const labelOf = useMemo(() => new Map(councils.map((c) => [c.id, councilLabel(c)])), [councils]);
  const searching = query.trim() !== '';

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const isOpen = (key: string) => searching || open.has(key);

  const viewAs = async (p: ImpersonationCandidate) => {
    setError(null);
    setBusy(p.memberId);
    try {
      await impersonate(p.memberId);
      // The member may not have this page, so the view opens on everyone's Home (Sprint 8R; '#home' since 8S Corrected).
      router.push('/dashboard#home');
    } catch (err) {
      setError(describeError(err));
      setBusy(null);
    }
  };

  const ViewAsButton = ({ p }: { p: ImpersonationCandidate }) => (
    <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void viewAs(p)} aria-label={`View the portal as ${p.firstName} ${p.lastName}`}>
      {busy === p.memberId ? 'Opening…' : '👥 Impersonate'}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      <Panel title="Find a member">
        <Field label="Name, member number, email, role or council">
          {(id) => (
            <Input
              id={id}
              type="search"
              autoComplete="off"
              placeholder="Start typing: smi, Grand Knight, 15295…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-controls="view-as-suggestions"
            />
          )}
        </Field>
        {searching ? (
          suggestions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No council Admin matches “{query.trim()}”.</p>
          ) : (
            <ul id="view-as-suggestions" aria-label="Suggested members" className="mt-2 flex flex-col divide-y divide-line rounded border-2 border-navy">
              {suggestions.map((p) => (
                <li key={p.memberId} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="min-w-0 text-sm">
                    <span className="font-bold">
                      {p.lastName}, {p.firstName}
                    </span>{' '}
                    <span className="text-muted">
                      · {labelOf.get(p.councilId)} · {GROUP_LABEL.get(clearanceGroupOf(p))}
                    </span>
                  </span>
                  <ViewAsButton p={p} />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Panel>

      <Panel title={`Council directory${data.data ? ` (${tree.matches} ${tree.matches === 1 ? 'member' : 'members'})` : ''}`}>
        {!data.data && !data.error ? <p className="text-sm text-muted">Reading every council&apos;s roster…</p> : null}
        {data.data && tree.councils.length === 0 ? <Empty>No member matches. Clear the search to see every council.</Empty> : null}
        <ul aria-label="Councils" className="flex flex-col gap-2">
          {tree.councils.map((c) => {
            const cKey = `c${c.councilId}`;
            return (
              <li key={c.councilId} className="rounded border-2 border-navy">
                <button
                  type="button"
                  onClick={() => toggle(cKey)}
                  aria-expanded={isOpen(cKey)}
                  className="flex w-full items-center justify-between gap-3 bg-navy/5 px-3 py-2 text-left font-serif text-base font-bold"
                >
                  <span>
                    {isOpen(cKey) ? '▾' : '▸'} {c.label}
                  </span>
                  <Pill tone="outline">{c.count}</Pill>
                </button>
                {isOpen(cKey) ? (
                  <ul aria-label={`${c.label} clearance groups`} className="flex flex-col gap-1 px-3 py-2">
                    {c.groups.map((g) => {
                      const gKey = `${cKey}g${g.id}`;
                      return (
                        <li key={g.id}>
                          <button
                            type="button"
                            onClick={() => toggle(gKey)}
                            aria-expanded={isOpen(gKey)}
                            className={cx('flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-sm font-bold', isOpen(gKey) ? 'bg-gold/30' : 'hover:bg-gold/20')}
                          >
                            <span>
                              {isOpen(gKey) ? '▾' : '▸'} {g.label}
                            </span>
                            <span className="text-muted">{g.people.length}</span>
                          </button>
                          {isOpen(gKey) ? (
                            <ul aria-label={`${g.label} of ${c.label}`} className="ml-5 flex flex-col divide-y divide-line border-l-4 border-gold">
                              {g.people.map((p) => (
                                <li key={p.memberId} className="flex items-center justify-between gap-3 py-1 pl-3">
                                  <span className="min-w-0 text-sm">
                                    <span className="font-bold">
                                      {p.lastName}, {p.firstName}
                                    </span>
                                    <span className="text-muted">
                                      {' '}
                                      · {p.memberType ?? 'Member'}
                                      {p.roles.length > 0 ? ` · ${p.roles.join(', ')}` : ''}
                                    </span>
                                  </span>
                                  <ViewAsButton p={p} />
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

export default function ImpersonationLookupPage() {
  return (
    <RequireArea area="system-settings/impersonate">
      <PageTitle>Impersonate Council Admin</PageTitle>
      <p className="mb-4 text-sm text-muted">
        Impersonation is only for helping a local council Admin. Find the Admin, then click Impersonate to see the portal exactly as they do: their own
        council&apos;s settings, modules and branding. The view is read-only and lasts at most one hour. To see what an ordinary member sees, a council Admin
        uses View As Member instead.
      </p>
      <Directory />
    </RequireArea>
  );
}
