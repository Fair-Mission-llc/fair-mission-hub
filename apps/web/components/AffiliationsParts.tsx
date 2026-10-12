'use client';
// The Bilateral Fraternal Affiliations desk (Sprints 8G/8H, council-affiliations.ts).
//
// AffiliationDirectoryPanel - the scannable directory at /system-settings/affiliations: the other councils of the home
// council's state, nearest first by meeting point (then same district, district number and council number), each with
// its handshake state and the next click - Send invite (council Admins, the Grand Knight and Deputy Grand Knight, Super
// Admins: councils.requestAffiliation), a pending note, or Accept / Decline on an invite to the council.
//
// IncomingAffiliationInvites - the invites waiting for the council's answer, with Accept and Decline for its Grand Knight
// or Deputy Grand Knight (councils.respondToAffiliation). It sits on the Grand Knight Desk and atop the directory page.
// Accepting makes the pair ACTIVE and unlocks loaner library sharing between them.
import { useState } from 'react';
import {
  canManageAffiliations,
  canRespondToAffiliation,
  COUNCIL_AFFILIATION_STATUS_LABELS,
  describeError,
  type AffiliationDecision,
  type AffiliationDirectory,
  type AffiliationDirectoryEntry,
  type SessionUser,
} from '@kofc/shared';
import { Button, Empty, Input, Notice, Panel, Pill, Table, Td } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Feedback = { tone: 'error' | 'info'; text: string } | null;

const councilTitle = (e: Pick<AffiliationDirectoryEntry, 'councilName' | 'councilNumber'>) => `${e.councilName} (Council ${e.councilNumber})`;

function useAnswer(user: SessionUser, onDone: () => Promise<void>) {
  const [busy, setBusy] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const answer = async (entry: AffiliationDirectoryEntry, decision: AffiliationDecision) => {
    if (!entry.link) return;
    setBusy(entry.link.affiliationId);
    setFeedback(null);
    try {
      await db.councils.respondToAffiliation(user.memberId, entry.link.affiliationId, decision);
      await onDone();
      setFeedback({
        tone: 'info',
        text: decision === 'ACCEPT' ? `${councilTitle(entry)} is now affiliated with your council.` : `You declined the invite from ${councilTitle(entry)}.`,
      });
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };
  return { busy, feedback, setFeedback, answer };
}

function AnswerButtons({ entry, busy, onAnswer }: { entry: AffiliationDirectoryEntry; busy: boolean; onAnswer: (d: AffiliationDecision) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={() => onAnswer('ACCEPT')}>
        Accept
      </Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAnswer('DECLINE')}>
        Decline
      </Button>
    </div>
  );
}

