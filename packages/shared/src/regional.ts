// =========================================================================
// REGIONAL OVERSIGHT (Sprint 11 Revision 5.0, schema 104)
//
// A member may hold one regional jurisdiction (MemberRegionalAssignment) in one state:
//   DISTRICT_DEPUTY  the District Desk (/district-desk) over the councils bound to the assignment (MemberRegionalCouncil)
//   STATE_OFFICER    the State Desk (/state-desk) over every council in the state, plus any bound council
//   STATE_ADMIN      the State Desk too, and may assign District Deputies and State Officers inside that state only
// Each type also gives the member its role (REGIONAL_ROLE_NAMES: 'District Deputy', 'State Officer', 'State Admin'), so
// the session's role list opens the desks. Super Admins see every council and assign anywhere; only a Super Admin
// makes a State Admin.
//
// A State Council instance is a Council row with council_level 'STATE' (e.g. the Oregon State Council). It has no
// Supreme number, so the platform numbers it from STATE_COUNCIL_NUMBER_BASE; councils.create gives it its own checking
// account and books (STATE_COUNCIL_TEMPLATE_ACCOUNTS), and its members work from the State Desk.
//
// The desks: a Static Top Deck of regional totals (volunteer hours this fraternal year, gross cash balances, asset
// count) and eight drawers (REGIONAL_DESK_DRAWERS), all built by buildRegionalDeskReport from raw rows the drivers load
// (REGIONAL_DESK_TABLES). Nothing on a regional desk writes to a council.
// =========================================================================
import { currentFraternalYear, fraternalYearBounds } from './budget';
import { BusinessRuleError, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { Council, GLAccount } from './types';

// ---- assignment types and roles ------------------------------------------------------------------------------------

export type RegionalAssignmentType = 'DISTRICT_DEPUTY' | 'STATE_OFFICER' | 'STATE_ADMIN';
export const REGIONAL_ASSIGNMENT_TYPES: readonly RegionalAssignmentType[] = ['DISTRICT_DEPUTY', 'STATE_OFFICER', 'STATE_ADMIN'];

export const DISTRICT_DEPUTY_ROLE = 'District Deputy';
export const STATE_OFFICER_ROLE = 'State Officer';
export const STATE_ADMIN_ROLE = 'State Admin';

/** The role each assignment type gives its holder. */
export const REGIONAL_ROLE_OF: Record<RegionalAssignmentType, string> = {
  DISTRICT_DEPUTY: DISTRICT_DEPUTY_ROLE,
  STATE_OFFICER: STATE_OFFICER_ROLE,
  STATE_ADMIN: STATE_ADMIN_ROLE,
};
export const REGIONAL_ROLE_NAMES: readonly string[] = Object.values(REGIONAL_ROLE_OF);

export const REGIONAL_ASSIGNMENT_LABELS: Record<RegionalAssignmentType, string> = {
  DISTRICT_DEPUTY: 'District Deputy',
  STATE_OFFICER: 'State Officer',
  STATE_ADMIN: 'State Admin',
};

export const isRegionalAssignmentType = (value: unknown): value is RegionalAssignmentType =>
  typeof value === 'string' && (REGIONAL_ASSIGNMENT_TYPES as readonly string[]).includes(value);

// ---- State Councils ------------------------------------------------------------------------------------------------

export type CouncilLevel = 'LOCAL' | 'STATE';
export const COUNCIL_LEVELS: readonly CouncilLevel[] = ['LOCAL', 'STATE'];
/** A State Council's platform number: this base plus a running number (the Oregon State Council is 900001). */
export const STATE_COUNCIL_NUMBER_BASE = 900_000;

export const isStateCouncil = (council: Pick<Council, 'council_level'> | null | undefined): boolean => council?.council_level === 'STATE';

/** Council.council_level as written: 'LOCAL' when left out; INVALID_INPUT for anything but LOCAL or STATE. */
export function cleanCouncilLevel(value: unknown): CouncilLevel {
  if (value === undefined || value === null || value === '') return 'LOCAL';
  if (value === 'LOCAL' || value === 'STATE') return value;
  throw new BusinessRuleError('INVALID_INPUT', `A council's level is LOCAL or STATE; received ${JSON.stringify(value)}.`, { field: 'council_level' });
}

/** The books a new State Council instance starts with: its own checking account, revenue, costs and equity. */
export const STATE_COUNCIL_TEMPLATE_ACCOUNTS: readonly Pick<GLAccount, 'AccountName' | 'AccountType'>[] = [
  { AccountName: 'State Operating Checking', AccountType: 'Asset' },
  { AccountName: 'State Per Capita Revenue', AccountType: 'Revenue' },
  { AccountName: 'State Operational Costs', AccountType: 'Expense' },
  { AccountName: 'Opening Balance Equity', AccountType: 'Equity' },
];

// ---- desks and session gates ---------------------------------------------------------------------------------------

export type RegionalDesk = 'district' | 'state';
export const DISTRICT_DESK_HREF = '/district-desk';
export const STATE_DESK_HREF = '/state-desk';
export const DISTRICT_DESK_TITLE = 'District Deputy Desk';
export const STATE_DESK_TITLE = 'State Oversight Desk';
export const REGIONAL_ASSIGNMENTS_TITLE = 'Regional Jurisdiction Assignments';

interface SessionActor {
  memberType?: string;
  roles?: readonly string[];
}
const has = (u: SessionActor, role: string) => (u.roles ?? []).includes(role);
const superAdmin = (u: SessionActor) => u.memberType === 'Super Admin';

export const canOpenDistrictDesk = (u: SessionActor): boolean => superAdmin(u) || has(u, DISTRICT_DEPUTY_ROLE);
export const canOpenStateDesk = (u: SessionActor): boolean => superAdmin(u) || has(u, STATE_OFFICER_ROLE) || has(u, STATE_ADMIN_ROLE);
/** The assignment panel: Super Admins (everywhere) and State Admins (their own state). */
export const canOpenRegionalAssignments = (u: SessionActor): boolean => superAdmin(u) || has(u, STATE_ADMIN_ROLE);

// ---- assignments ---------------------------------------------------------------------------------------------------

/** One member's jurisdiction, as the panel lists it. */
export interface RegionalAssignment {
  id: number;
  memberId: number;
  memberName: string;
  homeCouncilId: number;
  assignmentType: RegionalAssignmentType;
  stateCode: string;
  councilIds: number[];
  assignedByMemberId: number | null;
  assignedAt: string;
}

/** regional.saveAssignment's input: replaces the member's jurisdiction, if any. */
export interface RegionalAssignmentInput {
  memberId: number;
  assignmentType: RegionalAssignmentType;
  stateCode: string;
  councilIds: number[];
}

/** What the assignment panel may offer the actor. `stateLimit` is the State Admin's state, null for a Super Admin. */
export interface RegionalAssignmentWorkspace {
  stateLimit: string | null;
  assignments: RegionalAssignment[];
  members: { id: number; name: string; councilId: number; state: string }[];
  councils: { id: number; label: string; state: string; level: CouncilLevel }[];
}

const STATE_CODE = /^[A-Za-z][A-Za-z .-]{0,49}$/;

export function cleanRegionalAssignmentInput(input: unknown): RegionalAssignmentInput {
  const raw = (input ?? {}) as Partial<RegionalAssignmentInput>;
  const invalid = (message: string, field: string) => new BusinessRuleError('INVALID_INPUT', message, { field });
  if (!Number.isInteger(raw.memberId) || (raw.memberId as number) < 1) throw invalid('Choose the member to assign.', 'memberId');
  if (!isRegionalAssignmentType(raw.assignmentType)) throw invalid('Choose District Deputy, State Officer or State Admin.', 'assignmentType');
  const stateCode = typeof raw.stateCode === 'string' ? raw.stateCode.trim().toUpperCase() : '';
  if (!STATE_CODE.test(stateCode)) throw invalid('Enter the state the jurisdiction covers, for example OR.', 'stateCode');
  const ids = Array.isArray(raw.councilIds) ? raw.councilIds : [];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) throw invalid('Each bound council must be a council of the platform.', 'councilIds');
  const councilIds = [...new Set(ids)].sort((a, b) => a - b);
  if (raw.assignmentType === 'DISTRICT_DEPUTY' && councilIds.length === 0) throw invalid('Bind at least one council to a District Deputy.', 'councilIds');
  return { memberId: raw.memberId as number, assignmentType: raw.assignmentType, stateCode, councilIds };
}

