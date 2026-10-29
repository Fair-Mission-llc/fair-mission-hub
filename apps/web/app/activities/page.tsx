'use client';
// Activities: the council's standing activities (members log time against these from the phone app), split into
// two tabs. "Active Initiatives" holds activities nobody has logged time against yet; they can be added, edited
// and deleted. The moment any time is logged the activity moves to "Activity History" (activities.listSummaries),
// where choosing it lists every entry with the member, hours and notes and a running total. Admins work on their
// own council, Super Admins pick any. The drivers enforce the same rules (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED),
// and an activity with logged time cannot be deleted (RECORD_IN_USE), so its hours stay on record.
// Sprint 6L Extension 5: the activity form's Local Category picker shows the category's fixed Supreme Mission Area as a
// read-only badge (MissionCategoryParts).
// Sprint 11 Revision 9.0: each activity shows the Form 1728 line its name files to (Form1728Parts), and the history tab
// opens with the council's year-to-date hours by line.
// Sprint 11 Revision 11.0: saving a new or renamed activity, or one with no confirmed line, opens the Form 1728
// suggestion popup (useForm1728Confirm). The pick is saved in Activities.form_1728_line (schema 109); Cancel saves
// nothing. Each row's 'Change line' button reopens the popup for that activity alone.
import { useEffect, useState } from 'react';
import { canMaintainCouncilRecords, formatHours, supremeMissionAreaOf, type Activities, type ActivitySummary } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import {
  Form1728Badge,
  Form1728YearToDatePanel,
  FORM_1728_CANCELLED_MESSAGE,
  needsForm1728Confirmation,
  useForm1728Confirm,
} from '@/components/Form1728Parts';
import { LocalCategoryPicker } from '@/components/MissionCategoryParts';
import { RecordGrid, type Draft, type Selection } from '@/components/RecordGrid';
import { Button, cx, Empty, Field, Notice, PageTitle, Panel, Pill, Select, Table, Tabs, Td } from '@/components/ui';
import { formatDecimalHours, formatFullDate, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Tab = 'active' | 'history';

/** Every entry logged against one activity, newest first, with the total in a gold-edged box. */
function ActivityLog({ activity }: { activity: Activities }) {
  const log = useLoad(() => db.activityTime.listByActivity(activity.id), [activity.id]);
  if (log.error) return <Notice tone="error">{log.error}</Notice>;
  if (!log.data) return <p className="text-sm text-muted">Loading the time log…</p>;
  return (
    <Panel title={activity.ActivityName}>
      <div className="mb-4 flex items-stretch gap-4">
        <div className="rounded border-l-8 border-gold bg-white px-4 py-3 ring-1 ring-line">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Total hours reported</p>
          <p className="text-3xl font-bold">{formatDecimalHours(log.data.totalHours)}</p>
          <p className="text-xs text-muted">
            {log.data.entries.length} entr{log.data.entries.length === 1 ? 'y' : 'ies'} from{' '}
            {new Set(log.data.entries.map((e) => e.row.MemberID)).size} member{new Set(log.data.entries.map((e) => e.row.MemberID)).size === 1 ? '' : 's'}
          </p>
        </div>
        <p className="self-center text-sm text-muted">{activity.ActivityDescription}</p>
      </div>
      {log.data.entries.length === 0 ? (
        <Empty>No time has been logged against this activity.</Empty>
      ) : (
        <Table caption={`Time logged against ${activity.ActivityName}`} head={['Date', 'Member', 'Hours', 'Notes']}>
          {log.data.entries.map((e) => (
            <tr key={e.row.id}>
              <Td className="whitespace-nowrap">{formatFullDate(e.row.ActivityDate)}</Td>
              <Td>{formatPersonName(e.firstName, e.lastName)}</Td>
              <Td className="whitespace-nowrap">{formatHours(e.row.Hours)}</Td>
              <Td className="text-xs">{e.row.ActivityNotes || '–'}</Td>
            </tr>
          ))}
          <tr className="font-bold">
            <Td colSpan={2} className="text-right">
              Total
            </Td>
            <Td className="whitespace-nowrap">{formatHours(log.data.totalHours)}</Td>
            <Td />
          </tr>
        </Table>
      )}
    </Panel>
  );
}

function ActivityHistory({ summaries, categoryName }: { summaries: ActivitySummary[]; categoryName: Map<number, string> }) {
  const [chosen, setChosen] = useState<number | null>(null);
  useEffect(() => {
    if (chosen !== null && !summaries.some((s) => s.activity.id === chosen)) setChosen(null);
  }, [summaries, chosen]);
  const current = summaries.find((s) => s.activity.id === chosen)?.activity;

  if (summaries.length === 0) {
    return <Empty>No activity has logged time yet. An activity moves here as soon as a member logs hours against it.</Empty>;
  }
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="xl:col-span-2">
        <Form1728YearToDatePanel activities={summaries.map((s) => s.activity)} />
      </div>
      <Table caption="Activities with logged time" head={['Activity', 'Category', 'Form 1728', 'Entries', 'Hours', 'Last logged']}>
        {summaries.map((s) => {
          const active = s.activity.id === chosen;
          return (
            <tr key={s.activity.id} className={cx(active && 'outline outline-2 -outline-offset-2 outline-gold')}>
              <Td>
                <button type="button" aria-current={active ? 'true' : undefined} onClick={() => setChosen(s.activity.id)} className="text-left font-bold underline">
                  {s.activity.ActivityName}
                </button>
              </Td>
              <Td>
                <Pill tone="outline">{categoryName.get(s.activity.CategoryID) ?? '–'}</Pill>
              </Td>
              <Td>
                <Form1728Badge title={s.activity.ActivityName} description={s.activity.ActivityDescription} stored={s.activity.form_1728_line} />
              </Td>
              <Td>{s.entryCount}</Td>
              <Td>{formatDecimalHours(s.totalHours)}</Td>
              <Td className="whitespace-nowrap">{formatFullDate(s.lastLoggedOn)}</Td>
            </tr>
          );
        })}
      </Table>
      {current ? <ActivityLog key={current.id} activity={current} /> : <Empty>Choose an activity to see who logged time against it.</Empty>}
    </div>
  );
}

