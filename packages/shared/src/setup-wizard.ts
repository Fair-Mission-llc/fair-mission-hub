// =========================================================================
// THE ADMIN DESK SETUP WIZARD (Sprint 11 Revision 4.1, schema 103, no table change)
//
// A five-step overlay that covers the Admin Desk until an Admin finishes it (or skips it). The steps, in order
// (SETUP_WIZARD_STEPS):
//   1. Supreme CSV Roster Ingestion        the Supreme roster uploader (supreme.syncSupremeRoster)
//   2. File Storage and Email Gateway      the file repository picker and the SMTP gateway; the SMTP password goes to
//                                          the server's Credentials Vault, for the Admin's home council only
//   3. Clone Founding Template             '⚡ Clone Founding Template' (councils.cloneFoundingTemplate): copies Council
//                                          15295's chart of accounts, council lookup rows and Council Wide Settings
//   4. Practice Sandbox                    'Activate Safe Practice Sandbox' (councils.seedPracticeSandbox): 10 practice
//                                          members and 3 practice fundraisers; the Admin Desk's toggle purges them
//   5. Quick-Start Guide                   the Quick-Start Intake Guide PDF, then the desk opens
//
// Practice records are marked without a new column: a practice member's email ends in PRACTICE_EMAIL_DOMAIN and a
// practice event's name starts with PRACTICE_EVENT_PREFIX. councils.purgePracticeSandbox removes exactly those rows and
// the rows that hang off them (signups, shifts, roles, logins).
//
// Who: the council's Active Admins and any Active Super Admin (assertMayMaintainCouncilRecords), like every other
// council-record write.
// =========================================================================
import type { NewEvent, SupremeRosterRow } from './contract';
import { COUNCIL_WIDE_SETTING_NAMES, type CouncilWideSettings } from './council-settings';
import { BusinessRuleError } from './rules';
import type { Activities, CouncilDonationMethod, DonationType, GLAccount } from './types';

export type SetupWizardStepId = 'roster' | 'storage-email' | 'founding-template' | 'practice-sandbox' | 'quick-start';

export interface SetupWizardStep {
  id: SetupWizardStepId;
  number: number;
  title: string;
  /** One sentence the wizard shows under the title. */
  prompt: string;
}

/** The wizard's five steps, in order. */
export const SETUP_WIZARD_STEPS: readonly SetupWizardStep[] = [
  { id: 'roster', number: 1, title: 'Supreme CSV Roster Ingestion', prompt: "Bring in your council's members from the Supreme roster export." },
  {
    id: 'storage-email',
    number: 2,
    title: 'File Storage and Email Gateway',
    prompt: 'Choose where council files are kept, and connect the mail server the portal sends from.',
  },
  {
    id: 'founding-template',
    number: 3,
    title: 'Clone Founding Template',
    prompt: "Copy Founding Council 15295's accounts, lookup tables and council settings in one click.",
  },
  { id: 'practice-sandbox', number: 4, title: 'Practice Sandbox', prompt: 'Add practice members and fundraisers to try every desk safely.' },
  { id: 'quick-start', number: 5, title: 'Quick-Start Guide', prompt: 'Download the Quick-Start Intake Guide, then open your Admin Desk.' },
];

export const SETUP_WIZARD_TITLE = 'Council Setup Wizard';
export const CLONE_FOUNDING_TEMPLATE_LABEL = '⚡ Clone Founding Template';
export const ACTIVATE_PRACTICE_SANDBOX_LABEL = 'Activate Safe Practice Sandbox';
export const PURGE_PRACTICE_SANDBOX_LABEL = 'Practice Sandbox';

/** The council whose setup every new council may copy. */
export const FOUNDING_COUNCIL_NUMBER = 15295;

/** The Quick-Start Intake Guide (docs/QUICK_START_INTAKE_GUIDE.md), served by /api/manuals/pdf?manual=quickstart. */
export const QUICK_START_GUIDE = {
  key: 'quickstart',
  token: 'QUICK_START_INTAKE_GUIDE',
  title: 'Quick-Start Intake Guide',
  markdown: 'QUICK_START_INTAKE_GUIDE.md',
  pdf: 'QUICK_START_INTAKE_GUIDE.pdf',
} as const;