/** The state a State Admin keeps, read from their own assignment; null for anyone else. */
export const stateAdminStateOf = (own: Pick<RegionalAssignment, 'assignmentType' | 'stateCode'> | null | undefined): string | null =>
  own?.assignmentType === 'STATE_ADMIN' ? own.stateCode : null;

/**
 * May the actor write this assignment? Super Admins anywhere. A State Admin only inside their state: the member's home
 * council and every bound council must be in it, and they may not make another State Admin. Everyone else:
 * SUPER_ADMIN_REQUIRED. `memberState` is the member's home council's state; `councilStates` maps each bound council.
 */
export function assertMayAssignRegional(
  actor: Pick<MemberWriteActor, 'memberId' | 'memberType' | 'active'>,
  actorStateAdminState: string | null,
  input: Pick<RegionalAssignmentInput, 'assignmentType' | 'stateCode' | 'councilIds'>,
  memberState: string,
  councilStates: ReadonlyMap<number, string>,
): void {
  if (actor.active && actor.memberType === 'Super Admin') return;
  const state = actorStateAdminState?.toUpperCase() ?? null;
  if (!actor.active || state === null) {
    throw new SecurityPrivilegeError('SUPER_ADMIN_REQUIRED', `Only a Super Admin or a State Admin can assign regional jurisdictions; member ${actor.memberId} is neither.`, {
      actorId: actor.memberId,
    });
  }
  const outside = (where: string) =>
    new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `A State Admin of ${state} can assign only inside ${state}; ${where} is outside it.`, { actorId: actor.memberId, state });
  if (input.assignmentType === 'STATE_ADMIN') {
    throw new SecurityPrivilegeError('SUPER_ADMIN_REQUIRED', 'Only a Super Admin can make a State Admin.', { actorId: actor.memberId });
  }
  if (input.stateCode.toUpperCase() !== state) throw outside(`state ${input.stateCode}`);
  if (memberState.toUpperCase() !== state) throw outside("the member's home council");
  for (const id of input.councilIds) {
    if ((councilStates.get(id) ?? '').toUpperCase() !== state) throw outside(`council ${id}`);
  }
}

