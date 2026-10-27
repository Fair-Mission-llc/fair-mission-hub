'use client';
// The District Deputy Desk (/district-desk) and the State Oversight Desk (/state-desk) - Sprint 11 Revision 5.0,
// regional.ts. One report (regional.getRegionalDesk) feeds both:
//   - the Static Top Deck: councils, volunteer hours this fraternal year, gross cash balances and physical assets. It
//     never collapses, and reloads every minute and on Refresh;
//   - eight drawers down the left (REGIONAL_DESK_DRAWERS), all closed on landing; one opens its panel to the right.
// Drawer 5's calendar filters by any set of councils (filterRegionalCalendar); drawer 8's leaderboard shows the
// region's Top 10, or a chosen council's Top 5 (topVolunteers). Everything here is read-only.
import { useEffect, useMemo, useState } from 'react';
import {
  COUNCIL_LEADERBOARD_SIZE,
  DISTRICT_DESK_TITLE,
  filterRegionalCalendar,
  formatDate,
  REGIONAL_DESK_DRAWERS,
  REGIONAL_LEADERBOARD_SIZE,
  STATE_DESK_TITLE,
  topVolunteers,
  type RegionalDesk as RegionalDeskKind,
  type RegionalDeskDrawerId,
  type RegionalDeskReport,
} from '@kofc/shared';
import { Button, cx, Empty, Notice, PageTitle, Pill, Select, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const REFRESH_MS = 60_000;
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const hours = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} h`;

function councilLabels(report: RegionalDeskReport): Map<number, string> {
  return new Map(report.councils.map((c) => [c.councilId, c.level === 'STATE' ? c.councilName : `${c.councilNumber} - ${c.councilName}`]));
}

/** The Static Top Deck: always visible, never collapsed. */
function TopDeck({ report, onRefresh, loading }: { report: RegionalDeskReport; onRefresh: () => void; loading: boolean }) {
  const tiles: [string, string, string][] = [
    ['Councils', String(report.totals.councils), report.desk === 'district' ? 'in your district' : 'in your state'],
    ['Volunteer Hours', hours(report.totals.volunteerHours), `fraternal year ${report.fraternalYear}`],
    ['Gross Cash Balances', money(report.totals.grossBalance), 'all checking and savings, to date'],
    ['Physical Assets', String(report.totals.assetCount), `${money(report.totals.assetValue)} at cost`],
  ];
  return (
    <section aria-label="Regional totals" className="flex flex-col gap-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, note]) => (
          <article key={label} className="rounded border-2 border-navy border-t-8 border-t-gold bg-white p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{label}</h2>
            <p className="font-serif text-3xl font-bold text-navy">{value}</p>
            <p className="text-xs text-muted">{note}</p>
          </article>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 text-xs text-muted">
        <span>Updates every minute.</span>
        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
    </section>
  );
}

function DirectoryPanel({ report }: { report: RegionalDeskReport }) {
  const names = councilLabels(report);
  return (
    <div className="flex flex-col gap-4">
      <Table caption="Councils in the region" head={['Council', 'State', 'District', 'Level', 'Active members']}>
        {report.councils.map((c) => (
          <tr key={c.councilId}>
            <Td>{names.get(c.councilId)}</Td>
            <Td>{c.state}</Td>
            <Td>{c.districtNumber ?? '-'}</Td>
            <Td>{c.level === 'STATE' ? <Pill tone="gold">State Council</Pill> : 'Local'}</Td>
            <Td>{c.activeMembers}</Td>
          </tr>
        ))}
      </Table>
      <h3 className="font-serif text-lg font-bold text-navy">Affiliation networks</h3>
      {report.affiliations.length === 0 ? (
        <Empty>No active sister-council links in the region.</Empty>
      ) : (
        <ul className="list-disc pl-5 text-sm">
          {report.affiliations.map((a) => (
            <li key={`${a.councilId}-${a.sisterCouncilId}`}>
              {names.get(a.councilId) ?? `Council ${a.councilId}`} ↔ {names.get(a.sisterCouncilId) ?? `Council ${a.sisterCouncilId} (outside the region)`}
              {a.since ? ` - since ${formatDate(a.since)}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FinancesPanel({ report }: { report: RegionalDeskReport }) {
  const names = councilLabels(report);
  const sum = (k: 'cashBalance' | 'revenue' | 'expenses') => report.councils.reduce((s, c) => s + c[k], 0);
  return (
    <Table caption="Balances and this fraternal year's revenue and costs" head={['Council', 'Cash balance', 'Revenue (year)', 'Costs (year)', 'Net (year)']}>
      {report.councils.map((c) => (
        <tr key={c.councilId}>
          <Td>{names.get(c.councilId)}</Td>
          <Td>{money(c.cashBalance)}</Td>
          <Td>{money(c.revenue)}</Td>
          <Td>{money(c.expenses)}</Td>
          <Td>{money(c.revenue - c.expenses)}</Td>
        </tr>
      ))}
      <tr className="font-bold">
        <Td>Region total</Td>
        <Td>{money(sum('cashBalance'))}</Td>
        <Td>{money(sum('revenue'))}</Td>
        <Td>{money(sum('expenses'))}</Td>
        <Td>{money(sum('revenue') - sum('expenses'))}</Td>
      </tr>
    </Table>
  );
}

