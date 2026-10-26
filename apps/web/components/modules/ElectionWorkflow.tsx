'use client';
// Sprint 8P Stage 2: moved from app/elections/page.tsx so the Active Desks' slide-out drawers mount the same module; the page renders NominationsDesk.
// Officer Nominations Desk (Sprint 5U): a dense ballot grid of the council's elected offices. While a seat takes
// nominations (May 1-31, or before a mid-year election closes) any active member picks its card, chooses a brother
// Knight and submits the nomination (elections.submitNomination). A Grand Knight nominee who has never served as
// Deputy Grand Knight or Grand Knight is still recorded, with a Supreme Council dispensation warning beside his name.
// Outside every window the page shows only the placeholder notice; the drivers refuse late nominations
// (NOMINATIONS_WINDOW_CLOSED) whatever the screen shows.
//
// Sprint 8S Revision 2: renamed from ElectionTracker.tsx. The Grand Knight Desk drawer mounts CouncilElectionWorkflow:
// the same grid under the Planning & Budgeting Workflow's step-by-step layout (desk-workflows.ts buildElectionWorkflow).
// Sprint 8S Revision 10.6: that drawer is a read-only Reference Workflows scoreboard - no Nominate buttons, nomination
// form or Set the ballot link. Members nominate in the Council Election Center (/elections).
// Sprint 11 Revision 1.0: /elections is the Council Election Center (CouncilElectionCenter): a pinned election progress
// bar, then closed drawers for the positions table, the nominations and the PIN-unlocked Cast Active Ballot drawer.
// Sprint 11 Revision 2.0: the Officer Election Parameters grid moved here from Council Lookups, as a fourth drawer for those
// who may set the ballot (canConfigureBallot).
import { useMemo, useState } from 'react';
import {
  buildElectionWorkflow,
  canConfigureBallot,
  describeError,
  formatTimestamp,
  GRAND_KNIGHT_ROLE,
  withNewMemberBadge,
  type BallotSeat,
  type OfficerSeat,
} from '@kofc/shared';
import { CouncilSelect, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Field, Notice, PageTitle, Pill, Select, Table, Td } from '@/components/ui';
import { CAST_ACTIVE_BALLOT_TITLE, CastActiveBallot } from '@/components/modules/CastActiveBallot';
import { stepsWheel, WorkflowActionBar, WorkflowStepRow, WorkflowWheels } from '@/components/WorkflowParts';
import { formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const NOMINATIONS_CLOSED_TEXT = 'The regular officer nomination window opens annually on May 1st.';

/** Beside a Grand Knight nominee stored with IsEligible = 0. Gold is the manual's priority-alert fill. */
function DispensationBadge() {
  return (
    <span title="Has not served as Deputy Grand Knight or Grand Knight">
      <Pill tone="gold">Requires Supreme Council Dispensation</Pill>
    </span>
  );
}

function SeatStatus({ ballot }: { ballot: BallotSeat | undefined }) {
  if (!ballot) return <Pill tone="outline">Not on ballot</Pill>;
  if (ballot.ballot.IsMidYearElection === 1) {
    return <Pill tone="red">Mid-year · closes {formatTimestamp(ballot.ballot.NominationsCloseAt)}</Pill>;
  }
  return ballot.nominationsOpen ? <Pill tone="navy">Open</Pill> : <Pill tone="outline">Closed</Pill>;
}

/** One elected office in the grid; open seats are buttons that select the card for the nomination form (none when read only). */
function SeatCard({ seat, ballot, selected, onSelect }: { seat: OfficerSeat; ballot: BallotSeat | undefined; selected: boolean; onSelect?: () => void }) {
  const open = ballot?.nominationsOpen === true;
  const nominees = ballot?.nominees ?? [];
  return (
    <li
      className={cx(
        'flex flex-col gap-2 rounded border bg-white p-3 text-sm',
        selected ? 'border-navy border-t-8 border-t-gold' : 'border-line border-t-8',
        !open && 'text-muted',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-base font-bold text-navy">{seat.roleName}</h2>
        <SeatStatus ballot={ballot} />
      </div>
      <p className="text-xs">
        Sitting: {seat.holder ? `${seat.holder.firstName} ${seat.holder.lastName}` : <span className="italic">vacant</span>}
      </p>
      {open ? (
        nominees.length ? (
          <ol className="flex flex-col gap-1 border-t border-line pt-2">
            {nominees.map((n, i) => (
              <li key={n.nomination.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-bold text-navy">
                  {i + 1}. {n.firstName} {n.lastName}
                </span>
                {n.nomination.IsEligible === 0 ? <DispensationBadge /> : null}
                <span className="w-full text-xs text-muted">nominated by {n.nominatedByName}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-t border-line pt-2 text-xs italic">No nominations yet.</p>
        )
      ) : null}
      {open && onSelect ? (
        <Button size="sm" variant={selected ? 'primary' : 'secondary'} aria-pressed={selected} onClick={onSelect} className="mt-auto self-start">
          {selected ? 'Selected' : 'Nominate'}
        </Button>
      ) : null}
    </li>
  );
}

function NominationForm({ councilId, seat, onSaved }: { councilId: number; seat: BallotSeat; onSaved: (text: string) => Promise<void> }) {
  const user = useUser();
  const members = useLoad(() => db.members.listByCouncil(councilId, { activeOnly: true }), [councilId]);
  const [nomineeId, setNomineeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const already = new Set(seat.nominees.map((n) => n.nomination.NomineeMemberID));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const nominee = members.data?.find((m) => m.id === Number(nomineeId));
      const result = await db.elections.submitNomination(user.memberId, councilId, seat.roleId, Number(nomineeId));
      const name = nominee ? `${nominee.MemberFirstName} ${nominee.MemberLastName}` : `Member ${nomineeId}`;
      setNomineeId('');
      await onSaved(
        `Nominated ${name} for ${seat.roleName} (${seat.fraternalYear}); ${result.tally} nomination${result.tally === 1 ? '' : 's'} for the seat so far.` +
          (result.eligible ? '' : ' This nominee has not served as Deputy Grand Knight or Grand Knight, so the candidacy requires Supreme Council dispensation.'),
      );
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={`Nominate for ${seat.roleName}`} className="rounded border-2 border-navy border-l-8 border-l-gold bg-white p-4">
      <h2 className="mb-3 font-serif text-lg font-bold">Nominate for {seat.roleName}</h2>
      {error ? (
        <div className="mb-3">
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      ) : null}
      {members.error ? <Notice tone="error">{members.error}</Notice> : null}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nominee" className="w-80" hint="Active members of the council">
          {(id) => (
            <Select id={id} value={nomineeId} onChange={(e) => setNomineeId(e.target.value)} disabled={!members.data}>
              <option value="">Choose a brother Knight…</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id} disabled={already.has(m.id)}>
                  {withNewMemberBadge(formatPersonName(m.MemberFirstName, m.MemberLastName), m, new Date())}
                  {already.has(m.id) ? ' (already nominated)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button disabled={busy || nomineeId === ''} onClick={() => void submit()}>
          {busy ? 'Submitting…' : 'Submit nomination'}
        </Button>
      </div>
      {seat.roleName === GRAND_KNIGHT_ROLE ? (
        <p className="mt-3 text-xs text-muted">
          A Grand Knight nominee should have served as Deputy Grand Knight or Grand Knight. Anyone else is still recorded, marked as requiring Supreme
          Council dispensation.
        </p>
      ) : null}
    </section>
  );
}

/** Outside every nomination window: a quiet placeholder, in the manual's Arial. */
function WindowClosed() {
  return (
    <div role="status" className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-3 rounded border-2 border-navy border-t-8 border-t-gold bg-white px-8 py-10 text-center">
      <p className="font-serif text-xl font-bold">Officer nominations are closed</p>
      <p className="font-sans text-base text-navy">
        {NOMINATIONS_CLOSED_TEXT}
      </p>
    </div>
  );
}

type ElectionData = { seats: OfficerSeat[]; ballot: BallotSeat[] };

/** The council's elected seats and their ballot rows, shared by the page and the Council Election Workflow drawer. */
function useElectionData(councilId: number) {
  return useLoad(async (): Promise<ElectionData> => {
    const [seats, ballot] = await Promise.all([db.elections.listOfficerSeats(councilId), db.elections.listBallotConfig(councilId)]);
    return { seats: seats.filter((s) => s.kind === 'elected'), ballot };
  }, [councilId]);
}

/** The nominations grid and form while a window is open, else the closed placeholder. */
function NominationsBody({ councilId, data, onReload, readOnly = false }: { councilId: number; data: ElectionData; onReload: () => Promise<unknown>; readOnly?: boolean }) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { seats, ballot } = data;
  const openSeats = ballot.filter((b) => b.nominationsOpen);
  if (openSeats.length === 0) return <WindowClosed />;

  const selected = openSeats.find((b) => b.roleId === selectedRoleId) ?? null;
  const midYear = openSeats.filter((b) => b.ballot.IsMidYearElection === 1);
  const regular = openSeats.filter((b) => b.ballot.IsMidYearElection !== 1);

  return (
    <>
      <div className="mb-4 flex flex-col gap-2">
        {regular.length ? (
          <p className="text-sm">
            <span className="font-bold">Regular election, term {regular[0].fraternalYear}.</span> Nominations run May 1 through May 31.
          </p>
        ) : null}
        {midYear.map((b) => (
          <p key={b.roleId} className="text-sm">
            <span className="font-bold">Mid-year election for {b.roleName}, term {b.fraternalYear}.</span> Nominations close{' '}
            {formatTimestamp(b.ballot.NominationsCloseAt)}.
          </p>
        ))}
        <p className="text-xs text-muted">
          {readOnly ? 'This folder is for reference. Nominate a brother Knight in the Council Election Center.' : 'Pick an open office, then choose the brother Knight you are nominating.'}
        </p>
      </div>
      {message ? (
        <div className="mb-4">
          <Notice tone="info" onDismiss={() => setMessage(null)}>
            {message}
          </Notice>
        </div>
      ) : null}

      <ul aria-label="Elected offices" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {seats.map((seat) => (
          <SeatCard
            key={seat.roleId}
            seat={seat}
            ballot={ballot.find((b) => b.roleId === seat.roleId)}
            selected={!readOnly && seat.roleId === selected?.roleId}
            onSelect={readOnly ? undefined : () => setSelectedRoleId(seat.roleId)}
          />
        ))}
      </ul>

      {selected && !readOnly ? (
        <NominationForm
          key={`${councilId}-${selected.roleId}`}
          councilId={councilId}
          seat={selected}
          onSaved={async (text) => {
            setMessage(text);
            await onReload();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Officer Election Parameters (Sprint 5U; moved here from Council Lookups in Sprint 11 Revision 2.0): the council's Admins
 * and Super Admins tick which elected offices are open for nomination this season (elections.toggleRoleBallotStatus, saved
 * per click). Appointed offices and the trustee ladder are never on a ballot, so only elected seats are listed.
 */
function ElectionParameters({ councilId }: { councilId: number }) {
  const user = useUser();
  const seats = useLoad(async () => (await db.elections.listOfficerSeats(councilId)).filter((s) => s.kind === 'elected'), [councilId]);
  const [busyRoleId, setBusyRoleId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const toggle = async (roleId: number, roleName: string, isOpen: boolean) => {
    setBusyRoleId(roleId);
    setMessage(null);
    try {
      await db.elections.toggleRoleBallotStatus(user.memberId, councilId, roleId, isOpen);
      setMessage({ tone: 'info', text: `${roleName} is ${isOpen ? 'now open for nomination' : 'off the ballot'} this season.` });
      await seats.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusyRoleId(null);
    }
  };

  if (seats.error) return <Notice tone="error">{seats.error}</Notice>;
  if (!seats.data) return <p className="text-sm text-muted">Loading…</p>;
  const openCount = seats.data.filter((s) => s.ballot?.IsUpForElection === 1).length;

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <p className="text-xs text-muted">
        Tick each elected office open for nomination this season ({openCount} of {seats.data.length} open). Leave the Grand Knight unticked in the
        second year of a two-year term: the Grand Knight and trustees then keep their chairs when the year concludes. Each change saves at once.
      </p>
      <Table caption="Elected offices and their ballot status" head={['Office', 'Sitting officer', 'Status', 'Open for nomination']}>
        {seats.data.map((seat) => {
          const open = seat.ballot?.IsUpForElection === 1;
          const midYear = seat.ballot?.IsMidYearElection === 1;
          return (
            <tr key={seat.roleId} className={cx(open && 'outline outline-2 -outline-offset-2 outline-gold')}>
              <Td className="font-bold">{seat.roleName}</Td>
              <Td>{seat.holder ? `${seat.holder.firstName} ${seat.holder.lastName}` : <span className="text-muted">Vacant</span>}</Td>
              <Td>
                {midYear ? (
                  <Pill tone="red">Mid-year · closes {formatTimestamp(seat.ballot?.NominationsCloseAt)}</Pill>
                ) : open ? (
                  <Pill tone="navy">On ballot</Pill>
                ) : (
                  <Pill tone="outline">Not on ballot</Pill>
                )}
              </Td>
              <Td>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={open}
                    disabled={busyRoleId !== null}
                    onChange={(e) => void toggle(seat.roleId, seat.roleName, e.target.checked)}
                  />
                  <span className="sr-only">Open {seat.roleName} for nomination</span>
                  <span aria-hidden="true">{busyRoleId === seat.roleId ? 'Saving…' : open ? 'Open' : 'Closed'}</span>
                </label>
              </Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}

/** The Election Center's title (Sprint 11 Revision 1.0). */
export const COUNCIL_ELECTION_CENTER_TITLE = 'Council Election Center';

/** The Election Center's drawers, in order; every one lands closed. */
export const ELECTION_CENTER_DRAWERS = [
  { id: 'positions', label: '📋 Election Positions', hint: 'Each elected office, its sitting officer and whether it is on the ballot.' },
  { id: 'nominations', label: '✍️ Candidate Nominations', hint: 'Nominate a brother Knight while a window is open, and see who is nominated.' },
  { id: 'ballot', label: CAST_ACTIVE_BALLOT_TITLE, hint: 'At a live meeting: unlock with the meeting PIN and cast a secret ballot.' },
  { id: 'parameters', label: '⚙️ Officer Election Parameters', hint: 'Choose which elected offices are open for nomination this season.' },
] as const;
type ElectionCenterDrawerId = (typeof ELECTION_CENTER_DRAWERS)[number]['id'];

/** The Election Positions table: the elected seats, read only (the ballot is set in the Officer Election Parameters drawer). */
function ElectionPositions({ data }: { data: ElectionData }) {
  return (
    <Table caption="Elected offices and their ballot status" head={['Office', 'Sitting officer', 'Ballot', 'Nominees']}>
      {data.seats.map((seat) => {
        const ballot = data.ballot.find((b) => b.roleId === seat.roleId);
        return (
          <tr key={seat.roleId} className="border-t border-line">
            <Td className="font-bold">{seat.roleName}</Td>
            <Td>{seat.holder ? `${seat.holder.firstName} ${seat.holder.lastName}` : <span className="text-muted">Vacant</span>}</Td>
            <Td>
              <SeatStatus ballot={ballot} />
            </Td>
            <Td>{ballot ? ballot.nominees.length : 0}</Td>
          </tr>
        );
      })}
    </Table>
  );
}

/**
 * The /elections page (Sprint 11 Revision 1.0): the Council Election Center. The election progress bar - the action bar
 * and the four steps of buildElectionWorkflow - is pinned to the top of the screen and never collapses. Under it, the
 * Election Positions table, the Candidate Nominations blocks and the Cast Active Ballot drawer each sit in a collapsible
 * drawer that lands closed.
 */
export function CouncilElectionCenter() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const data = useElectionData(councilId);
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState<Record<ElectionCenterDrawerId, boolean>>({ positions: false, nominations: false, ballot: false, parameters: false });
  const drawers = ELECTION_CENTER_DRAWERS.filter((d) => d.id !== 'parameters' || canConfigureBallot(user, councilId));
  const flow = data.data ? buildElectionWorkflow({ today, electedSeats: data.data.seats.length, ballot: data.data.ballot }) : null;
  const body = (id: ElectionCenterDrawerId) => {
    if (id === 'ballot') return <CastActiveBallot councilId={councilId} active={open.ballot} />;
    if (id === 'parameters') return open.parameters ? <ElectionParameters key={councilId} councilId={councilId} /> : null;
    if (!data.data) return <p className="text-sm text-muted">Loading the ballot…</p>;
    return id === 'positions' ? <ElectionPositions data={data.data} /> : <NominationsBody councilId={councilId} data={data.data} onReload={data.reload} />;
  };
  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>{COUNCIL_ELECTION_CENTER_TITLE}</PageTitle>
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      <section aria-label="Election progress" className="sticky top-0 z-10 mb-4 flex flex-col gap-3 border-b-2 border-navy bg-white pb-3 pt-1">
        {flow ? (
          <>
            <WorkflowActionBar headline={flow.headline} />
            <WorkflowStepRow steps={flow.steps} label="Election steps" />
          </>
        ) : (
          <p className="text-sm text-muted">Loading the election progress…</p>
        )}
      </section>
      <div className="flex flex-col gap-3">
        {drawers.map((drawer) => (
          <details
            key={drawer.id}
            id={`election-drawer-${drawer.id}`}
            open={open[drawer.id]}
            onToggle={(e) => {
              const isOpen = (e.currentTarget as HTMLDetailsElement).open;
              setOpen((o) => (o[drawer.id] === isOpen ? o : { ...o, [drawer.id]: isOpen }));
            }}
            className="group rounded border-2 border-navy bg-white"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-0.5 border-l-8 border-l-gold px-4 py-3 hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold">
              <span className="font-serif text-lg font-bold text-navy">
                <span aria-hidden="true" className="mr-2 inline-block transition-transform group-open:rotate-90">
                  ▸
                </span>
                {drawer.label}
              </span>
              <span className="text-sm text-muted">{drawer.hint}</span>
            </summary>
            <div className="min-w-0 break-words border-t-2 border-navy px-4 pb-4 pt-3">{body(drawer.id)}</div>
          </details>
        ))}
      </div>
    </>
  );
}

/**
 * Sprint 8S Revision 2: '[ 🗳️ Council Election Workflow ]' on the Grand Knight Desk, in the step-by-step layout of the
 * Planning & Budgeting Workflow drawer (WorkflowParts.tsx): the highlighted action bar, the four steps (the ballot, May
 * nominations, the June vote, the July 1 term - buildElectionWorkflow), the progress wheels, then the nominations grid,
 * read only (Sprint 8S Revision 10.6).
 */
export function CouncilElectionWorkflow() {
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const data = useElectionData(councilId);
  const today = useMemo(() => new Date(), []);
  if (data.error) return <Notice tone="error">{data.error}</Notice>;
  if (!data.data) return <p className="text-sm text-muted">Loading the ballot…</p>;
  const flow = buildElectionWorkflow({ today, electedSeats: data.data.seats.length, ballot: data.data.ballot });
  return (
    <div className="flex flex-col gap-4">
      <WorkflowActionBar headline={flow.headline} />
      <WorkflowStepRow steps={flow.steps} label="Election steps" />
      <WorkflowWheels
        wheels={[
          stepsWheel(flow.steps),
          { label: 'Offices on the ballot', value: flow.onBallot, total: flow.electedSeats, caption: `${flow.onBallot} of ${flow.electedSeats} elected offices` },
          { label: 'Offices with a nominee', value: flow.nominated, total: flow.onBallot, caption: `${flow.nominated} of ${flow.onBallot} open offices` },
        ]}
      />
      <NominationsBody councilId={councilId} data={data.data} onReload={data.reload} readOnly />
    </div>
  );
}