/** The assignment panel: an active Super Admin, or a State Admin (`stateLimit`); SUPER_ADMIN_REQUIRED otherwise. */
export function assertMayOpenRegionalAssignments(actor: Pick<MemberWriteActor, 'memberId' | 'memberType' | 'active'>, stateLimit: string | null): void {
  if (actor.active && (actor.memberType === 'Super Admin' || stateLimit !== null)) return;
  throw new SecurityPrivilegeError('SUPER_ADMIN_REQUIRED', `Only a Super Admin or a State Admin can manage regional jurisdictions; member ${actor.memberId} is neither.`, {
    actorId: actor.memberId,
  });
}

/**
 * A State Admin may change or end only a jurisdiction inside their own state that is not another State Admin's.
 * Super Admins may change any.
 */
export function assertMayReplaceRegional(
  actor: Pick<MemberWriteActor, 'memberId' | 'memberType' | 'active'>,
  stateLimit: string | null,
  existing: Pick<RegionalAssignment, 'assignmentType' | 'stateCode'> | null,
): void {
  if (!existing || (actor.active && actor.memberType === 'Super Admin')) return;
  if (existing.assignmentType === 'STATE_ADMIN') {
    throw new SecurityPrivilegeError('SUPER_ADMIN_REQUIRED', "Only a Super Admin can change a State Admin's jurisdiction.", { actorId: actor.memberId });
  }
  if (stateLimit === null || existing.stateCode.toUpperCase() !== stateLimit.toUpperCase()) {
    throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `That jurisdiction is in ${existing.stateCode}, outside your state.`, { actorId: actor.memberId });
  }
}