/** The browser key that remembers a finished or skipped wizard for one council (a convenience only). */
export const setupWizardDoneKey = (councilId: number): string => `kofc.setupWizard.done.${councilId}`;

/**
 * Whether the wizard opens on its own: only for a council that looks unset - no accounts in its chart and no more than
 * one member (the Admin). The Admin Desk's 'Run Setup Wizard' button opens it at any time.
 */
export const councilLooksUnset = (counts: { accounts: number; members: number }): boolean => counts.accounts === 0 && counts.members <= 1;

// ---- the founding template -----------------------------------------------------------------------------------------

export interface FoundingTemplateSource {
  accounts: readonly GLAccount[];
  activities: readonly Activities[];
  donationTypes: readonly DonationType[];
  methods: readonly CouncilDonationMethod[];
  settings: Partial<CouncilWideSettings>;
}

/** The target council's rows, to skip anything it already holds (matched by name, case-insensitively). */
export interface FoundingTemplateTarget {
  accounts: readonly Pick<GLAccount, 'AccountName'>[];
  activities: readonly Pick<Activities, 'ActivityName'>[];
  donationTypes: readonly Pick<DonationType, 'DonationType'>[];
  methods: readonly Pick<CouncilDonationMethod, 'DonationMethodID'>[];
}

/** One account to add. `parentName` names its parent in the target chart (added first), or null. */
export interface PlannedAccount {
  AccountName: string;
  AccountType: GLAccount['AccountType'];
  parentName: string | null;
  IsVirtualGoal: number;
  TargetGoalAmount: number;
  account_display_name: string | null;
  ownership_type: NonNullable<GLAccount['ownership_type']>;
}

export interface FoundingTemplatePlan {
  /** Parents before children. */
  accounts: PlannedAccount[];
  activities: { ActivityName: string; ActivityDescription: string; CategoryID: number; lookup_status: 'Active' | 'Inactive' }[];
  donationTypes: { DonationType: string; lookup_status: 'Active' | 'Inactive' }[];
  /** `accountName` names the linked account in the target chart, or null. No QR image is copied. */
  methods: { DonationMethodID: number; accountName: string | null; account_owner_entity: NonNullable<CouncilDonationMethod['account_owner_entity']>; lookup_status: 'Active' | 'Inactive' }[];
  settings: Partial<CouncilWideSettings>;
}

/** What councils.cloneFoundingTemplate copied. */
export interface FoundingTemplateCloneResult {
  accounts: number;
  activities: number;
  donationTypes: number;
  paymentMethods: number;
  settings: number;
}

const key = (text: string) => text.trim().toLowerCase();

/**
 * What the clone adds to the target: every founding account, activity, donation type and payment method the target
 * does not hold yet, and the founding council's Council Wide Settings. Sister-council clearing accounts, split accounts
 * and virtual goal accounts are left out (they belong to the founding council's own arrangements and targets); so are QR
 * images and contacts.
 */
