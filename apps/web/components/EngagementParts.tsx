'use client';
// Sprint 7A: the Executive Summary's engagement row (reports.councilEngagement). Two cards side by side:
//   - Monthly activity overview: a high-contrast navy card with white text and a gold edge - the month's volunteer
//     count, cash collected (the monthly summary's cash raised), total hours, and every volunteer's name with hours.
//   - Top 5 Volunteers Leaderboard: gold-bordered, the council's Active members ranked by all hours ever logged at its
//     events and activities.
//
// Sprint 7A Extension: the leaderboard and the council history card are shared with the Council Dashboard
// (/member-center, named the Shared Member Center until Sprint 8C) and the roster.
//
// Sprint 11 Revision 6.0: the canonization shield is replaced by the 6-tier merit ladder (components/MeritTierParts.tsx).
// The leaderboard shows the ladder read-only (MeritTierInfo); the milestones are edited only in the Admin Desk's
// Council Lookup Tables drawer (MeritMilestonesPanel).
//
// Sprint 11 Revision 2.0: the Monthly activity overview reads its figures from the month's summary (monthlyActivityFigures),
// the same summary the Net Balance tile reads, so the two never disagree: volunteers are the summary's unique Knights,
// hours its labor hours, and the money its funds raised (cash plus electronic) with the net balance beside it. The
// engagement read now supplies only the names of who served.
import { type ReactNode } from 'react';
import { monthlyActivityFigures, type LeaderboardEntry, type MonthlySummary } from '@kofc/shared';
import { MeritTierInfo } from '@/components/MeritTierParts';
import { Notice } from '@/components/ui';
import { formatDecimalHours, formatMoney, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const MEDALS = ['🥇', '🥈', '🥉'];

export function EngagementCards({
  councilId,
  year,
  month,
  monthLabel,
  summary,
  showLeaderboard = true,
}: {
  councilId: number;
  year: number;
  month: number;
  monthLabel: string;
  summary: MonthlySummary;
  /** Sprint 10 Revision 1.0: false on the Executive Dashboard, which no longer shows the Top 5 Volunteers Leaderboard. */
  showLeaderboard?: boolean;
}) {
  const user = useUser();
  const engagement = useLoad(() => db.reports.councilEngagement(user.memberId, councilId, year, month), [user.memberId, councilId, year, month]);
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  const e = engagement.data;
  const figures = monthlyActivityFigures(summary);

  return (
    <div className={showLeaderboard ? 'grid grid-cols-1 items-start gap-4 xl:grid-cols-2' : 'grid grid-cols-1 gap-4'}>
      <section aria-label="Monthly activity overview" className="rounded border-4 border-gold bg-navy px-5 py-4 text-white">
        <h2 className="font-serif text-xl font-bold">Monthly activity overview · {monthLabel}</h2>
        {engagement.error ? <Notice tone="error">{engagement.error}</Notice> : null}
        <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-gold">Volunteers</dt>
            <dd className="text-4xl font-bold">{figures.volunteers.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-gold">Funds raised</dt>
            <dd className="text-4xl font-bold">{formatMoney(figures.raised)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-gold">Net balance</dt>
            <dd className="text-4xl font-bold">{formatMoney(figures.net)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-gold">Hours served</dt>
            <dd className="text-4xl font-bold">{formatDecimalHours(figures.hours)}</dd>
          </div>
        </dl>
        <h3 className="mt-4 text-sm font-bold text-gold">Who served</h3>
        {e && e.volunteers.length === 0 ? <p className="text-sm">Nobody logged service at the council&apos;s events or activities this month.</p> : null}
        {e && e.volunteers.length > 0 ? (
          <ul className="mt-1 grid max-h-64 grid-cols-1 gap-x-4 overflow-y-auto text-sm sm:grid-cols-2" aria-label="Volunteers this month">
            {e.volunteers.map((v) => (
              <li key={v.memberId} className="flex justify-between gap-2 border-b border-white/20 py-1">
                <span className="font-bold">{formatPersonName(v.firstName, v.lastName)}</span>
                <span>{formatDecimalHours(v.hours)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs">
          Funds raised, net balance, volunteers and hours come from the same monthly ledger as the Net balance tile: {formatMoney(figures.raised)} raised −{' '}
          {formatMoney(figures.spend)} spent.
        </p>
      </section>

      {showLeaderboard ? (
        <Leaderboard entries={e?.leaderboard ?? null}>
          {council.data ? <MeritTierInfo council={council.data} /> : null}
        </Leaderboard>
      ) : null}
    </div>
  );
}

/**
 * The gold-bordered Top 5 Volunteers Leaderboard, shared by the Executive Summary and the Council Dashboard (Sprint 7A
 * Extension). `entries` null while loading; `children` follow the list.
 */
export function Leaderboard({ entries, children }: { entries: readonly LeaderboardEntry[] | null; children?: ReactNode }) {
  return (
    <section aria-label="Top 5 Volunteers Leaderboard" className="rounded border-4 border-gold bg-white px-5 py-4 ring-4 ring-gold/30">
      <h2 className="font-serif text-xl font-bold">🏆 Top 5 Volunteers Leaderboard</h2>
      <p className="text-xs text-muted">Active members ranked by all hours ever logged at the council&apos;s events and activities.</p>
      {entries && entries.length === 0 ? <p className="mt-3 text-sm">No member has logged hours yet. Be the first!</p> : null}
      {entries && entries.length > 0 ? (
        <ol className="mt-3 flex flex-col gap-2" aria-label="Leaderboard">
          {entries.map((l) => (
            <li key={l.memberId} className="flex items-center gap-3 rounded border-2 border-navy px-3 py-2">
              <span className="w-10 text-center text-2xl font-bold text-navy" aria-label={`Rank ${l.rank}`}>
                {MEDALS[l.rank - 1] ?? `#${l.rank}`}
              </span>
              <span className="flex-1 font-bold">{formatPersonName(l.firstName, l.lastName)}</span>
              <span className="rounded bg-gold px-2 py-0.5 text-sm font-bold text-navy">{formatDecimalHours(l.hours)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {children}
    </section>
  );
}

const shortDate = (stamp: string | null) =>
  stamp ? new Date(`${stamp.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';

/**
 * The council history card (Sprint 7A Extension): every council the member has belonged to, oldest first, from
 * members.listAffiliations. Shown on the roster to Admins and on the Council Dashboard to the member.
 */
export function AffiliationHistoryCard({ memberId, title = 'Council membership history' }: { memberId: number; title?: string }) {
  const user = useUser();
  const history = useLoad(() => db.members.listAffiliations(user.memberId, memberId), [user.memberId, memberId]);
  return (
    <section aria-label={title} className="rounded border-2 border-navy bg-white px-4 py-3">
      <h3 className="font-serif text-lg font-bold">{title}</h3>
      {history.error ? <Notice tone="error">{history.error}</Notice> : null}
      {history.data ? (
        <ol className="mt-2 flex flex-col gap-2">
          {history.data.map((h, i) => (
            <li key={h.id ?? `current-${i}`} className={`border-l-4 pl-3 ${h.dateExited ? 'border-line' : 'border-gold'}`}>
              <p className="font-bold">
                {h.councilName}
                {h.councilNumber ? ` (Council ${h.councilNumber})` : ''}
              </p>
              <p className="text-sm">
                {h.status} · joined {shortDate(h.dateJoined)}
                {h.dateExited ? ` · left ${shortDate(h.dateExited)}` : ' · current'}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
