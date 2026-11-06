'use client';
// Council History (COUNCIL_HISTORY_TITLE; named Fraternal Annals & Oral History until Revision 21.7 and Historical
// Chronology from Revision 10.0 to 19.0) - the Team Legacy dashboard (Sprint 6K). It is a team record: no member's own
// hours, signups or scores appear. Every member reads it and records testimonials; the council's history keepers - its
// Active officers and Admins, any Super Admin (CouncilLegacyMatrix.canKeepAnnals) - write each year's annals and the
// founding facts.
// Sprint 6L Extension 5: each member records at most one Oral History Testimonial (the recorder gives way to a note once
// it is on file), and the In Memoriam card deck (InMemoriamParts) honors the council's deceased brothers.
// Sprint 11 Revision 21.7: four tabs (COUNCIL_HISTORY_TABS):
//   - Founding Charter: the founding facts, an [ Edit Founding Info ] button that is always shown (disabled for members
//     who are not history keepers), and the Charter Members read from Member.flag_charter_member.
//   - Oral History & Diaries: the recorder, today's written entry and every year's diary.
//   - In Memoriam: the card deck.
//   - Fraternal Year Summaries: a card per year, newest first, with the seated officer core, the collective
//     accomplishments and the year's totals - members recruited, service hours and funds raised - computed from the
//     ledgers (LegacyYear.ledger). Nobody types the totals any more.
import { useState } from 'react';
import {
  COUNCIL_HISTORY_TABS,
  COUNCIL_HISTORY_TITLE,
  describeError,
  driveFileViewUrl,
  EDIT_FOUNDING_INFO_LABEL,
  HISTORY_TEXT_MAX_LENGTH,
  isDriveFileId,
  ORIGINAL_CHAPLAIN_MAX_LENGTH,
  platformSettings,
  type CouncilLegacyMatrix,
  type DiaryEntryDetail,
  type LegacyYear,
} from '@kofc/shared';
import { usePlatformSettings } from '@/components/SettingsParts';
import { RequireArea } from '@/components/CouncilScope';
import { SummaryCard } from '@/components/DuesParts';
import { InMemoriamDeck } from '@/components/InMemoriamParts';
import { OralHistoryRecorder } from '@/components/OralHistoryRecorder';
import { Button, Field, Input, Notice, PageTitle, Panel, Tabs, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type HistoryTab = (typeof COUNCIL_HISTORY_TABS)[number]['id'];

const longDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { dateStyle: 'long' }) : null;

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const count = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** A stored asset: a Drive file id opens in Drive; an https or blob link opens as is. */
const assetHref = (ref: string) => (isDriveFileId(ref) ? driveFileViewUrl(ref) : ref.split('#')[0]);

/** The year the founding facts are saved under: the oldest year with annals (the row the founding facts read first), else the current year. */
const foundingYearOf = (matrix: CouncilLegacyMatrix): string => [...matrix.years].reverse().find((y) => y.annals)?.fraternalYear ?? matrix.currentFraternalYear;

const KEEPERS_ONLY = "Only the council's officers, Admins and Super Admins edit the founding info.";

// ---- Founding Charter -----------------------------------------------------------------------------------------

