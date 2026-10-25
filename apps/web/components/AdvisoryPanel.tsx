'use client';
// The Application Advisory Panel workspace (Sprint 10 Revision 3.1, advisory-panel.ts): four views for the panelists of
// every council and the Super Admins - the Development Roadmap and Future Feature Releases (kept in code by the
// development team), the Panel Meeting Dates and the Consultation Feedback rows (db.advisory). Super Admins also keep the
// meeting dates and designate panelists from any council; the drivers check every call.
import { useState } from 'react';
import {
  ADVISORY_BODY_MAX_LENGTH,
  ADVISORY_PANEL_VIEWS,
  ADVISORY_RELEASES,
  ADVISORY_ROADMAP,
  ADVISORY_TOPIC_MAX_LENGTH,
  councilLabel,
  describeError,
  isSuperAdmin,
  sortCouncils,
  type AdvisoryPanelMeeting,
  type AdvisoryPanelViewId,
} from '@kofc/shared';
import { Button, Empty, Field, Input, Notice, Panel, Pill, Select, Table, Tabs, Td, Textarea } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string } | null;

const statusTone = (status: string) => (status === 'Done' || status === 'Released' ? 'navy' : status === 'In progress' || status === 'In testing' ? 'gold' : 'outline');

function Banner({ message, onDismiss }: { message: Message; onDismiss: () => void }) {
  return message ? (
    <Notice tone={message.tone} onDismiss={onDismiss}>
      {message.text}
    </Notice>
  ) : null;
}

