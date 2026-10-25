'use client';
// The Volunteer Check-In & Service Center (Sprint 8R): the volunteer side of the portal. Sprint 8R placed it on Home,
// Sprint 8R Corrected moved it to the Member Desk under the twin shift trackers, and Sprint 8S Revision gives it one home:
// the Member Actions Hub (app/member-actions/page.tsx), where it is the only module on the canvas. Admins and Super
// Admins are Brother Knights who work shifts too, so every signed-in member gets the same four tabs:
//   - My active shifts: upcoming signups; a shift within URGENT_WITHIN_DAYS (48 hours) is shown in Secondary Red.
//   - Registration desk: open shifts of my council and its sister councils that still need volunteers to reach
//     MinNumberVolunteers. events.signupForShift adds the seat and increments NumberVolunteersSignedUp in one step,
//     and refuses a full (locked) shift, so the desk only offers rows with room.
//   - Fraternal roster: Active members of my council and its sister councils with their phone and email, the same
//     contact details the council's shared roster sheet already gives every member.
//   - Hour ledger: log time against a shift I worked or a council activity, back to the council's logging window
//     (Council.volunteer_logging_window_days, Sprint 7E), with my logged history underneath. The drivers enforce the
//     window again.
// Sprint 6A: when the council switches off flag_complex_shifts, the two shift tabs and the shift half of the hour ledger
// go, leaving the roster and the activity log.
// Sprint 8Q: the council's newest newsletters (LatestBulletinsFeed) led the page; since Sprint 8R they lead Home.
import { useState, type ReactNode } from 'react';
import {
  councilLabel,
  describeError,
  feedWindow,
  formatHours,
  formatShiftWhen,
  HOUR_OPTIONS,
  hoursToPicker,
  isAllHandsShift,
  isQuarantinedHours,
  isShiftFull,
  isUrgent,
  loggingWindowStart,
  MINUTE_OPTIONS,
  padMinutes,
  pickerResult,
  quarantinedHoursMessage,
  shiftStatus,
  sortCouncils,
  toIsoDate,
  visibleFeed,
  type Council,
  type Shift,
  VOLUNTEER_CENTER_TITLE,
} from '@kofc/shared';
import { MemberRosterDirectory } from '@/components/MemberRosterDirectory';
import { useCouncilTimings } from '@/components/SettingsParts';
import { Button, cx, Empty, Field, Input, Notice, Panel, Pill, Select, Table, Tabs, Td } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useFeatureFlags, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };
type Tab = 'shifts' | 'desk' | 'roster' | 'hours';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'shifts', label: 'My active shifts' },
  { id: 'desk', label: 'Registration desk' },
  { id: 'roster', label: 'Fraternal roster' },
  { id: 'hours', label: 'Hour ledger' },
];

function useAction() {
  const [message, setMessage] = useState<Message | null>(null);
  // An action may resolve to its own message, such as a time entry held for review (Sprint 7B).
  const run = async (action: () => Promise<string | void>, done: string): Promise<boolean> => {
    setMessage(null);
    try {
      const said = await action();
      setMessage({ tone: 'info', text: said ?? done });
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
      return false;
    }
  };
  const banner = message ? (
    <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
      {message.text}
    </Notice>
  ) : null;
  return { run, banner };
}

/** My council first, then its sister councils in CouncilNumber order. */
function useFraternalCouncils() {
  const user = useUser();
  return useLoad(async () => {
    const [own, sisters] = await Promise.all([db.councils.get(user.councilId), db.councils.listAffiliated(user.councilId)]);
    return [...(own ? [own] : []), ...sortCouncils(sisters)];
  }, [user.councilId]);
}

