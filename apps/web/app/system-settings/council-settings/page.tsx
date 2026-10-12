'use client';
// Council Wide Settings (Sprint 7C): the numbers each council sets for itself, which used to be fixed in code - the
// volunteer time limits behind leadership review (volunteer-quarantine.ts) and the window Check for Inactive Members
// uses (member-lifecycle.ts). The council's Admins and officers edit their own council (canEditCouncilWideSettings);
// a Super Admin picks any council. The data service checks the same rule (assertMayEditCouncilWideSettings).
// The universal limits every council shares (recording time, character limits) are on Global System Parameters
// (/system-settings/global-settings, Sprint 7C Extension), for Super Admins.
//
// Sprint 7E: the ten timing settings join them (the expense filing window, the volunteer logging window, the hours
// reminder delay and cadence, and six saved for future features). The fields sit in three high-contrast cards -
// Financial Submissions, Volunteer & Meeting Operations and Reminder Cadences - and each has an (i) button that explains
// it in a popup (GroupedSettingsCards).
//
// Sprint 7G: under the cards, the Grand Knight, the council's Admins and Super Admins get the Meeting Check-In card
// (MeetingCheckInCard): the meeting point, the GPS check-in radius and the 4-digit meeting PIN.
//
// Sprint 7H: the Custom User Guides card prints either user guide for this council, with its numbers in place of the
// defaults (/api/council/compile-manual, customizeManualMarkdown). The page's own audience may print.
//
// Sprint 8A: the page moved from /setup/council-settings to /system-settings/council-settings, and it is now the only
// home of the Roster Inactivity Sweep (members.sweepInactive), which left the roster page and the Financial Secretary
// Desk. The card shows its button to the council's Admins and Super Admins (canAdministerCouncil), the sweep's own rule
// (assertMaySweepInactiveMembers); the page's other readers see who may run it.
//
// Sprint 8C: the Canonization Rank Benchmarks card (RankThresholdsCard) moved here from the Executive Summary's
// leaderboard. It is the only place they are edited (the council's Admins and Super Admins); everywhere else they are a
// read-only information block.
import { useState } from 'react';
import {
  canAdministerCouncil,
  councilLabel,
  councilWideSettings,
  customManualFileName,
  COUNCIL_SETTING_GROUP_ORDER,
  COUNCIL_WIDE_SETTING_NAMES,
  COUNCIL_WIDE_SETTING_RULES,
  isSuperAdmin,
  describeError,
  sortCouncils,
  type Council,
  type CustomManualKind,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { RankThresholdsCard } from '@/components/EngagementParts';
import { MeetingCheckInCard } from '@/components/MeetingCheckInCard';
import { GroupedSettingsCards } from '@/components/SettingsParts';
import { Button, Notice, PageTitle, Panel, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { compileCustomManual } from '@/services/custom-manual-transport';
import { db } from '@/services/db';

/** The Roster Inactivity Sweep (Sprint 7A; on this page only since Sprint 8A), on the council's saved window. */
function InactivitySweepCard({ council }: { council: Council }) {
  const user = useUser();
  const days = councilWideSettings(council).inactivity_threshold_days;
  const [sweeping, setSweeping] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const sweep = async () => {
    setSweeping(true);
    setMessage(null);
    try {
      const swept = await db.members.sweepInactive(user.memberId, council.id);
      setMessage({
        tone: 'info',
        text:
          swept.length === 0
            ? `No active member has gone more than ${days} days without logged service.`
            : `Marked ${swept.length} member${swept.length === 1 ? '' : 's'} Inactive: ${swept.map((m) => `${m.MemberFirstName} ${m.MemberLastName}`).join(', ')}.`,
      });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setSweeping(false);
    }
  };
  return (
    <Panel title="Roster Inactivity Sweep" className="mt-6">
      <p className="mb-3 text-base">
        Marks Inactive every active plain member of {council.CouncilName} with no logged service in more than <strong>{days} days</strong> (the inactivity
        window above). There is no scheduler, so an Admin runs it here.
      </p>
      {canAdministerCouncil(user, council.id) ? (
        <Button variant="secondary" disabled={sweeping} onClick={() => void sweep()}>
          {sweeping ? 'Checking…' : '🔍 Check for Inactive Members'}
        </Button>
      ) : (
        <p className="text-sm text-muted">Only the council&apos;s Admins and Super Admins run the sweep.</p>
      )}
      {message ? (
        <div className="mt-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
    </Panel>
  );
}

/** The two print buttons (Sprint 7H): the guide downloads with this council's saved numbers. */
function CustomGuidesCard({ council }: { council: Council }) {
  const [busy, setBusy] = useState<CustomManualKind | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const generate = async (guide: CustomManualKind) => {
    setBusy(guide);
    setMessage(null);
    try {
      const pdf = await compileCustomManual({
        guide,
        council: { id: council.id, number: council.CouncilNumber, name: council.CouncilName },
        settings: councilWideSettings(council),
      });
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = customManualFileName(guide, council.CouncilNumber);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage({ tone: 'info', text: `The ${guide === 'admin' ? 'Administrator' : 'Member'} guide for council ${council.CouncilNumber} is downloading.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Panel title="Custom User Guides" className="mt-6">
      <p className="mb-3 text-base">
        Print a user guide for {council.CouncilName} with the council&apos;s saved numbers in place of the defaults. Save any changed card first. The server
        compiles the PDF; the Administrator guide takes a few seconds.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="gold" disabled={busy !== null} onClick={() => void generate('admin')}>
          {busy === 'admin' ? 'Compiling…' : '📥 Generate Custom Admin Guide PDF'}
        </Button>
        <Button variant="gold" disabled={busy !== null} onClick={() => void generate('member')}>
          {busy === 'member' ? 'Compiling…' : '📥 Generate Custom Member Guide PDF'}
        </Button>
      </div>
      {message ? (
        <div className="mt-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
    </Panel>
  );
}

function SettingsPanels({ council, onSaved }: { council: Council; onSaved: () => Promise<void> }) {
  const user = useUser();
  const values = councilWideSettings(council);
  const save = async (changed: Partial<typeof values>) => {
    const saved = await db.councils.setCouncilWideSettings(user.memberId, council.id, changed);
    await onSaved();
    return `Saved for council ${saved.CouncilNumber}. The new numbers apply from now on.`;
  };
  return (
    <>
      <p className="mb-4 text-base">
        Each card saves on its own. Click <strong>(i)</strong> beside a field to see where and how the number changes the portal. A field marked{' '}
        <strong>Not used yet</strong> is saved for a future feature and changes nothing today.
      </p>
      <GroupedSettingsCards
        formKey={`${council.id}-${COUNCIL_WIDE_SETTING_NAMES.map((n) => values[n]).join('-')}`}
        names={COUNCIL_WIDE_SETTING_NAMES}
        rules={COUNCIL_WIDE_SETTING_RULES}
        values={values}
        groups={COUNCIL_SETTING_GROUP_ORDER}
        onSave={save}
      />
      <MeetingCheckInCard user={user} councilId={council.id} />
      <InactivitySweepCard council={council} />
      <RankThresholdsCard council={council} onSaved={() => void onSaved()} />
      <CustomGuidesCard council={council} />
    </>
  );
}

function CouncilWideSettings() {
  const user = useUser();
  const councils = useLoad(async () => sortCouncils(await db.councils.list()), []);
  const [councilId, setCouncilId] = useState(user.councilId);
  const list = isSuperAdmin(user) ? (councils.data ?? []) : (councils.data ?? []).filter((c) => c.id === user.councilId);
  const council = list.find((c) => c.id === councilId) ?? list[0];

  return (
    <>
      <PageTitle
        actions={
          isSuperAdmin(user) && list.length > 1 && council ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm uppercase tracking-wide text-muted">Council</span>
              <Select value={council.id} onChange={(e) => setCouncilId(Number(e.target.value))}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {councilLabel(c)}
                  </option>
                ))}
              </Select>
            </label>
          ) : null
        }
      >
        Council Wide Settings
      </PageTitle>
      {councils.error ? <Notice tone="error">{councils.error}</Notice> : null}
      {councils.loading && !councils.data ? (
        <p className="text-sm text-muted">Loading council settings…</p>
      ) : council ? (
        <SettingsPanels council={council} onSaved={councils.reload} />
      ) : (
        <Notice tone="info">No council found.</Notice>
      )}
    </>
  );
}

export default function CouncilSettingsPage() {
  return (
    <RequireArea area="system-settings/council-settings">
      <CouncilWideSettings />
    </RequireArea>
  );
}