function HoursPanel({ report }: { report: RegionalDeskReport }) {
  const names = councilLabels(report);
  return (
    <Table caption="Volunteer hours this fraternal year" head={['Council', 'Shift hours', 'Activity hours', 'Total', 'Volunteers']}>
      {report.councils.map((c) => (
        <tr key={c.councilId}>
          <Td>{names.get(c.councilId)}</Td>
          <Td>{hours(c.eventHours)}</Td>
          <Td>{hours(c.activityHours)}</Td>
          <Td className="font-bold">{hours(c.totalHours)}</Td>
          <Td>{c.volunteers}</Td>
        </tr>
      ))}
    </Table>
  );
}

function CharityPanel({ report }: { report: RegionalDeskReport }) {
  const names = councilLabels(report);
  return (
    <div className="flex flex-col gap-4">
      <Table caption="Charity grants by council" head={['Council', 'Grants paid', 'Amount']}>
        {report.councils.map((c) => (
          <tr key={c.councilId}>
            <Td>{names.get(c.councilId)}</Td>
            <Td>{c.charityCount}</Td>
            <Td>{money(c.charityTotal)}</Td>
          </tr>
        ))}
      </Table>
      <h3 className="font-serif text-lg font-bold text-navy">Grant audit trail</h3>
      {report.grants.length === 0 ? (
        <Empty>No charity grants paid this fraternal year.</Empty>
      ) : (
        <Table caption="Every grant paid this fraternal year" head={['Date', 'Council', 'Charity', 'Check', 'Amount']}>
          {report.grants.map((g) => (
            <tr key={g.id}>
              <Td>{formatDate(g.payoutDate)}</Td>
              <Td>{names.get(g.councilId)}</Td>
              <Td>{g.charityName}</Td>
              <Td>{g.checkNumber ?? '-'}</Td>
              <Td>{money(g.amount)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function CalendarPanel({ report }: { report: RegionalDeskReport }) {
  const names = councilLabels(report);
  const [chosen, setChosen] = useState<number[]>([]);
  const items = filterRegionalCalendar(report.calendar, chosen);
  const toggle = (id: number) => setChosen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-line p-2">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-navy">Show councils (none checked shows all)</legend>
        {report.councils.map((c) => (
          <label key={c.councilId} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={chosen.includes(c.councilId)} onChange={() => toggle(c.councilId)} />
            {names.get(c.councilId)}
          </label>
        ))}
      </fieldset>
      {items.length === 0 ? (
        <Empty>Nothing on the calendar for these councils in the next months.</Empty>
      ) : (
        <Table caption="Upcoming events and meetings" head={['Date', 'What', 'Councils', 'Where']}>
          {items.map((i) => (
            <tr key={`${i.kind}-${i.id}`}>
              <Td>{formatDate(i.date)}</Td>
              <Td>
                {i.title} <Pill tone="outline">{i.kind === 'event' ? 'Event' : 'Meeting'}</Pill>
              </Td>
              <Td>{i.councilIds.map((id) => names.get(id)).join(', ')}</Td>
              <Td>{i.location || '-'}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function AssetsPanel({ report }: { report: RegionalDeskReport }) {
  const names = councilLabels(report);
  return report.assets.length === 0 ? (
    <Empty>No physical assets are recorded in the region.</Empty>
  ) : (
    <Table caption="Every council's physical assets" head={['Council', 'Asset', 'Bought', 'Cost', 'Status', 'Kept at']}>
      {report.assets.map((a) => (
        <tr key={a.id}>
          <Td>{names.get(a.councilId)}</Td>
          <Td>{a.name}</Td>
          <Td>{formatDate(a.purchaseDate)}</Td>
          <Td>{money(a.costBasis)}</Td>
          <Td>{a.status}</Td>
          <Td>{a.location ?? '-'}</Td>
        </tr>
      ))}
    </Table>
  );
}

function Progress({ label, actual, target, format }: { label: string; actual: number; target: number | null; format: (n: number) => string }) {
  const pct = target && target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs">
        <span className="font-bold text-navy">{label}</span>
        <span>
          {format(actual)}
          {target !== null ? ` of ${format(target)}` : ' (no target set)'}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded border border-navy bg-white" role="img" aria-label={pct === null ? `${label}: no target` : `${label}: ${pct}% of target`}>
        <div className="h-full bg-gold" style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
}

function GoalsPanel({ report }: { report: RegionalDeskReport }) {
  const names = councilLabels(report);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {report.goals.map((g) => (
        <article key={g.councilId} className="flex flex-col gap-2 rounded border border-line p-3">
          <h3 className="font-serif text-base font-bold text-navy">{names.get(g.councilId)}</h3>
          <Progress label="Volunteer hours" actual={g.hours.actual} target={g.hours.target} format={hours} />
          <Progress label="New members" actual={g.newMembers.actual} target={g.newMembers.target} format={(n) => String(n)} />
          <Progress label="Fundraising" actual={g.fundraising.actual} target={g.fundraising.target} format={money} />
        </article>
      ))}
    </div>
  );
}

function LeaderboardPanel({ report }: { report: RegionalDeskReport }) {
  const names = councilLabels(report);
  const [councilId, setCouncilId] = useState<number | null>(null);
  const board = topVolunteers(report.volunteers, councilId);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex max-w-md flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-navy">Show</span>
        <Select value={councilId ?? ''} onChange={(e) => setCouncilId(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Top {REGIONAL_LEADERBOARD_SIZE} across the {report.desk === 'district' ? 'district' : 'state'}</option>
          {report.councils.map((c) => (
            <option key={c.councilId} value={c.councilId}>
              Top {COUNCIL_LEADERBOARD_SIZE} of {names.get(c.councilId)}
            </option>
          ))}
        </Select>
      </label>
      {board.length === 0 ? (
        <Empty>No volunteer hours logged here this fraternal year yet.</Empty>
      ) : (
        <ol className="flex flex-col gap-1">
          {board.map((v, i) => (
            <li key={v.memberId} className={cx('flex items-center gap-3 rounded border border-line px-3 py-2', i === 0 && 'border-2 border-gold')}>
              <span className="w-8 font-serif text-xl font-bold text-navy">{i + 1}</span>
              <span className="flex-1">
                <span className="font-bold">{v.name}</span>
                <span className="block text-xs text-muted">{names.get(v.councilId)}</span>
              </span>
              <span className="font-bold">{hours(v.hours)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DrawerPanel({ id, report }: { id: RegionalDeskDrawerId; report: RegionalDeskReport }) {
  switch (id) {
    case 'directory':
      return <DirectoryPanel report={report} />;
    case 'finances':
      return <FinancesPanel report={report} />;
    case 'hours':
      return <HoursPanel report={report} />;
    case 'charity':
      return <CharityPanel report={report} />;
    case 'calendar':
      return <CalendarPanel report={report} />;
    case 'assets':
      return <AssetsPanel report={report} />;
    case 'goals':
      return <GoalsPanel report={report} />;
    case 'leaderboard':
      return <LeaderboardPanel report={report} />;
  }
}

export function RegionalDesk({ desk }: { desk: RegionalDeskKind }) {
  const user = useUser();
  const report = useLoad(() => db.regional.getRegionalDesk(user.memberId, desk), [user.memberId, desk]);
  // Every drawer lands closed; one opens at a time, its panel drawn to the right of the rail.
  const [open, setOpen] = useState<RegionalDeskDrawerId | null>(null);
  const drawer = useMemo(() => REGIONAL_DESK_DRAWERS.find((d) => d.id === open) ?? null, [open]);

  // The top deck keeps itself current.
  useEffect(() => {
    const timer = window.setInterval(() => void report.reload(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [report.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = report.data;
  return (
    <>
      <PageTitle>{desk === 'district' ? DISTRICT_DESK_TITLE : STATE_DESK_TITLE}</PageTitle>
      {report.error ? <Notice tone="error">{report.error}</Notice> : null}
      {!data ? (
        <p className="text-sm">{report.loading ? 'Loading the regional report…' : ''}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <TopDeck report={data} onRefresh={() => void report.reload()} loading={report.loading} />
          <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <nav aria-label={`${desk === 'district' ? 'District' : 'State'} desk drawers`} className="flex flex-col gap-2">
              {REGIONAL_DESK_DRAWERS.map((d, i) => {
                const here = d.id === open;
                return (
                  <button
                    key={d.id}
                    type="button"
                    id={`regional-drawer-${d.id}`}
                    aria-expanded={here}
                    aria-controls="regional-desk-panel"
                    onClick={() => setOpen(here ? null : d.id)}
                    className={cx(
                      'flex w-full flex-col gap-0.5 rounded border-2 border-navy border-l-8 border-l-gold px-3 py-2 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-gold',
                      here ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-gold/20',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 font-serif text-base font-bold">
                      <span>
                        {i + 1}. {d.label}
                      </span>
                      <span aria-hidden="true" className={cx('inline-block motion-safe:transition-transform', here && 'rotate-180')}>
                        ›
                      </span>
                    </span>
                    <span className={cx('text-xs', here ? 'text-white' : 'text-muted')}>{d.hint}</span>
                  </button>
                );
              })}
            </nav>
            <section
              id="regional-desk-panel"
              aria-label={drawer ? drawer.label : 'Regional desk panel'}
              aria-live="polite"
              className={cx('min-w-0 rounded border-2 border-navy bg-white', drawer ? 'border-t-8 border-t-gold p-4 motion-safe:animate-slide-in' : 'p-6')}
            >
              {drawer ? (
                <>
                  <h2 className="mb-3 font-serif text-xl font-bold text-navy">{drawer.label}</h2>
                  <DrawerPanel id={drawer.id} report={data} />
                </>
              ) : (
                <p className="text-sm text-muted">Every drawer is closed. Open one on the left to see it here.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
