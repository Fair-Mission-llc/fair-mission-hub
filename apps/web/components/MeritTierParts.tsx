'use client';
// Sprint 11 Revision 6.0: the 6-tier merit ladder on the web (merit-tiers.ts), replacing the canonization shield.
//   - MeritTierBadge         the member's tier this fraternal year, with the Charter Member badge (Council Dashboard).
//   - MeritTierInfo          the council's ladder as a read-only block (leaderboard, everywhere outside the editor).
//   - MeritMilestonesPanel   the council's own milestones and institution date, edited in the Council Lookup Tables
//                            drawer of the Admin Desk by the council's Admins and Super Admins only
//                            (councils.setMeritThresholds checks the same rule: ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED).
import { useEffect, useState } from 'react';
import {
  canAdministerCouncil,
  CHARTER_MEMBER_BADGE,
  CHARTER_WINDOW_DAYS,
  councilMeritThresholds,
  describeError,
  HONORARY_TENURE_YEARS,
  MERIT_THRESHOLD_MAX_COUNT,
  MERIT_THRESHOLD_MAX_HOURS,
  MERIT_TIERS,
  meritBadgeText,
  NEW_MEMBER_WINDOW_DAYS,
  type Council,
  type MeritStanding,
  type MeritThresholds,
} from '@kofc/shared';
import { Button, Field, Input, Notice } from '@/components/ui';
import { formatDecimalHours } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

/** One line per tier: what it takes in this council. */
export function meritTierRules(t: MeritThresholds): { label: string; icon: string; rule: string }[] {
  const ladder = (m: MeritThresholds['tier2']) => `${formatDecimalHours(m.hours)}, ${plural(m.events, 'event')} and ${plural(m.meetings, 'meeting')} this fraternal year`;
  const rules = [
    `${NEW_MEMBER_WINDOW_DAYS} days or fewer since the First Degree / Initiation Date`,
    ladder(t.tier2),
    ladder(t.tier3),
    ladder(t.tier4),
    `${plural(t.tier5.meetings, 'meeting')}, ${plural(t.tier5.events, 'separate event')} and ${plural(t.tier5.recruits, 'new member recruit')} this fraternal year`,
    `An executive office (Grand Knight or Deputy Grand Knight), ${HONORARY_TENURE_YEARS}+ years since joining, or awarded by an Admin`,
  ];
  return MERIT_TIERS.map((tier, i) => ({ label: `Tier ${tier.number}: ${tier.label}`, icon: tier.icon, rule: rules[i]! }));
}

/** The council's ladder as a read-only block. */
export function MeritTierInfo({ council }: { council: Council }) {
  const rules = meritTierRules(councilMeritThresholds(council));
  return (
    <section aria-label="Merit tier milestones" className="mt-3 border-t border-line pt-3 text-xs">
      <p className="font-bold">Merit tiers (counts reset every July 1).</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {rules.map((r) => (
          <li key={r.label}>
            <span aria-hidden>{r.icon}</span> <span className="font-bold">{r.label}</span> - {r.rule}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-muted">Read only. The council&apos;s Admins change the milestones in the Admin Desk: Council Lookup Tables.</p>
    </section>
  );
}

/** The member's tier this fraternal year, drawn as a navy crest with a gold rim (the old shield's frame). */
export function MeritTierBadge({ rank }: { rank: MeritStanding }) {
  const m = rank.metrics;
  return (
    <div
      role="img"
      aria-label={`Merit tier: ${meritBadgeText(rank)}.${rank.charterMember ? ` ${CHARTER_MEMBER_BADGE}.` : ''}`}
      className="flex flex-col items-center gap-2 rounded-t-lg rounded-b-[5rem] border-4 border-gold bg-navy px-4 pb-8 pt-4 text-center text-white"
    >
      <span className="text-4xl" aria-hidden>
        {rank.tier?.icon ?? '○'}
      </span>
      <span className="font-serif text-2xl font-bold text-gold">{rank.tier ? rank.tier.label : 'No tier yet'}</span>
      <span className="text-xs">{rank.tier ? `Tier ${rank.tier.number} of 6 · fraternal year ${rank.fraternalYear}` : `Fraternal year ${rank.fraternalYear}`}</span>
      {rank.charterMember ? <span className="rounded bg-gold px-2 py-0.5 text-xs font-bold text-navy">{CHARTER_MEMBER_BADGE}</span> : null}
      <span className="text-xs">
        This year: {formatDecimalHours(m.hours)} · {plural(m.events, 'event')} · {plural(m.meetings, 'meeting')} · {plural(m.recruits, 'recruit')}
      </span>
      <span className="text-xs">
        {rank.next
          ? `Next: ${rank.next.tier.label} - ${[
              rank.next.hoursNeeded > 0 ? formatDecimalHours(rank.next.hoursNeeded) : null,
              rank.next.eventsNeeded > 0 ? plural(rank.next.eventsNeeded, 'event') : null,
              rank.next.meetingsNeeded > 0 ? plural(rank.next.meetingsNeeded, 'meeting') : null,
            ]
              .filter(Boolean)
              .join(', ')} to go`
          : 'Fraternal Champion milestones met. Thank you for your service!'}
      </span>
    </div>
  );
}

type Draft = Record<'tier2' | 'tier3' | 'tier4' | 'tier5', Record<string, string>>;
const toDraft = (t: MeritThresholds): Draft =>
  Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([m, n]) => [m, String(n)]))])) as Draft;