function ActivityCatalog() {
  const user = useUser();
  const scope = useCouncilScope();
  const categories = useLoad(() => db.lookups.list('Category'), []);
  const summaries = useLoad(() => db.activities.listSummaries(scope.councilId), [scope.councilId]);
  const [tab, setTab] = useState<Tab>('active');
  const [selected, setSelected] = useState<Selection>(null);
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const canEdit = canMaintainCouncilRecords(user, scope.councilId);
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.Category]));
  const inCategory = (s: ActivitySummary) => categoryFilter === 'all' || s.activity.CategoryID === categoryFilter;
  const active = summaries.data?.filter((s) => !s.archived && inCategory(s)).map((s) => s.activity);
  const history = (summaries.data ?? []).filter((s) => s.archived && inCategory(s));
  const archivedCount = (summaries.data ?? []).filter((s) => s.archived).length;
  const activeCount = (summaries.data?.length ?? 0) - archivedCount;

  const confirmLine = useForm1728Confirm();
  const missionAreaOf = (categoryId: number) => supremeMissionAreaOf((categories.data ?? []).find((c) => c.id === categoryId));

  /** Opens the popup when the record needs a confirmed line; throws when the officer cancels, so nothing is saved. */
  const confirmedLine = async (name: string, description: string, categoryId: number, row: Activities | null): Promise<string> => {
    const stored = row?.form_1728_line ?? null;
    if (!needsForm1728Confirmation(name, row?.ActivityName ?? null, stored)) return stored!;
    const renamed = row !== null && name.trim() !== row.ActivityName.trim();
    const code = await confirmLine.ask({ title: name, description, context: { missionArea: missionAreaOf(categoryId) }, initial: renamed ? null : stored });
    if (code === null) throw new Error(FORM_1728_CANCELLED_MESSAGE);
    return code;
  };

  const changeLine = async (a: Activities) => {
    const code = await confirmLine.ask({
      title: a.ActivityName,
      description: a.ActivityDescription,
      context: { missionArea: missionAreaOf(a.CategoryID) },
      initial: a.form_1728_line ?? null,
    });
    if (code === null) return;
    await db.activities.update(user.memberId, a.id, { form_1728_line: code });
    await summaries.reload();
  };

  const save = async (d: Draft, row: Activities | null): Promise<Activities> => {
    const categoryId = Number(d.CategoryID);
    const form_1728_line = await confirmedLine(d.ActivityName, d.ActivityDescription, categoryId, row);
    const values = { ActivityName: d.ActivityName, ActivityDescription: d.ActivityDescription, CategoryID: categoryId, form_1728_line };
    const saved = row
      ? await db.activities.update(user.memberId, row.id, values)
      : await db.activities.create(user.memberId, { ...values, CouncilID: scope.councilId });
    await summaries.reload();
    return saved;
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-end gap-3">
            <Field label="Category" className="w-48">
              {(id) => (
                <Select id={id} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                  <option value="all">All categories</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.Category}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <CouncilSelect scope={scope} />
          </div>
        }
      >
        Activities
      </PageTitle>
      <Tabs
        label="Activity lists"
        idPrefix="activities"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'active', label: `Active Initiatives (${activeCount})` },
          { id: 'history', label: `Activity History (${archivedCount})` },
        ]}
      />
      {confirmLine.dialog}
      <div id="activities-panel" role="tabpanel" aria-labelledby={`activities-tab-${tab}`} className="mt-4">
        {summaries.error || categories.error ? <Notice tone="error">{summaries.error ?? categories.error}</Notice> : null}
        {tab === 'active' ? (
          <RecordGrid
            key={scope.councilId}
            noun="activity"
            title="Active initiatives"
            rows={active}
            canEdit={canEdit}
            columns={[
              { label: 'Activity', render: (a) => a.ActivityName },
              { label: 'Category', render: (a) => <Pill tone="outline">{categoryName.get(a.CategoryID) ?? '–'}</Pill> },
              {
                label: 'Form 1728',
                render: (a) => (
                  <span className="flex flex-wrap items-center gap-2">
                    <Form1728Badge title={a.ActivityName} description={a.ActivityDescription} stored={a.form_1728_line} />
                    {canEdit ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => void changeLine(a)}>
                        Change line
                      </Button>
                    ) : null}
                  </span>
                ),
              },
              { label: 'Description', render: (a) => a.ActivityDescription, className: 'text-xs' },
            ]}
            fields={[
              { key: 'ActivityName', label: 'Activity name', maxLength: 100, wide: true },
              {
                key: 'CategoryID',
                label: 'Local Category',
                render: (value, setValue, disabled, id) => (
                  <LocalCategoryPicker
                    id={id}
                    categories={categories.data ?? []}
                    value={value === '' ? null : Number(value)}
                    onChange={(categoryId) => setValue(categoryId === null ? '' : String(categoryId))}
                    required
                    disabled={disabled}
                  />
                ),
                wide: true,
              },
              { key: 'ActivityDescription', label: 'Description', maxLength: 255, wide: true },
            ]}
            blank={() => ({
              ActivityName: '',
              ActivityDescription: '',
              CategoryID: String(categoryFilter === 'all' ? (categories.data?.[0]?.id ?? '') : categoryFilter),
            })}
            toDraft={(a) => ({ ActivityName: a.ActivityName, ActivityDescription: a.ActivityDescription, CategoryID: String(a.CategoryID) })}
            rowLabel={(a) => a.ActivityName}
            matches={(a, q) => `${a.ActivityName} ${a.ActivityDescription}`.toLowerCase().includes(q)}
            onSave={save}
            onRemove={async (a) => {
              await db.activities.remove(user.memberId, a.id);
              await summaries.reload();
            }}
            selected={selected}
            onSelect={setSelected}
          />
        ) : summaries.data ? (
          <ActivityHistory summaries={history} categoryName={categoryName} />
        ) : null}
      </div>
    </>
  );
}

export default function ActivitiesPage() {
  return (
    <RequireArea area="activities">
      <ActivityCatalog />
    </RequireArea>
  );
}