function FoundingEditor({ matrix, onDone }: { matrix: CouncilLegacyMatrix; onDone: (saved: boolean) => Promise<void> }) {
  const user = useUser();
  const f = matrix.founding;
  const [form, setForm] = useState({
    establishment_date: f.establishmentDate ?? '',
    original_chaplain: f.originalChaplain ?? '',
    charter_photo_url: f.charterPhotoUrl ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((v) => ({ ...v, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await db.history.saveYearAnnals(user.memberId, matrix.councilId, foundingYearOf(matrix), { ...form });
      await onDone(true);
    } catch (err) {
      setError(describeError(err));
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded border-2 border-gold bg-white p-4 font-normal text-navy">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Establishment date">{(id) => <Input id={id} type="date" value={form.establishment_date} onChange={set('establishment_date')} />}</Field>
        <Field label="Original chaplain">
          {(id) => <Input id={id} value={form.original_chaplain} maxLength={ORIGINAL_CHAPLAIN_MAX_LENGTH} onChange={set('original_chaplain')} />}
        </Field>
        <Field label="Charter photo" hint="A Google Drive file id or an https link.">
          {(id) => <Input id={id} value={form.charter_photo_url} onChange={set('charter_photo_url')} />}
        </Field>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save founding info'}
        </Button>
        <Button variant="secondary" onClick={() => void onDone(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Founding({ matrix, reload }: { matrix: CouncilLegacyMatrix; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const f = matrix.founding;
  const nothing = !f.establishmentDate && !f.originalChaplain && !f.charterPhotoUrl;
  return (
    <SummaryCard id="history-founding" title="Our founding" subtitle="The council's charter, as the annals record it.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="gold" onClick={() => setEditing(true)} disabled={!matrix.canKeepAnnals || editing} title={matrix.canKeepAnnals ? undefined : KEEPERS_ONLY}>
          {EDIT_FOUNDING_INFO_LABEL}
        </Button>
        {matrix.canKeepAnnals ? null : <span className="text-sm text-muted">{KEEPERS_ONLY}</span>}
      </div>
      {editing ? (
        <FoundingEditor
          matrix={matrix}
          onDone={async (saved) => {
            if (saved) await reload();
            setEditing(false);
          }}
        />
      ) : nothing ? (
        <p>No founding facts recorded yet.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm uppercase tracking-wide text-muted">Chartered</dt>
            <dd className="text-xl">{longDate(f.establishmentDate) ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-sm uppercase tracking-wide text-muted">Original chaplain</dt>
            <dd className="text-xl">{f.originalChaplain ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-sm uppercase tracking-wide text-muted">Charter photo</dt>
            <dd className="text-xl">
              {f.charterPhotoUrl ? (
                <a href={assetHref(f.charterPhotoUrl)} target="_blank" rel="noreferrer" className="underline">
                  Open the charter photo
                </a>
              ) : (
                'Not recorded'
              )}
            </dd>
          </div>
        </dl>
      )}
    </SummaryCard>
  );
}

function CharterMembers({ matrix }: { matrix: CouncilLegacyMatrix }) {
  const list = matrix.charterMembers;
  return (
    <SummaryCard id="history-charter-members" title="Charter Members" subtitle="The brothers who founded the council, read from the member roll.">
      {list.length === 0 ? (
        <p>No charter members are marked on the member roll yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.memberId} className="border-b border-line py-1">
              <span className="font-bold">
                {c.firstName} {c.lastName}
              </span>
              {c.dateJoined ? <span className="ml-2 text-sm text-muted">joined {longDate(c.dateJoined)}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </SummaryCard>
  );
}

// ---- Oral History & Diaries -----------------------------------------------------------------------------------

function DiaryEntry({ d }: { d: DiaryEntryDetail }) {
  const audio = d.entry.audio_asset_url;
  return (
    <li className="rounded border-2 border-line p-3">
      <p className="text-sm text-navy">
        {longDate(d.entry.entry_date)} · {d.authorFirstName} {d.authorLastName}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{d.entry.diary_text}</p>
      {audio ? (
        isDriveFileId(audio) ? (
          <a href={driveFileViewUrl(audio)} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">
            Listen to the testimonial in Google Drive
          </a>
        ) : (
          <audio controls preload="none" src={assetHref(audio)} className="mt-2 w-full" aria-label={`Oral history testimonial by ${d.authorFirstName} ${d.authorLastName}`}>
            <a href={assetHref(audio)}>Download the testimonial</a>
          </audio>
        )
      ) : null}
    </li>
  );
}

function WrittenEntry({ matrix, reload }: { matrix: CouncilLegacyMatrix; reload: () => Promise<void> }) {
  const user = useUser();
  const maxChars = platformSettings(usePlatformSettings()).diary_text_max_length;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.history.addDiaryEntry(user.memberId, matrix.councilId, { fraternal_year: matrix.currentFraternalYear, diary_text: text });
      setText('');
      setMessage({ tone: 'info', text: "Today's diary entry is saved." });
      await reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <Field label={`Today's written entry (filed under ${matrix.currentFraternalYear})`} hint="One entry per day: a written entry or a recording.">
        {(id) => <Textarea id={id} value={text} maxLength={maxChars} onChange={(e) => setText(e.target.value)} disabled={!!matrix.myEntryToday} />}
      </Field>
      <div>
        <Button onClick={() => void save()} disabled={busy || !text.trim() || !!matrix.myEntryToday}>
          {busy ? 'Saving…' : 'Save written entry'}
        </Button>
      </div>
    </div>
  );
}

function OralHistory({ matrix, reload }: { matrix: CouncilLegacyMatrix; reload: () => Promise<void> }) {
  const withDiary = matrix.years.filter((y) => y.diary.length > 0);
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Spiritual diary and oral history">
        <div className="flex flex-col gap-6">
          {matrix.myTestimonial ? (
            <Notice tone="info">
              Your Oral History Testimonial is on file ({longDate(matrix.myTestimonial.entry_date)}, filed under {matrix.myTestimonial.fraternal_year}). Each member
              records one.
            </Notice>
          ) : (
            <OralHistoryRecorder years={matrix.years.map((y) => y.fraternalYear)} defaultYear={matrix.currentFraternalYear} todaysEntry={matrix.myEntryToday} onSaved={reload} />
          )}
          <WrittenEntry matrix={matrix} reload={reload} />
        </div>
      </Panel>
      {withDiary.length === 0 ? <p className="text-navy">No diary entries or oral histories are on file yet.</p> : null}
      {withDiary.map((y) => (
        <SummaryCard key={y.fraternalYear} id={`history-diary-${y.fraternalYear}`} title={`Diary and oral histories, ${y.fraternalYear}`}>
          <ul className="flex flex-col gap-2">
            {y.diary.map((d) => (
              <DiaryEntry key={d.entry.id} d={d} />
            ))}
          </ul>
        </SummaryCard>
      ))}
    </div>
  );
}

// ---- Fraternal Year Summaries ---------------------------------------------------------------------------------

function OfficerCore({ year }: { year: LegacyYear }) {
  if (year.officers.length === 0) return <p>No officer seats are recorded for this year.</p>;
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Seated officer core, {year.fraternalYear}</caption>
      <thead>
        <tr className="border-b-2 border-gold text-sm uppercase tracking-wide text-muted">
          <th scope="col" className="py-1 pr-3">
            Office
          </th>
          <th scope="col" className="py-1">
            Brother Knight
          </th>
        </tr>
      </thead>
      <tbody>
        {year.officers.map((o) => (
          <tr key={`${o.roleName}-${o.memberId}`} className="border-b border-line">
            <td className="py-1.5 pr-3">{o.roleName}</td>
            <td className="py-1.5">
              {o.firstName} {o.lastName}
              {o.steppedDown ? <span className="ml-2 text-sm text-navy">(stepped down mid-term)</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The year's totals, computed from the ledgers: members recruited, service hours and funds raised. */
function YearLedger({ year }: { year: LegacyYear }) {
  const tiles = [
    { label: 'Members recruited', value: count(year.ledger.membersRecruited) },
    { label: 'Service hours logged', value: count(year.ledger.serviceHours) },
    { label: 'Funds raised', value: money(year.ledger.fundsRaised) },
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded border-2 border-line p-3">
          <dt className="text-sm uppercase tracking-wide text-muted">{t.label}</dt>
          <dd className="text-2xl font-bold">{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AccomplishmentsEditor({ year, councilId, onDone }: { year: LegacyYear; councilId: number; onDone: (saved: boolean) => Promise<void> }) {
  const user = useUser();
  const [text, setText] = useState(year.annals?.collective_accomplishments ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await db.history.saveYearAnnals(user.memberId, councilId, year.fraternalYear, { collective_accomplishments: text });
      await onDone(true);
    } catch (err) {
      setError(describeError(err));
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded border-2 border-gold bg-white p-4 font-normal text-navy">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="Collective accomplishments" hint={`What the officer core achieved together. At most ${HISTORY_TEXT_MAX_LENGTH.toLocaleString('en-US')} characters.`}>
        {(id) => <Textarea id={id} value={text} maxLength={HISTORY_TEXT_MAX_LENGTH} onChange={(e) => setText(e.target.value)} className="min-h-32" />}
      </Field>
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : `Save ${year.fraternalYear}`}
        </Button>
        <Button variant="secondary" onClick={() => void onDone(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function YearCard({ year, matrix, reload }: { year: LegacyYear; matrix: CouncilLegacyMatrix; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const current = year.fraternalYear === matrix.currentFraternalYear;
  return (
    <SummaryCard id={`history-year-${year.fraternalYear}`} title={`Fraternal Year ${year.fraternalYear}${current ? ' (current)' : ''}`}>
      <div className="flex flex-col gap-6">
        <section aria-label={`Ledger totals, ${year.fraternalYear}`}>
          <h3 className="mb-2 text-sm uppercase tracking-wide text-muted">From the council ledgers</h3>
          <YearLedger year={year} />
        </section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
          <section aria-label={`Officer core, ${year.fraternalYear}`}>
            <h3 className="mb-2 text-sm uppercase tracking-wide text-muted">Seated officer core</h3>
            <OfficerCore year={year} />
          </section>
          <section aria-label={`Collective accomplishments, ${year.fraternalYear}`} className="flex flex-col gap-4">
            {editing ? (
              <AccomplishmentsEditor
                year={year}
                councilId={matrix.councilId}
                onDone={async (saved) => {
                  if (saved) await reload();
                  setEditing(false);
                }}
              />
            ) : (
              <div>
                <h3 className="text-sm uppercase tracking-wide text-muted">Collective accomplishments</h3>
                <p className="mt-1 whitespace-pre-wrap text-lg leading-relaxed">{year.annals?.collective_accomplishments || 'Not written yet.'}</p>
              </div>
            )}
            {matrix.canKeepAnnals && !editing ? (
              <div>
                <Button variant="gold" onClick={() => setEditing(true)}>
                  Edit accomplishments
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </SummaryCard>
  );
}

// ---- the page -------------------------------------------------------------------------------------------------

function CouncilHistory() {
  const user = useUser();
  const matrix = useLoad(() => db.history.getLegacyMatrix(user.memberId, user.councilId), [user.memberId, user.councilId]);
  const roll = useLoad(() => db.history.getInMemoriamRoll(user.memberId, user.councilId), [user.memberId, user.councilId]);
  const [tab, setTab] = useState<HistoryTab>('founding');
  const m = matrix.data;
  return (
    <>
      <PageTitle>{COUNCIL_HISTORY_TITLE}</PageTitle>
      <div className="flex flex-col gap-4">
        {matrix.error ? <Notice tone="error">{matrix.error}</Notice> : null}
        <Tabs tabs={COUNCIL_HISTORY_TABS} value={tab} onChange={setTab} label={COUNCIL_HISTORY_TITLE} idPrefix="council-history" />
        <div role="tabpanel" id="council-history-panel" aria-labelledby={`council-history-tab-${tab}`} className="flex flex-col gap-6">
          {tab === 'founding' && m ? (
            <>
              <Founding matrix={m} reload={matrix.reload} />
              <CharterMembers matrix={m} />
            </>
          ) : null}
          {tab === 'oral-history' && m ? <OralHistory matrix={m} reload={matrix.reload} /> : null}
          {tab === 'in-memoriam' ? (
            <>
              {roll.error ? <Notice tone="error">{roll.error}</Notice> : null}
              {roll.data ? <InMemoriamDeck roll={roll.data} reload={roll.reload} /> : null}
            </>
          ) : null}
          {tab === 'year-summaries' && m ? m.years.map((y) => <YearCard key={y.fraternalYear} year={y} matrix={m} reload={matrix.reload} />) : null}
        </div>
      </div>
    </>
  );
}

export default function HistoryPage() {
  return (
    <RequireArea area="history">
      <CouncilHistory />
    </RequireArea>
  );
}