export function planFoundingTemplateClone(source: FoundingTemplateSource, target: FoundingTemplateTarget): FoundingTemplatePlan {
  const held = new Set(target.accounts.map((a) => key(a.AccountName)));
  const byId = new Map(source.accounts.map((a) => [a.id, a]));
  const copyable = source.accounts.filter((a) => a.due_to_council_id == null && !a.is_split_account && !a.IsVirtualGoal);
  const copyIds = new Set(copyable.map((a) => a.id));
  // Parents first: a stable walk by depth.
  const depth = (a: GLAccount): number => {
    let d = 0;
    let p = a.ParentAccountID == null ? undefined : byId.get(a.ParentAccountID);
    while (p && d < 20) {
      d += 1;
      p = p.ParentAccountID == null ? undefined : byId.get(p.ParentAccountID);
    }
    return d;
  };
  const accounts: PlannedAccount[] = [...copyable]
    .sort((a, b) => depth(a) - depth(b) || a.id - b.id)
    .filter((a) => !held.has(key(a.AccountName)))
    .map((a) => {
      const parent = a.ParentAccountID != null && copyIds.has(a.ParentAccountID) ? byId.get(a.ParentAccountID) : undefined;
      return {
        AccountName: a.AccountName,
        AccountType: a.AccountType,
        parentName: parent ? parent.AccountName : null,
        IsVirtualGoal: 0,
        TargetGoalAmount: 0,
        account_display_name: a.account_display_name ?? null,
        ownership_type: a.ownership_type ?? 'INTERNAL_OPERATING',
      };
    });

  const heldActivities = new Set(target.activities.map((a) => key(a.ActivityName)));
  const activities = source.activities
    .filter((a) => !heldActivities.has(key(a.ActivityName)))
    .map((a) => ({ ActivityName: a.ActivityName, ActivityDescription: a.ActivityDescription ?? '', CategoryID: a.CategoryID, lookup_status: a.lookup_status ?? 'Active' }));

  const heldTypes = new Set(target.donationTypes.map((t) => key(t.DonationType)));
  const donationTypes = source.donationTypes
    .filter((t) => !heldTypes.has(key(t.DonationType)))
    .map((t) => ({ DonationType: t.DonationType, lookup_status: t.lookup_status ?? 'Active' }));

  const heldMethods = new Set(target.methods.map((m) => m.DonationMethodID));
  const methods = source.methods
    .filter((m) => !heldMethods.has(m.DonationMethodID))
    .map((m) => {
      const account = m.account_id == null ? undefined : byId.get(m.account_id);
      const accountName = account && copyIds.has(account.id) ? account.AccountName : null;
      return {
        DonationMethodID: m.DonationMethodID,
        accountName,
        account_owner_entity: accountName ? (m.account_owner_entity ?? 'COUNCIL') : 'COUNCIL',
        lookup_status: m.lookup_status ?? 'Active',
      };
    });

  const settings: Partial<CouncilWideSettings> = {};
  for (const name of COUNCIL_WIDE_SETTING_NAMES) {
    const v = source.settings[name];
    if (typeof v === 'number' && Number.isFinite(v)) settings[name] = v;
  }
  return { accounts, activities, donationTypes, methods, settings };
}

/** Rejects cloning the founding council onto itself. */
export function assertNotFoundingCouncil(council: { CouncilNumber: number }): void {
  if (council.CouncilNumber === FOUNDING_COUNCIL_NUMBER) {
    throw new BusinessRuleError('INVALID_INPUT', `Council ${FOUNDING_COUNCIL_NUMBER} is the founding template; it cannot be cloned onto itself.`, {
      councilNumber: council.CouncilNumber,
    });
  }
}

// ---- the practice sandbox ------------------------------------------------------------------------------------------

/** Every practice member's email ends with this domain. */
export const PRACTICE_EMAIL_DOMAIN = 'practice.sandbox';
/** Every practice event's name starts with this. */
export const PRACTICE_EVENT_PREFIX = '[Practice] ';
export const PRACTICE_MEMBER_COUNT = 10;
export const PRACTICE_FUNDRAISER_COUNT = 3;
/** Practice member numbers start here (Supreme numbers stay far below). */
export const PRACTICE_MEMBER_NUMBER_BASE = 990_000_000;

export const isPracticeEmail = (email: unknown): boolean => typeof email === 'string' && email.toLowerCase().endsWith(`@${PRACTICE_EMAIL_DOMAIN}`);
export const isPracticeEventName = (name: unknown): boolean => typeof name === 'string' && name.startsWith(PRACTICE_EVENT_PREFIX);

/** What the practice sandbox holds for one council now. */
export interface PracticeSandboxStatus {
  members: number;
  events: number;
  active: boolean;
}

export const practiceSandboxStatus = (members: number, events: number): PracticeSandboxStatus => ({ members, events, active: members > 0 || events > 0 });

const PRACTICE_NAMES: readonly [string, string][] = [
  ['Peter', 'Practice'],
  ['Andrew', 'Sample'],
  ['James', 'Trialson'],
  ['John', 'Demoworth'],
  ['Philip', 'Mockley'],
  ['Thomas', 'Testwell'],
  ['Matthew', 'Rehearsal'],
  ['Simon', 'Drillman'],
  ['Jude', 'Sandbury'],
  ['Mark', 'Exampleton'],
];

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/** The ten practice members, as roster rows (the roster import's cleaner turns them into members). */
export function practiceRosterRows(councilId: number, state: string, today: Date): SupremeRosterRow[] {
  return PRACTICE_NAMES.slice(0, PRACTICE_MEMBER_COUNT).map(([first, last], i) => ({
    MemberNumber: PRACTICE_MEMBER_NUMBER_BASE + councilId * 100 + i + 1,
    MemberFirstName: first,
    MemberLastName: last,
    Email: `${first}.${last}.${councilId}@${PRACTICE_EMAIL_DOMAIN}`.toLowerCase(),
    Phone: `555-010${i}`,
    StreetAddress1: `${100 + i} Practice Lane`,
    City: 'Sandbox',
    State: state || 'OR',
    ZipCode: '00000',
    DateOfBirth: `${1960 + i * 3}-0${(i % 9) + 1}-15`,
    DegreeID: (i % 4) + 1,
    DateJoinedCouncil: isoDay(addDays(today, -30 * (i + 1))),
  }));
}