const ROWS: { key: keyof Draft; title: string; metrics: { key: string; label: string; max: number }[] }[] = [
  ...(['tier2', 'tier3', 'tier4'] as const).map((key, i) => ({
    key,
    title: `Tier ${i + 2}: ${MERIT_TIERS[i + 1]!.label}`,
    metrics: [
      { key: 'hours', label: 'Hours', max: MERIT_THRESHOLD_MAX_HOURS },
      { key: 'events', label: 'Events', max: MERIT_THRESHOLD_MAX_COUNT },
      { key: 'meetings', label: 'Meetings', max: MERIT_THRESHOLD_MAX_COUNT },
    ],
  })),
  {
    key: 'tier5',
    title: `Tier 5: ${MERIT_TIERS[4]!.label}`,
    metrics: [
      { key: 'meetings', label: 'Meetings', max: MERIT_THRESHOLD_MAX_COUNT },
      { key: 'events', label: 'Separate events', max: MERIT_THRESHOLD_MAX_COUNT },
      { key: 'recruits', label: 'Recruits', max: MERIT_THRESHOLD_MAX_COUNT },
    ],
  },
];

/** The milestone override panel (Admin Desk > Council Lookup Tables > Merit Tier Milestones). */
export function MeritMilestonesPanel({ councilId }: { councilId: number }) {
  const user = useUser();
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  const [draft, setDraft] = useState<Draft>(toDraft(councilMeritThresholds(null)));
  const [instituted, setInstituted] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => {
    if (!council.data) return;
    setDraft(toDraft(councilMeritThresholds(council.data)));
    setInstituted(council.data.institution_date ?? '');
  }, [council.data]);

  if (!canAdministerCouncil(user, councilId)) {
    return <Notice tone="error">Only the council&apos;s Admins and Super Admins can set the merit tier milestones.</Notice>;
  }

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const numbers = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([m, s]) => [m, s.trim() === '' ? NaN : Number(s)]))]));
      await db.councils.setMeritThresholds(user.memberId, councilId, numbers as unknown as MeritThresholds, instituted === '' ? null : instituted);
      setMessage({ tone: 'info', text: 'Merit tier milestones saved.' });
      council.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="Merit tier milestones"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-sm">
        Members earn the highest tier they qualify for. Hours, events, meetings and recruits count inside the current fraternal year (July 1 to June 30) and reset every July
        1. Tier 1 ({NEW_MEMBER_WINDOW_DAYS} days from the First Degree / Initiation Date) and Tier 6 (executive office, {HONORARY_TENURE_YEARS}+ years, or the Admin&apos;s
        Honorary switch on the member record) are fixed.
      </p>
      {council.error ? <Notice tone="error">{council.error}</Notice> : null}
      <Field label="Council institution date" help={`Members whose First Degree / Initiation Date is on or before this date + ${CHARTER_WINDOW_DAYS} days are marked charter members when saved.`} className="w-56">
        {(id) => <Input id={id} type="date" value={instituted} onChange={(e) => setInstituted(e.target.value)} />}
      </Field>
      {ROWS.map((row) => (
        <fieldset key={row.key} className="rounded border border-line p-3">
          <legend className="px-1 text-sm font-bold">{row.title}</legend>
          <div className="flex flex-wrap items-end gap-2">
            {row.metrics.map((metric) => (
              <Field key={metric.key} label={metric.label} className="w-32">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    max={metric.max}
                    step={1}
                    value={draft[row.key][metric.key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [row.key]: { ...d[row.key], [metric.key]: e.target.value } }))}
                  />
                )}
              </Field>
            ))}
          </div>
        </fieldset>
      ))}
      <div>
        <Button type="submit" disabled={busy || !council.data}>
          {busy ? 'Saving…' : 'Save milestones'}
        </Button>
      </div>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
    </form>
  );
}