/** The invites waiting for this council's answer. */
export function IncomingAffiliationInvites({
  user,
  councilId,
  directory,
  onChanged,
}: {
  user: SessionUser;
  councilId: number;
  directory?: AffiliationDirectory | null;
  onChanged?: () => Promise<void>;
}) {
  const own = useLoad(() => (directory === undefined ? db.councils.listAffiliationDirectory(user.memberId, councilId) : Promise.resolve(null)), [user.memberId, councilId]);
  const data = directory === undefined ? own.data : directory;
  const { busy, feedback, setFeedback, answer } = useAnswer(user, async () => {
    if (onChanged) await onChanged();
    if (directory === undefined) await own.reload();
  });
  const responder = canRespondToAffiliation(user, councilId);
  const incoming = data?.incoming ?? [];
  if (directory === undefined && own.error) return <Notice tone="error">{own.error}</Notice>;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-2">
      {feedback ? (
        <Notice tone={feedback.tone} onDismiss={() => setFeedback(null)}>
          {feedback.text}
        </Notice>
      ) : null}
      {incoming.length === 0 ? (
        <p className="text-sm text-muted">No affiliation invites are waiting for your council.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {incoming.map((e) => (
            <li key={e.councilId} className="flex flex-wrap items-center justify-between gap-2 rounded border-2 border-gold bg-white p-2">
              <div>
                <p className="font-bold">{councilTitle(e)}</p>
                <p className="text-xs text-muted">
                  Invited {formatFullDate(e.link!.requestedAt.slice(0, 10))}
                  {e.distanceMiles !== null ? ` · ${e.distanceMiles} miles away` : ''}
                  {e.districtNumber !== null ? ` · District ${e.districtNumber}` : ''}
                </p>
              </div>
              {responder ? (
                <AnswerButtons entry={e} busy={busy !== null} onAnswer={(d) => void answer(e, d)} />
              ) : (
                <span className="text-sm text-muted">Your Grand Knight or Deputy Grand Knight answers it.</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusCell({ entry }: { entry: AffiliationDirectoryEntry }) {
  const link = entry.link;
  if (!link) return <span className="text-muted">Not affiliated</span>;
  if (link.status === 'ACTIVE') {
    return (
      <>
        <Pill tone="navy">{COUNCIL_AFFILIATION_STATUS_LABELS.ACTIVE}</Pill>
        {link.dateEstablished ? <span className="block text-xs text-muted">Since {formatFullDate(link.dateEstablished)}</span> : null}
      </>
    );
  }
  if (link.status === 'PENDING') {
    return (
      <>
        <Pill tone="gold">{link.direction === 'outgoing' ? 'Invite sent' : 'Invited you'}</Pill>
        <span className="block text-xs text-muted">{formatFullDate(link.requestedAt.slice(0, 10))}</span>
      </>
    );
  }
  return <Pill tone="outline">{COUNCIL_AFFILIATION_STATUS_LABELS.DECLINED}</Pill>;
}

/** The directory of same-state councils with the handshake controls. */
export function AffiliationDirectoryPanel({ user, councilId }: { user: SessionUser; councilId: number }) {
  const directory = useLoad(() => db.councils.listAffiliationDirectory(user.memberId, councilId), [user.memberId, councilId]);
  const [query, setQuery] = useState('');
  const [sameDistrict, setSameDistrict] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const answers = useAnswer(user, directory.reload);
  const d = directory.data;
  const manager = canManageAffiliations(user, councilId);
  const responder = canRespondToAffiliation(user, councilId);
  const q = query.trim().toLowerCase();
  const rows = (d?.entries ?? []).filter(
    (e) => (!sameDistrict || e.sameDistrict) && (!q || `${e.councilNumber} ${e.councilName}`.toLowerCase().includes(q)),
  );

  const invite = async (entry: AffiliationDirectoryEntry) => {
    setSending(entry.councilId);
    setFeedback(null);
    try {
      await db.councils.requestAffiliation(user.memberId, councilId, entry.councilId);
      await directory.reload();
      setFeedback({ tone: 'info', text: `Invite sent to ${councilTitle(entry)}. Their Grand Knight accepts it on the Grand Knight Desk.` });
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err) });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {directory.error ? <Notice tone="error">{directory.error}</Notice> : null}
      {d ? (
        <Panel title={`Invites waiting for ${d.councilName} (${d.incoming.length})`}>
          <IncomingAffiliationInvites user={user} councilId={councilId} directory={d} onChanged={directory.reload} />
        </Panel>
      ) : null}
      <Panel title={d ? `Councils in ${d.state} (${d.entries.length})` : 'Councils in your state'}>
        {!d && !directory.error ? <p className="text-sm text-muted">Loading the directory…</p> : null}
        {d ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {d.sortedByDistance
                ? 'Nearest first, measured between the councils’ meeting points.'
                : 'Your council has no meeting point yet, so the list is in district order. Set it on Council Wide Settings, Meeting Check-In, to sort by distance.'}{' '}
              {d.districtNumber !== null ? `Your council is in district ${d.districtNumber}.` : 'Your district number is not on file yet (a Super Admin enters it on the Councils page).'}{' '}
              Loaner library sharing is <strong>{d.loanerLibraryEnabled ? 'on' : 'off'}</strong> for your council.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-navy">
                Find a council
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or number" className="w-56" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sameDistrict} onChange={(e) => setSameDistrict(e.target.checked)} disabled={d.districtNumber === null} />
                My district only
              </label>
            </div>
            {feedback ? (
              <Notice tone={feedback.tone} onDismiss={() => setFeedback(null)}>
                {feedback.text}
              </Notice>
            ) : null}
            {answers.feedback ? (
              <Notice tone={answers.feedback.tone} onDismiss={() => answers.setFeedback(null)}>
                {answers.feedback.text}
              </Notice>
            ) : null}
            {rows.length === 0 ? (
              <Empty>{d.entries.length === 0 ? `No other council in ${d.state} is on the platform yet.` : 'No council matches the filter.'}</Empty>
            ) : (
              <Table caption={`Councils in ${d.state}, nearest first`} head={['Council', 'District', 'Distance', 'Loaner sharing', 'Status', '']}>
                {rows.map((e) => {
                  const link = e.link;
                  const canInvite = manager && (!link || link.status === 'DECLINED');
                  return (
                    <tr key={e.councilId}>
                      <Td className="font-bold">
                        {e.councilName}
                        <span className="block text-xs font-normal text-muted">Council {e.councilNumber}</span>
                      </Td>
                      <Td>
                        {e.districtNumber ?? '–'}
                        {e.sameDistrict ? <span className="block text-xs text-muted">Your district</span> : null}
                      </Td>
                      <Td className="whitespace-nowrap">{e.distanceMiles !== null ? `${e.distanceMiles} mi` : '–'}</Td>
                      <Td>{e.loanerLibraryEnabled ? 'On' : 'Off'}</Td>
                      <Td>
                        <StatusCell entry={e} />
                      </Td>
                      <Td>
                        {canInvite ? (
                          <Button size="sm" variant="gold" disabled={sending !== null} onClick={() => void invite(e)}>
                            {sending === e.councilId ? 'Sending…' : link ? 'Invite again' : 'Send invite'}
                          </Button>
                        ) : link?.status === 'PENDING' && link.direction === 'incoming' && responder ? (
                          <AnswerButtons entry={e} busy={answers.busy !== null} onAnswer={(dec) => void answers.answer(e, dec)} />
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