function Roadmap() {
  const phases = [...new Set(ADVISORY_ROADMAP.map((r) => r.phase))];
  return (
    <div className="flex flex-col gap-4">
      {phases.map((phase) => (
        <Panel key={phase} title={phase}>
          <ul className="flex flex-col gap-3">
            {ADVISORY_ROADMAP.filter((r) => r.phase === phase).map((r) => (
              <li key={r.title} className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-2 last:border-b-0">
                <span>
                  <span className="block font-bold">{r.title}</span>
                  <span className="block text-sm text-muted">{r.summary}</span>
                </span>
                <Pill tone={statusTone(r.status)}>{r.status}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function Releases() {
  return (
    <Panel title="Future feature releases">
      <div className="overflow-x-auto">
        <Table caption="Future feature releases" head={['Feature', 'Target', 'Status', 'Notes']}>
          {ADVISORY_RELEASES.map((r) => (
            <tr key={r.id}>
              <Td className="font-bold">{r.title}</Td>
              <Td className="whitespace-nowrap">{r.target}</Td>
              <Td>
                <Pill tone={statusTone(r.status)}>{r.status}</Pill>
              </Td>
              <Td>{r.notes}</Td>
            </tr>
          ))}
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted">Send your review of any release on the Consultation Feedback view.</p>
    </Panel>
  );
}

const blankMeeting = { id: null as number | null, meeting_date: '', title: '', location: '', agenda: '' };

function Meetings() {
  const user = useUser();
  const keeper = isSuperAdmin(user);
  const meetings = useLoad(() => db.advisory.listMeetings(user.memberId), [user.memberId]);
  const [draft, setDraft] = useState<typeof blankMeeting | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const today = new Date().toISOString().slice(0, 10);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    try {
      await db.advisory.saveMeeting(user.memberId, draft);
      setDraft(null);
      await meetings.reload();
      setMessage({ tone: 'info', text: 'Meeting saved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (m: AdvisoryPanelMeeting) => {
    setBusy(true);
    try {
      await db.advisory.removeMeeting(user.memberId, m.id);
      await meetings.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Panel meeting dates"
      actions={keeper && !draft ? <Button size="sm" onClick={() => setDraft({ ...blankMeeting })}>Add meeting</Button> : undefined}
    >
      <Banner message={message} onDismiss={() => setMessage(null)} />
      {meetings.error ? <Notice tone="error">{meetings.error}</Notice> : null}
      {draft ? (
        <form
          className="mb-4 grid grid-cols-1 gap-3 rounded border-2 border-gold p-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Date">{(id) => <Input id={id} type="date" required value={draft.meeting_date} onChange={(e) => setDraft({ ...draft, meeting_date: e.target.value })} />}</Field>
          <Field label="Title">{(id) => <Input id={id} required maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
          <Field label="Location (optional)">
            {(id) => <Input id={id} maxLength={200} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />}
          </Field>
          <Field label="Agenda (optional)">
            {(id) => <Textarea id={id} rows={2} maxLength={1000} value={draft.agenda} onChange={(e) => setDraft({ ...draft, agenda: e.target.value })} />}
          </Field>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save meeting'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {meetings.data && meetings.data.length === 0 ? <Empty>No panel meetings are scheduled yet.</Empty> : null}
      {(meetings.data?.length ?? 0) > 0 ? (
        <div className="overflow-x-auto">
          <Table caption="Panel meetings" head={['Date', 'Meeting', 'Location', 'Agenda', ...(keeper ? ['Actions'] : [])]}>
            {meetings.data!.map((m) => (
              <tr key={m.id} className={m.meeting_date < today ? 'text-muted' : undefined}>
                <Td className="whitespace-nowrap font-bold">{formatFullDate(m.meeting_date)}</Td>
                <Td>{m.title}</Td>
                <Td>{m.location ?? '–'}</Td>
                <Td>{m.agenda ?? '–'}</Td>
                {keeper ? (
                  <Td className="whitespace-nowrap">
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDraft({ id: m.id, meeting_date: m.meeting_date, title: m.title, location: m.location ?? '', agenda: m.agenda ?? '' })}>
                        Edit
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void remove(m)}>
                        Delete
                      </Button>
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </Panel>
  );
}

function Feedback() {
  const user = useUser();
  const rows = useLoad(() => db.advisory.listFeedback(user.memberId), [user.memberId]);
  const [topic, setTopic] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.advisory.submitFeedback(user.memberId, { topic, body });
      setTopic('');
      setBody('');
      await rows.reload();
      setMessage({ tone: 'info', text: 'Thank you. Your note is on the panel’s feedback list.' });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Send consultation feedback">
        <Banner message={message} onDismiss={() => setMessage(null)} />
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Field label="Topic">{(id) => <Input id={id} required maxLength={ADVISORY_TOPIC_MAX_LENGTH} value={topic} onChange={(e) => setTopic(e.target.value)} />}</Field>
          <Field label="Your feedback" hint={`Up to ${ADVISORY_BODY_MAX_LENGTH} characters.`}>
            {(id) => <Textarea id={id} required rows={4} maxLength={ADVISORY_BODY_MAX_LENGTH} value={body} onChange={(e) => setBody(e.target.value)} />}
          </Field>
          <Button type="submit" className="self-start" disabled={busy || !topic.trim() || !body.trim()}>
            {busy ? 'Sending…' : 'Send feedback'}
          </Button>
        </form>
      </Panel>
      <Panel title={`Feedback received (${rows.data?.length ?? 0})`}>
        {rows.error ? <Notice tone="error">{rows.error}</Notice> : null}
        {rows.data && rows.data.length === 0 ? <Empty>No feedback yet.</Empty> : null}
        {(rows.data?.length ?? 0) > 0 ? (
          <div className="overflow-x-auto">
            <Table caption="Consultation feedback" head={['Sent', 'From', 'Council', 'Topic', 'Feedback']}>
              {rows.data!.map((f) => (
                <tr key={f.id}>
                  <Td className="whitespace-nowrap">{formatFullDate(f.submitted_at.slice(0, 10))}</Td>
                  <Td>{f.memberName}</Td>
                  <Td>{f.councilLabel}</Td>
                  <Td className="font-bold">{f.topic}</Td>
                  <Td className="whitespace-pre-wrap">{f.body}</Td>
                </tr>
              ))}
            </Table>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

/** Super Admins only: who sits on the panel, from any council. */
function Panelists() {
  const user = useUser();
  const list = useLoad(() => db.advisory.listPanelists(user.memberId), [user.memberId]);
  const councils = useLoad(async () => sortCouncils(await db.councils.list()), []);
  const [councilId, setCouncilId] = useState<number | null>(null);
  const members = useLoad(() => (councilId === null ? Promise.resolve([]) : db.members.listByCouncil(councilId, { activeOnly: true })), [councilId]);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const set = async (id: number, designated: boolean) => {
    setMessage(null);
    try {
      await db.advisory.setPanelist(user.memberId, id, designated);
      await list.reload();
      setMessage({ tone: 'info', text: designated ? 'Panelist added. They see the panel after they next sign in.' : 'Panelist removed.' });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    }
  };
  return (
    <Panel title={`Panelists (${list.data?.length ?? 0})`}>
      <Banner message={message} onDismiss={() => setMessage(null)} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Council">
          {(id) => (
            <Select id={id} value={councilId ?? ''} onChange={(e) => (setCouncilId(e.target.value === '' ? null : Number(e.target.value)), setMemberId(null))}>
              <option value="">Choose a council</option>
              {(councils.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {councilLabel(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Member">
          {(id) => (
            <Select id={id} value={memberId ?? ''} disabled={councilId === null} onChange={(e) => setMemberId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Choose a member</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.MemberLastName}, {m.MemberFirstName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button disabled={memberId === null} onClick={() => memberId !== null && void set(memberId, true)}>
          Add panelist
        </Button>
      </div>
      {list.data && list.data.length === 0 ? <Empty>No panelists yet.</Empty> : null}
      <ul className="flex flex-col gap-2">
        {(list.data ?? []).map((p) => (
          <li key={p.memberId} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <span>
              <span className="font-bold">{p.name}</span> <span className="text-sm text-muted">· {p.councilLabel}</span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => void set(p.memberId, false)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function AdvisoryPanelWorkspace() {
  const user = useUser();
  const [view, setView] = useState<AdvisoryPanelViewId>('roadmap');
  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={ADVISORY_PANEL_VIEWS.map((v) => ({ id: v.id, label: v.label }))} value={view} onChange={setView} label="Advisory Panel views" idPrefix="advisory" />
      <div role="tabpanel" id="advisory-panel" aria-labelledby={`advisory-tab-${view}`}>
        {view === 'roadmap' ? <Roadmap /> : view === 'releases' ? <Releases /> : view === 'meetings' ? <Meetings /> : <Feedback />}
      </div>
      {isSuperAdmin(user) ? <Panelists /> : null}
    </div>
  );
}