/**
 * The councils a desk covers for the reader. Super Admins: every council. District Desk: a District Deputy's bound
 * councils. State Desk: a State Officer's or State Admin's state, plus bound councils. Anyone else: COUNCIL_ACCESS_DENIED.
 */
export function regionalCouncilIds(
  desk: RegionalDesk,
  actor: Pick<MemberWriteActor, 'memberId' | 'memberType' | 'active'>,
  own: Pick<RegionalAssignment, 'assignmentType' | 'stateCode' | 'councilIds'> | null,
  councils: readonly Pick<Council, 'id' | 'State'>[],
): number[] {
  const all = councils.map((c) => c.id).sort((a, b) => a - b);
  if (actor.active && actor.memberType === 'Super Admin') return all;
  const deny = () =>
    new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} holds no ${desk === 'district' ? 'District Deputy' : 'state'} jurisdiction.`, {
      actorId: actor.memberId,
      desk,
    });
  if (!actor.active || !own) throw deny();
  const known = new Set(all);
  if (desk === 'district') {
    if (own.assignmentType !== 'DISTRICT_DEPUTY') throw deny();
    return own.councilIds.filter((id) => known.has(id));
  }
  if (own.assignmentType === 'DISTRICT_DEPUTY') throw deny();
  const state = own.stateCode.toUpperCase();
  const ids = new Set(councils.filter((c) => (c.State ?? '').toUpperCase() === state).map((c) => c.id));
  for (const id of own.councilIds) if (known.has(id)) ids.add(id);
  return [...ids].sort((a, b) => a - b);
}

// ---- the desk report -----------------------------------------------------------------------------------------------

export type RegionalDeskDrawerId = 'directory' | 'finances' | 'hours' | 'charity' | 'calendar' | 'assets' | 'goals' | 'leaderboard';

export interface RegionalDeskDrawer {
  id: RegionalDeskDrawerId;
  label: string;
  hint: string;
}

/** The eight drawers of both regional desks, top to bottom. Every one starts closed. */
export const REGIONAL_DESK_DRAWERS: readonly RegionalDeskDrawer[] = [
  { id: 'directory', label: 'Council Directory & Affiliation Networks', hint: 'Every council in the region and the sister-council links between them' },
  { id: 'finances', label: 'Financial & Budgetary Balance Rollups', hint: 'Cash balances and this fraternal year\'s revenue and costs, council by council' },
  { id: 'hours', label: 'Activity & Volunteer Hours Summary', hint: 'Shift and activity hours this fraternal year' },
  { id: 'charity', label: 'Charitable Contributions & Grant Audits', hint: 'Charity grants paid this fraternal year, with check numbers' },
  { id: 'calendar', label: 'Master Regional Calendar', hint: 'Upcoming events and meetings; filter by council' },
  { id: 'assets', label: 'Combined Physical Asset Ledger', hint: "Every council's equipment and its cost" },
  { id: 'goals', label: 'Council Goals Progress Center', hint: 'Hours, new members and fundraising against each council\'s targets' },
  { id: 'leaderboard', label: 'Top Performers & Volunteer Leaderboards', hint: 'Top 10 volunteers in the region, or the top 5 of one council' },
];

export const REGIONAL_LEADERBOARD_SIZE = 10;
export const COUNCIL_LEADERBOARD_SIZE = 5;
/** How far ahead the regional calendar looks. */
export const REGIONAL_CALENDAR_DAYS = 120;

/** The tables the drivers load for buildRegionalDeskReport. */
export const REGIONAL_DESK_TABLES = [
  'Council',
  'CouncilAffiliations',
  'Member',
  'MemberStatus',
  'EventTime',
  'Shift',
  'Event',
  'EventCouncils',
  'ActivityTime',
  'Activities',
  'GLAccount',
  'JournalEntry',
  'CouncilAssetsInventory',
  'CharitableDisbursementLedger',
  'GlobalCharityRegistry',
  'CouncilGoals',
  'Meeting',
] as const;
export type RegionalDeskTable = (typeof REGIONAL_DESK_TABLES)[number];
type Row = Record<string, unknown>;
export type RegionalDeskRows = Record<RegionalDeskTable, readonly Row[]>;

export interface RegionalCouncilSummary {
  councilId: number;
  councilNumber: number;
  councilName: string;
  state: string;
  districtNumber: number | null;
  level: CouncilLevel;
  activeMembers: number;
  cashBalance: number;
  revenue: number;
  expenses: number;
  eventHours: number;
  activityHours: number;
  totalHours: number;
  volunteers: number;
  charityTotal: number;
  charityCount: number;
  assetCount: number;
  assetValue: number;
}

export interface RegionalGoalProgress {
  councilId: number;
  hours: { actual: number; target: number | null };
  newMembers: { actual: number; target: number | null };
  fundraising: { actual: number; target: number | null };
}

export interface RegionalVolunteer {
  memberId: number;
  name: string;
  councilId: number;
  hours: number;
}

export interface RegionalCalendarItem {
  kind: 'event' | 'meeting';
  id: number;
  title: string;
  date: string;
  location: string;
  councilIds: number[];
}

export interface RegionalDeskReport {
  desk: RegionalDesk;
  fraternalYear: string;
  councilIds: number[];
  totals: { councils: number; volunteerHours: number; grossBalance: number; assetCount: number; assetValue: number };
  councils: RegionalCouncilSummary[];
  affiliations: { councilId: number; sisterCouncilId: number; since: string | null }[];
  grants: { id: number; councilId: number; charityName: string; amount: number; checkNumber: string | null; payoutDate: string; notes: string | null }[];
  calendar: RegionalCalendarItem[];
  assets: { id: number; councilId: number; name: string; purchaseDate: string; costBasis: number; status: string; location: string | null }[];
  goals: RegionalGoalProgress[];
  /** Every volunteer with hours this fraternal year, most hours first (then name). */
  volunteers: RegionalVolunteer[];
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const cents = (v: number) => Math.round(v * 100) / 100;
const day = (v: unknown) => String(v ?? '').slice(0, 10);
const inYear = (v: unknown, from: string, to: string) => {
  const d = day(v);
  return d >= from && d <= to;
};

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The desk's whole report, from raw rows (the region's councils only; every other row is ignored). */
export function buildRegionalDeskReport(desk: RegionalDesk, councilIds: readonly number[], rows: RegionalDeskRows, today: Date): RegionalDeskReport {
  const ids = new Set(councilIds);
  const fraternalYear = currentFraternalYear(today);
  const { fromDate, toDate } = fraternalYearBounds(fraternalYear);
  const todayIso = isoDay(today);
  const horizon = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + REGIONAL_CALENDAR_DAYS));

  const councils = rows.Council.filter((c) => ids.has(c.id as number));
  const activeStatus = rows.MemberStatus.find((s) => s.Status === 'Active')?.id;
  const members = rows.Member.filter((m) => ids.has(m.CouncilID as number));
  const memberCouncil = new Map(members.map((m) => [m.id as number, m.CouncilID as number]));
  const memberName = new Map(members.map((m) => [m.id as number, `${String(m.MemberFirstName ?? '')} ${String(m.MemberLastName ?? '')}`.trim()]));

  // Hours this fraternal year: shift hours by the shift's date, activity hours by the activity's date.
  const shiftDate = new Map(rows.Shift.map((s) => [s.id as number, day(s.ShiftDate)]));
  const eventHours = new Map<number, number>();
  const activityHours = new Map<number, number>();
  for (const t of rows.EventTime) {
    const member = t.MemberID as number;
    if (!memberCouncil.has(member) || !inYear(shiftDate.get(t.ShiftID as number), fromDate, toDate)) continue;
    eventHours.set(member, (eventHours.get(member) ?? 0) + num(t.Hours));
  }
  for (const t of rows.ActivityTime) {
    const member = t.MemberID as number;
    if (!memberCouncil.has(member) || !inYear(t.ActivityDate, fromDate, toDate)) continue;
    activityHours.set(member, (activityHours.get(member) ?? 0) + num(t.Hours));
  }

  // Money: Asset (cash) balances to date; Revenue and Expense this fraternal year.
  const accounts = new Map(rows.GLAccount.filter((a) => ids.has(a.CouncilID as number)).map((a) => [a.id as number, a]));
  const cash = new Map<number, number>();
  const revenue = new Map<number, number>();
  const expenses = new Map<number, number>();
  for (const j of rows.JournalEntry) {
    const account = accounts.get(j.GLAccountID as number);
    if (!account) continue;
    const council = account.CouncilID as number;
    const debit = num(j.DebitAmount);
    const credit = num(j.CreditAmount);
    if (account.AccountType === 'Asset' && !num(account.IsVirtualGoal)) cash.set(council, (cash.get(council) ?? 0) + debit - credit);
    if (!inYear(j.DateLogged, fromDate, toDate)) continue;
    if (account.AccountType === 'Revenue') revenue.set(council, (revenue.get(council) ?? 0) + credit - debit);
    if (account.AccountType === 'Expense') expenses.set(council, (expenses.get(council) ?? 0) + debit - credit);
  }

  const charityName = new Map(rows.GlobalCharityRegistry.map((c) => [c.id as number, String(c.Name ?? '')]));
  const grants = rows.CharitableDisbursementLedger.filter((g) => ids.has(g.CouncilID as number) && inYear(g.PayoutDate, fromDate, toDate))
    .map((g) => ({
      id: g.id as number,
      councilId: g.CouncilID as number,
      charityName: charityName.get(g.CharityID as number) ?? 'Unknown charity',
      amount: cents(num(g.Amount)),
      checkNumber: (g.CheckNumber as string | null) ?? null,
      payoutDate: day(g.PayoutDate),
      notes: (g.Notes as string | null) ?? null,
    }))
    .sort((a, b) => b.payoutDate.localeCompare(a.payoutDate) || b.id - a.id);

  const assets = rows.CouncilAssetsInventory.filter((a) => ids.has(a.council_id as number) && a.current_status !== 'DISPOSED')
    .map((a) => ({
      id: a.id as number,
      councilId: a.council_id as number,
      name: String(a.asset_name ?? ''),
      purchaseDate: day(a.purchase_date),
      costBasis: cents(num(a.cost_basis)),
      status: String(a.current_status ?? ''),
      location: (a.storage_location as string | null) ?? null,
    }))
    .sort((a, b) => a.councilId - b.councilId || a.name.localeCompare(b.name));

  const summaries: RegionalCouncilSummary[] = councils
    .map((c) => {
      const id = c.id as number;
      const own = members.filter((m) => m.CouncilID === id);
      const ev = own.reduce((sum, m) => sum + (eventHours.get(m.id as number) ?? 0), 0);
      const ac = own.reduce((sum, m) => sum + (activityHours.get(m.id as number) ?? 0), 0);
      const councilGrants = grants.filter((g) => g.councilId === id);
      const councilAssets = assets.filter((a) => a.councilId === id);
      return {
        councilId: id,
        councilNumber: num(c.CouncilNumber),
        councilName: String(c.CouncilName ?? ''),
        state: String(c.State ?? ''),
        districtNumber: c.district_number == null ? null : num(c.district_number),
        level: (c.council_level === 'STATE' ? 'STATE' : 'LOCAL') as CouncilLevel,
        activeMembers: own.filter((m) => m.StatusID === activeStatus).length,
        cashBalance: cents(cash.get(id) ?? 0),
        revenue: cents(revenue.get(id) ?? 0),
        expenses: cents(expenses.get(id) ?? 0),
        eventHours: cents(ev),
        activityHours: cents(ac),
        totalHours: cents(ev + ac),
        volunteers: own.filter((m) => (eventHours.get(m.id as number) ?? 0) + (activityHours.get(m.id as number) ?? 0) > 0).length,
        charityTotal: cents(councilGrants.reduce((s, g) => s + g.amount, 0)),
        charityCount: councilGrants.length,
        assetCount: councilAssets.length,
        assetValue: cents(councilAssets.reduce((s, a) => s + a.costBasis, 0)),
      };
    })
    .sort((a, b) => (a.level === b.level ? a.councilNumber - b.councilNumber : a.level === 'STATE' ? -1 : 1));

  const affiliations = rows.CouncilAffiliations.filter(
    (a) => a.status === 'ACTIVE' && (ids.has(a.requesting_council_id as number) || ids.has(a.target_council_id as number)),
  ).map((a) => ({ councilId: a.requesting_council_id as number, sisterCouncilId: a.target_council_id as number, since: (a.date_established as string | null) ?? null }));

  const eventCouncils = new Map<number, number[]>();
  for (const l of rows.EventCouncils) {
    if (!ids.has(l.CouncilID as number)) continue;
    eventCouncils.set(l.EventID as number, [...(eventCouncils.get(l.EventID as number) ?? []), l.CouncilID as number]);
  }
  const calendar: RegionalCalendarItem[] = [
    ...rows.Event.filter((e) => eventCouncils.has(e.id as number) && day(e.EndDate || e.StartDate) >= todayIso && day(e.StartDate) <= horizon).map((e) => ({
      kind: 'event' as const,
      id: e.id as number,
      title: String(e.EventName ?? ''),
      date: day(e.StartDate),
      location: String(e.Location ?? ''),
      councilIds: (eventCouncils.get(e.id as number) ?? []).sort((a, b) => a - b),
    })),
    ...rows.Meeting.filter((m) => ids.has(m.CouncilID as number) && day(m.Date) >= todayIso && day(m.Date) <= horizon).map((m) => ({
      kind: 'meeting' as const,
      id: m.id as number,
      title: String(m['Meeting Name'] ?? 'Meeting'),
      date: day(m.Date),
      location: String(m.Location ?? ''),
      councilIds: [m.CouncilID as number],
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  const goals: RegionalGoalProgress[] = summaries.map((s) => {
    const target = rows.CouncilGoals.find((g) => g.council_id === s.councilId && g.fraternal_year === fraternalYear);
    const joined = members.filter((m) => m.CouncilID === s.councilId && inYear(m.DateJoinedCouncil, fromDate, toDate)).length;
    const t = (v: unknown) => (v == null ? null : num(v));
    return {
      councilId: s.councilId,
      hours: { actual: s.totalHours, target: target ? t(target.hours_target) : null },
      newMembers: { actual: joined, target: target ? t(target.new_members_target) : null },
      fundraising: { actual: s.revenue, target: target ? t(target.fundraising_target) : null },
    };
  });

  const volunteers: RegionalVolunteer[] = [...new Set([...eventHours.keys(), ...activityHours.keys()])]
    .map((id) => ({ memberId: id, name: memberName.get(id) ?? `Member ${id}`, councilId: memberCouncil.get(id)!, hours: cents((eventHours.get(id) ?? 0) + (activityHours.get(id) ?? 0)) }))
    .filter((v) => v.hours > 0)
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name) || a.memberId - b.memberId);

  return {
    desk,
    fraternalYear,
    councilIds: [...ids].sort((a, b) => a - b),
    totals: {
      councils: summaries.length,
      volunteerHours: cents(summaries.reduce((s, c) => s + c.totalHours, 0)),
      grossBalance: cents(summaries.reduce((s, c) => s + c.cashBalance, 0)),
      assetCount: assets.length,
      assetValue: cents(assets.reduce((s, a) => s + a.costBasis, 0)),
    },
    councils: summaries,
    affiliations,
    grants,
    calendar,
    assets,
    goals,
    volunteers,
  };
}

/** The leaderboard: the region's top 10, or with `councilId` the top 5 of that council. */
export function topVolunteers(volunteers: readonly RegionalVolunteer[], councilId: number | null = null): RegionalVolunteer[] {
  return councilId === null
    ? volunteers.slice(0, REGIONAL_LEADERBOARD_SIZE)
    : volunteers.filter((v) => v.councilId === councilId).slice(0, COUNCIL_LEADERBOARD_SIZE);
}

/** The calendar with the multi-select council filter applied; an empty selection shows everything. */
export const filterRegionalCalendar = (items: readonly RegionalCalendarItem[], councilIds: readonly number[]): RegionalCalendarItem[] =>
  councilIds.length === 0 ? [...items] : items.filter((i) => i.councilIds.some((id) => councilIds.includes(id)));