export interface PracticeFundraiser {
  event: Omit<NewEvent, 'OwnerID' | 'CategoryID'>;
  shift: { ShiftName: string; ShiftDescription: string; ShiftDate: string; StartTime: string; EndTime: string; MinNumberVolunteers: number };
  /** Indexes into the practice members who sign up for the shift. */
  volunteers: number[];
  /** Index of the practice member who owns the event. */
  owner: number;
}

/** The three practice fundraisers: 1, 2 and 3 weeks out, each with one shift and three practice volunteers. */
export function practiceFundraisers(today: Date): PracticeFundraiser[] {
  const plans: [string, string, string][] = [
    ['Pancake Breakfast', 'Practice pancake breakfast after Sunday Mass', 'Parish Hall'],
    ['Tootsie Roll Drive', 'Practice Tootsie Roll drive for people with intellectual disabilities', 'Church Entrance'],
    ['Fish Fry', 'Practice Lenten-style fish fry dinner', 'Parish Hall Kitchen'],
  ];
  return plans.slice(0, PRACTICE_FUNDRAISER_COUNT).map(([name, description, location], i) => {
    const day = isoDay(addDays(today, 7 * (i + 1)));
    return {
      event: { EventName: `${PRACTICE_EVENT_PREFIX}${name}`, EventDescription: description, StartDate: day, EndDate: day, Location: location },
      shift: { ShiftName: 'Practice Shift', ShiftDescription: 'Sign-up practice', ShiftDate: day, StartTime: '09:00:00', EndTime: '12:00:00', MinNumberVolunteers: 4 },
      volunteers: [i * 3, i * 3 + 1, i * 3 + 2],
      owner: i,
    };
  });
}

/** What councils.seedPracticeSandbox added. */
export interface PracticeSandboxSeedResult {
  members: number;
  events: number;
  signups: number;
}

/** What councils.purgePracticeSandbox removed. */
export interface PracticeSandboxPurgeResult {
  members: number;
  events: number;
}

/** Rejects a second seeding while practice records remain. */
export function assertPracticeSandboxEmpty(status: PracticeSandboxStatus): void {
  if (status.active) {
    throw new BusinessRuleError('INVALID_INPUT', 'The practice sandbox is already on. Purge it first to start over.', { ...status });
  }
}

/**
 * The rows that hang off practice members and events, removed with them. Each is [table, column, 'member' | 'event' |
 * 'shift']. Anything else that names a practice member (a donation, an expense) blocks the purge with RECORD_IN_USE.
 */
export const PRACTICE_DEPENDENT_ROWS: readonly [table: string, column: string, of: 'member' | 'event' | 'shift'][] = [
  ['EventSignup', 'ShiftID', 'shift'],
  ['EventTime', 'ShiftID', 'shift'],
  ['EventSignup', 'MemberID', 'member'],
  ['EventTime', 'MemberID', 'member'],
  ['ActivityTime', 'MemberID', 'member'],
  ['MemberRoles', 'MemberID', 'member'],
  ['DistributionListMembers', 'MemberID', 'member'],
  ['ReadReceipts', 'MemberID', 'member'],
  ['MeetingInvites', 'MemberID', 'member'],
  ['Shift', 'EventID', 'event'],
  ['LessonsLearned', 'EventID', 'event'],
  ['EventCouncils', 'EventID', 'event'],
];

/** Tables whose rows, naming a practice event, stop the purge (money must never vanish silently). */
export const PRACTICE_BLOCKING_EVENT_ROWS: readonly [table: string, column: string][] = [['Donation', 'EventID']];