/** "All (my council and sister councils)" or one council; `null` stands for all. */
function CouncilFilter({ councils, value, onChange }: { councils: Council[]; value: number | null; onChange: (id: number | null) => void }) {
  return (
    <Field label="Council" className="w-80">
      {(id) => (
        <Select id={id} value={value ?? 'all'} onChange={(e) => onChange(e.target.value === 'all' ? null : Number(e.target.value))}>
          <option value="all">All: my council and sister councils</option>
          {councils.map((c) => (
            <option key={c.id} value={c.id}>
              {councilLabel(c)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

const volunteers = (s: Pick<Shift, 'NumberVolunteersSignedUp' | 'MinNumberVolunteers' | 'IsAllHands'>) =>
  isAllHandsShift(s) ? `${s.NumberVolunteersSignedUp} · all hands` : `${s.NumberVolunteersSignedUp} of ${s.MinNumberVolunteers}`;

// ---- my active shifts ------------------------------------------------------------

function ActiveShifts() {
  const user = useUser();
  const today = new Date();
  const shifts = useLoad(() => db.events.listMemberShifts(user.memberId, { fromDate: toIsoDate(new Date()) }), [user.memberId]);
  const rows = shifts.data ?? [];
  const urgentCount = rows.filter((r) => isUrgent(r.shift.ShiftDate, today)).length;

  return (
    <Panel title={`My active shifts (${rows.length})`} actions={urgentCount > 0 ? <Pill tone="red">{urgentCount} within 48 hours</Pill> : null}>
      {shifts.error ? <Notice tone="error">{shifts.error}</Notice> : null}
      {shifts.data && rows.length === 0 ? <Empty>You are not signed up for any upcoming shift. The registration desk lists shifts that need volunteers.</Empty> : null}
      {rows.length > 0 ? (
        <Table caption="My upcoming shifts" head={['When', 'Event', 'Shift', 'Location', 'Volunteers', 'Status']}>
          {rows.map(({ shift, event }) => {
            const urgent = isUrgent(shift.ShiftDate, today);
            return (
              <tr key={shift.id} className={cx(urgent && 'border-l-8 border-brand-red')}>
                <Td className={cx('whitespace-nowrap font-bold', urgent && 'text-brand-red')}>{formatShiftWhen(shift)}</Td>
                <Td className="font-bold">{event.EventName}</Td>
                <Td>{shift.ShiftName}</Td>
                <Td>{event.Location}</Td>
                <Td>{volunteers(shift)}</Td>
                <Td>{urgent ? <Pill tone="red">Within 48 hours</Pill> : <Pill tone="outline">Scheduled</Pill>}</Td>
              </tr>
            );
          })}
        </Table>
      ) : null}
    </Panel>
  );
}

// ---- registration desk -------------------------------------------------------------

function RegistrationDesk() {
  const user = useUser();
  const councils = useFraternalCouncils();
  const [councilId, setCouncilId] = useState<number | null>(null);
  const { run, banner } = useAction();
  const councilIds = (councils.data ?? []).map((c) => c.id);
  const feed = useLoad(
    () => (councilIds.length === 0 ? Promise.resolve([]) : db.events.listShiftFeed({ memberId: user.memberId, councilIds, ...feedWindow(new Date()) })),
    [user.memberId, councilIds.join(',')],
  );
  const today = new Date();
  // Only shifts with room: full shifts are locked and cannot take another registration. All-Hands shifts always have room.
  const open = visibleFeed(feed.data ?? [], { councilId: councilId ?? 'all', showLocked: false }).filter((item) => !isShiftFull(item.shift));
  const councilName = new Map((councils.data ?? []).map((c) => [c.id, String(c.CouncilNumber)]));

  const register = (shiftId: number, label: string) =>
    void run(async () => {
      await db.events.signupForShift(user.memberId, shiftId);
      await feed.reload();
    }, `You are registered for ${label}.`);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-4">
        <CouncilFilter councils={councils.data ?? []} value={councilId} onChange={setCouncilId} />
        <p className="pb-2 text-xs text-muted">Shifts over the next 6 months that are still short of their minimum volunteers.</p>
      </div>
      {banner}
      {feed.error || councils.error ? <Notice tone="error">{feed.error ?? councils.error}</Notice> : null}
      <Panel title={`Shifts needing volunteers (${open.length})`}>
        {feed.data && open.length === 0 ? <Empty>Every shift in range has its volunteers. Check back as new events are planned.</Empty> : null}
        {open.length > 0 ? (
          <Table caption="Open shifts needing volunteers" head={['When', 'Event', 'Shift', 'Councils', 'Signed up', 'Still needed', '']}>
            {open.map(({ shift, event, councilIds: linked, isSignedUp }) => {
              const { status, remaining } = shiftStatus(shift, today);
              const urgent = isUrgent(shift.ShiftDate, today);
              return (
                <tr key={shift.id}>
                  <Td className={cx('whitespace-nowrap font-bold', urgent && 'text-brand-red')}>{formatShiftWhen(shift)}</Td>
                  <Td>
                    <span className="font-bold">{event.EventName}</span>
                    <span className="block text-xs text-muted">{event.Location}</span>
                  </Td>
                  <Td>
                    {shift.ShiftName}
                    {shift.ShiftDescription ? <span className="block text-xs text-muted">{shift.ShiftDescription}</span> : null}
                  </Td>
                  <Td>{linked.map((id) => councilName.get(id) ?? id).join(', ')}</Td>
                  <Td>{volunteers(shift)}</Td>
                  <Td>
                    {isAllHandsShift(shift) ? (
                      <Pill tone="outline">All hands · no cap</Pill>
                    ) : status === 'priority' ? (
                      <Pill tone="gold">{remaining} needed · priority</Pill>
                    ) : (
                      `${remaining} needed`
                    )}
                  </Td>
                  <Td>
                    {isSignedUp ? (
                      <Pill tone="navy">Registered</Pill>
                    ) : (
                      <Button size="sm" onClick={() => register(shift.id, `${event.EventName}, ${shift.ShiftName}`)}>
                        Register
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        ) : null}
      </Panel>
    </div>
  );
}

// ---- fraternal roster ----------------------------------------------------------------
// Sprint 10 Revision 2.0: the tab shows the shared Member Roster directory (MemberRosterDirectory, members.listRoster).

// ---- hour ledger -------------------------------------------------------------------------

/** Hours and minutes drop-downs (minutes 00/15/30/45), so every value is an exact multiple of 0.25. */
function TimePicker({ hours, minutes, onChange }: { hours: number; minutes: number; onChange: (hours: number, minutes: number) => void }) {
  return (
    <div className="flex gap-2">
      <Field label="Hours" className="w-24">
        {(id) => (
          <Select id={id} value={hours} onChange={(e) => onChange(Number(e.target.value), minutes)}>
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Minutes" className="w-24">
        {(id) => (
          <Select id={id} value={minutes} onChange={(e) => onChange(hours, Number(e.target.value))}>
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {padMinutes(m)}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

function LogForm({ title, children, onSubmit, busy, submitLabel }: { title: string; children: ReactNode; onSubmit: () => void; busy: boolean; submitLabel: string }) {
  return (
    <Panel title={title}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function HourLedger() {
  const user = useUser();
  const { flag_complex_shifts: shiftsOn } = useFeatureFlags();
  const { run, banner } = useAction();
  const [busy, setBusy] = useState(false);
  const today = toIsoDate(new Date());
  const windowDays = useCouncilTimings().volunteer_logging_window_days;
  const shiftWall = loggingWindowStart(new Date(), windowDays);
  const activityWall = shiftWall;

  const data = useLoad(async () => {
    const [shifts, activities] = await Promise.all([
      db.events.listMemberShifts(user.memberId, { toDate: today }),
      db.activities.listByCouncil(user.councilId),
    ]);
    const logs = await Promise.all(activities.map((a) => db.activityTime.listByActivity(a.id)));
    const activityEntries = logs
      .flatMap((log) => log.entries.filter((e) => e.row.MemberID === user.memberId).map((e) => ({ ...e.row, activityName: log.activity.ActivityName })))
      .sort((a, b) => b.ActivityDate.localeCompare(a.ActivityDate) || b.id - a.id);
    return { shifts: [...shifts].reverse(), activities, activityEntries };
  }, [user.memberId, user.councilId]);

  const loggable = (data.data?.shifts ?? []).filter((s) => s.signup.NoShow !== 1 && s.shift.ShiftDate >= shiftWall);
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [shiftTime, setShiftTime] = useState({ hours: 0, minutes: 0 });
  const [shiftNotes, setShiftNotes] = useState('');
  const [activityId, setActivityId] = useState<number | null>(null);
  const [activityDate, setActivityDate] = useState(today);
  const [activityTime, setActivityTime] = useState({ hours: 0, minutes: 0 });
  const [activityNotes, setActivityNotes] = useState('');

  // Low-click defaults: the latest shift still missing hours, and the council's first activity.
  const chosenShift = shiftId ?? (loggable.find((s) => s.hoursLogged === null) ?? loggable[0])?.shift.id ?? null;
  const chosenActivity = activityId ?? data.data?.activities[0]?.id ?? null;

  const pickShift = (id: number) => {
    setShiftId(id);
    const logged = loggable.find((s) => s.shift.id === id)?.hoursLogged;
    setShiftTime(logged != null ? hoursToPicker(logged) : { hours: 0, minutes: 0 });
  };

  const submit = async (action: () => Promise<string | void>, done: string, reset: () => void) => {
    setBusy(true);
    if (await run(action, done)) {
      reset();
      await data.reload();
    }
    setBusy(false);
  };

  const logShift = () => {
    const picked = pickerResult(shiftTime.hours, shiftTime.minutes);
    if (chosenShift === null) return;
    void submit(
      async () => {
        if ('error' in picked) throw new Error(picked.error);
        const result = await db.eventTime.logHours(user.memberId, chosenShift, picked.hours, shiftNotes.trim() || undefined);
        if (isQuarantinedHours(result)) return quarantinedHoursMessage(result.quarantined);
      },
      'Shift hours saved.',
      () => setShiftNotes(''),
    );
  };

  const logActivity = () => {
    const picked = pickerResult(activityTime.hours, activityTime.minutes);
    if (chosenActivity === null) return;
    void submit(
      async () => {
        if ('error' in picked) throw new Error(picked.error);
        const result = await db.activityTime.logHours(user.memberId, chosenActivity, picked.hours, activityDate, activityNotes.trim() || undefined);
        if (isQuarantinedHours(result)) return quarantinedHoursMessage(result.quarantined);
      },
      'Activity hours saved.',
      () => {
        setActivityTime({ hours: 0, minutes: 0 });
        setActivityNotes('');
      },
    );
  };

  const pastShifts = data.data?.shifts ?? [];
  const activityEntries = data.data?.activityEntries ?? [];

  return (
    <div className="flex flex-col gap-4">
      {banner}
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      <div className={cx('grid grid-cols-1 items-start gap-4', shiftsOn && 'xl:grid-cols-2')}>
        {shiftsOn ? (
          <LogForm title="Report time on a shift" onSubmit={logShift} busy={busy} submitLabel="Save shift hours">
            {loggable.length === 0 ? (
              <Empty>No shift from the last {windowDays} days to report. Hours for older shifts can no longer be logged.</Empty>
            ) : (
              <>
                <Field label="Shift I worked" hint={`Shifts back to ${formatFullDate(shiftWall)}. Logging again replaces the earlier hours.`}>
                  {(id) => (
                    <Select id={id} value={chosenShift ?? ''} onChange={(e) => pickShift(Number(e.target.value))}>
                      {loggable.map(({ shift, event, hoursLogged }) => (
                        <option key={shift.id} value={shift.id}>
                          {formatShiftWhen(shift)} · {event.EventName}: {shift.ShiftName}
                          {hoursLogged != null ? ` (logged ${formatHours(hoursLogged)})` : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <TimePicker hours={shiftTime.hours} minutes={shiftTime.minutes} onChange={(hours, minutes) => setShiftTime({ hours, minutes })} />
                <Field label="Notes (optional)">{(id) => <Input id={id} value={shiftNotes} maxLength={500} onChange={(e) => setShiftNotes(e.target.value)} />}</Field>
              </>
            )}
          </LogForm>
        ) : null}

        <LogForm title="Report time on an activity" onSubmit={logActivity} busy={busy} submitLabel="Save activity hours">
          {(data.data?.activities.length ?? 0) === 0 ? (
            <Empty>Your council has no activities yet.</Empty>
          ) : (
            <>
              <Field label="Council activity">
                {(id) => (
                  <Select id={id} value={chosenActivity ?? ''} onChange={(e) => setActivityId(Number(e.target.value))}>
                    {data.data?.activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.ActivityName}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Date worked" hint={`From ${formatFullDate(activityWall)} to today.`}>
                {(id) => <Input id={id} type="date" value={activityDate} min={activityWall} max={today} required onChange={(e) => setActivityDate(e.target.value)} />}
              </Field>
              <TimePicker hours={activityTime.hours} minutes={activityTime.minutes} onChange={(hours, minutes) => setActivityTime({ hours, minutes })} />
              <Field label="Notes (optional)">{(id) => <Input id={id} value={activityNotes} maxLength={500} onChange={(e) => setActivityNotes(e.target.value)} />}</Field>
            </>
          )}
        </LogForm>
      </div>

      {shiftsOn ? (
        <Panel title={`My shift history (${pastShifts.length})`}>
          {data.data && pastShifts.length === 0 ? <Empty>No past shifts yet.</Empty> : null}
          {pastShifts.length > 0 ? (
            <Table caption="My past shifts and logged hours" head={['When', 'Event', 'Shift', 'Hours', 'Status']}>
              {pastShifts.map(({ shift, event, signup, hoursLogged }) => {
                const closed = shift.ShiftDate < shiftWall;
                return (
                  <tr key={signup.id}>
                    <Td className="whitespace-nowrap">{formatFullDate(shift.ShiftDate)}</Td>
                    <Td className="font-bold">{event.EventName}</Td>
                    <Td>{shift.ShiftName}</Td>
                    <Td>{hoursLogged != null ? formatHours(hoursLogged) : '–'}</Td>
                    <Td>
                      {signup.NoShow === 1 ? (
                        <Pill tone="red">No-show</Pill>
                      ) : hoursLogged != null ? (
                        <Pill tone="navy">Logged</Pill>
                      ) : closed ? (
                        <Pill tone="outline">Closed</Pill>
                      ) : (
                        <Pill tone="redOutline">Hours needed</Pill>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          ) : null}
        </Panel>
      ) : null}

      <Panel title={`My activity history (${activityEntries.length})`}>
        {data.data && activityEntries.length === 0 ? <Empty>No activity time logged yet.</Empty> : null}
        {activityEntries.length > 0 ? (
          <Table caption="My logged activity time" head={['Date', 'Activity', 'Hours', 'Notes']}>
            {activityEntries.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{formatFullDate(e.ActivityDate)}</Td>
                <Td className="font-bold">{e.activityName}</Td>
                <Td>{formatHours(e.Hours)}</Td>
                <Td>{e.ActivityNotes || '–'}</Td>
              </tr>
            ))}
          </Table>
        ) : null}
      </Panel>
    </div>
  );
}

/** The shift tabs, which flag_complex_shifts switches off (Sprint 6A). */
const SHIFT_TABS: ReadonlySet<Tab> = new Set(['shifts', 'desk']);

/** The section's id on the Member Actions Hub (/member-actions). */
export const VOLUNTEER_CENTER_ID = 'volunteer-center';

/**
 * The Volunteer Check-In & Service Center. Sprint 8S Revision: the Member Actions Hub's page title is the single master
 * heading, so the section's own title is kept for screen readers (aria-label) but not printed.
 */
export function VolunteerCenter({ className }: { className?: string }) {
  const { flag_complex_shifts: shiftsOn } = useFeatureFlags();
  const tabs = shiftsOn ? TABS : TABS.filter((t) => !SHIFT_TABS.has(t.id));
  const [chosen, setTab] = useState<Tab>('shifts');
  const tab = tabs.some((t) => t.id === chosen) ? chosen : tabs[0].id;
  return (
    <section id={VOLUNTEER_CENTER_ID} aria-label={VOLUNTEER_CENTER_TITLE} className={cx('scroll-mt-4 rounded border-2 border-navy bg-white p-4', className)}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Volunteer center" idPrefix="volunteer-center" />
      <div id="volunteer-center-panel" role="tabpanel" aria-labelledby={`volunteer-center-tab-${tab}`} className="pt-4">
        {tab === 'shifts' ? <ActiveShifts /> : tab === 'desk' ? <RegistrationDesk /> : tab === 'roster' ? <MemberRosterDirectory /> : <HourLedger />}
      </div>
    </section>
  );
}
