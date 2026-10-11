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
import { useState } from 'react';
import {
  councilLabel,
  councilWideSettings,
  COUNCIL_SETTING_GROUP_ORDER,
  COUNCIL_WIDE_SETTING_NAMES,
  COUNCIL_WIDE_SETTING_RULES,
  isSuperAdmin,
  sortCouncils,
  type Council,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { MeetingCheckInCard } from '@/components/MeetingCheckInCard';
import { GroupedSettingsCards } from '@/components/SettingsParts';
import { Notice, PageTitle, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

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
    <RequireArea area="setup/council-settings">
      <CouncilWideSettings />
    </RequireArea>
  );
}
