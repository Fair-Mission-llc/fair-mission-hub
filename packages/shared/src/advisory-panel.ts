// =========================================================================
// THE APPLICATION ADVISORY PANEL (Sprint 10 Revision 3.1, schema version 101)
//
// A top-level workspace ('🔊 Application Advisory Panel', /advisory-panel) for the people who advise on the platform:
// members of any council whom a Super Admin designates by giving them the 'Application Advisory Panelist' role, plus
// every Super Admin. Four views:
//   - Development Roadmap       where the platform is heading (ADVISORY_ROADMAP);
//   - Future Feature Releases   what is planned, in testing or released, for the panel to review (ADVISORY_RELEASES);
//   - Panel Meeting Dates       the panel's meetings (AdvisoryPanelMeetings), kept by Super Admins;
//   - Consultation Feedback     one text row per note a panelist sends (AdvisoryFeedback), which the whole panel reads.
// The roadmap and release lists are kept here, in code, by the development team; meetings and feedback are data.
// The drivers check every read and write (assertMayReadAdvisoryPanel, assertMayKeepAdvisoryPanel).
// =========================================================================
import { assertIsoDate, assertText, BusinessRuleError, describeActor, hasSuperAdminRights, optionalText, SecurityPrivilegeError, type MemberWriteActor } from './rules';

export const ADVISORY_PANEL_TITLE = '🔊 Application Advisory Panel';
export const ADVISORY_PANEL_HREF = '/advisory-panel';
/** The Role row that makes a member a panelist (Seed.sql). */
export const ADVISORY_PANELIST_ROLE = 'Application Advisory Panelist';

export const ADVISORY_PANEL_VIEWS = [
  { id: 'roadmap', label: 'Development Roadmap' },
  { id: 'releases', label: 'Future Feature Releases' },
  { id: 'meetings', label: 'Panel Meeting Dates' },
  { id: 'feedback', label: 'Consultation Feedback' },
] as const;
export type AdvisoryPanelViewId = (typeof ADVISORY_PANEL_VIEWS)[number]['id'];

export interface AdvisoryRoadmapItem {
  phase: string;
  title: string;
  summary: string;
  status: 'Done' | 'In progress' | 'Planned';
}

/** Where the platform is heading. Edited here by the development team. */
export const ADVISORY_ROADMAP: readonly AdvisoryRoadmapItem[] = [
  { phase: 'Pilot', title: 'Conference room pilot at St. Mary’s Cathedral', summary: 'Seated pilot runways for every officer desk on one shared hub laptop.', status: 'Done' },
  { phase: 'Pilot', title: 'Multi-tenant isolation', summary: 'Each council’s keys, files and account owners kept apart on the server, not only on screen.', status: 'In progress' },
  { phase: 'Rollout', title: 'Council network file servers', summary: 'Councils that keep files on their own hall server instead of Google Drive.', status: 'In progress' },
  { phase: 'Rollout', title: 'Second council onboarding', summary: 'A neighboring council joins through the access request queue with its own settings.', status: 'Planned' },
  { phase: 'Rollout', title: 'Phone app store release', summary: 'The phone app published to the app stores instead of Expo Go.', status: 'Planned' },
  { phase: 'Growth', title: 'Live Google Drive vault for every council', summary: 'Every council’s uploads filed in its own shared drive once each council connects one.', status: 'Planned' },
];

export interface AdvisoryReleaseItem {
  id: string;
  title: string;
  target: string;
  status: 'Released' | 'In testing' | 'Planned';
  notes: string;
}

/** What is coming, for the panel to review before release. Edited here by the development team. */
export const ADVISORY_RELEASES: readonly AdvisoryReleaseItem[] = [
  { id: 'account-owners', title: 'Account Owners Matrix', target: 'Sprint 10', status: 'Released', notes: 'Who to call about each electronic account, kept per council.' },
  { id: 'network-files', title: 'Local Network Server file repository', target: 'Sprint 10', status: 'In testing', notes: 'Uploads written to a council file server through the portal server.' },
  { id: 'view-as-member', title: 'View As Member for council Admins', target: 'Sprint 10', status: 'Released', notes: 'A read-only picture of what one member sees, inside the Admin’s own council.' },
  { id: 'advisory-panel', title: 'Application Advisory Panel', target: 'Sprint 10', status: 'In testing', notes: 'This workspace: roadmap, releases, meeting dates and feedback.' },
  { id: 'phone-hub-photos', title: 'Hub upload for every phone photo type', target: 'Next', status: 'Planned', notes: 'Receipts and gallery photos sent to the hub like check photos already are.' },
];

export interface AdvisoryPanelMeeting {
  id: number;
  meeting_date: string;
  title: string;
  location: string | null;
  agenda: string | null;
  created_by_member_id: number;
}

export interface AdvisoryPanelMeetingInput {
  id?: number | null;
  meeting_date: string;
  title: string;
  location?: string | null;
  agenda?: string | null;
}

export interface AdvisoryFeedback {
  id: number;
  member_id: number;
  council_id: number;
  topic: string;
  body: string;
  submitted_at: string;
}

/** A feedback row as the panel reads it: the sender's name and council. */
export interface AdvisoryFeedbackDetail extends AdvisoryFeedback {
  memberName: string;
  councilLabel: string;
}

export interface AdvisoryFeedbackInput {
  topic: string;
  body: string;
}

/** A panelist as the Super Admin's designation list shows it. */
export interface AdvisoryPanelist {
  memberId: number;
  name: string;
  councilLabel: string;
}

export const ADVISORY_TOPIC_MAX_LENGTH = 100;
export const ADVISORY_BODY_MAX_LENGTH = 2000;

/** Whether `u` opens the panel: a Super Admin, or a holder of the panelist role. */
export const canOpenAdvisoryPanel = (u: { memberType?: string | null; roles?: readonly string[] }): boolean =>
  u.memberType === 'Super Admin' || (u.roles ?? []).includes(ADVISORY_PANELIST_ROLE);

export const isAdvisoryPanelist = (actor: Pick<MemberWriteActor, 'roles'>): boolean => (actor.roles ?? []).includes(ADVISORY_PANELIST_ROLE);

/** Reading the panel and sending feedback: an Active panelist or an Active Super Admin (ADVISORY_PANEL_REQUIRED wording). */
export function assertMayReadAdvisoryPanel(actor: MemberWriteActor): void {
  if (hasSuperAdminRights(actor) || (actor.active && isAdvisoryPanelist(actor))) return;
  throw new SecurityPrivilegeError('ADMIN_REQUIRED', `Only Application Advisory Panelists and Super Admins open the Advisory Panel; you are ${describeActor(actor)}.`, {
    memberId: actor.memberId,
  });
}

/** Keeping the meeting dates and designating panelists: an Active Super Admin. */
export function assertMayKeepAdvisoryPanel(actor: MemberWriteActor): void {
  if (hasSuperAdminRights(actor)) return;
  throw new SecurityPrivilegeError('SUPER_ADMIN_REQUIRED', `Only a Super Admin keeps the Advisory Panel's meetings and panelists; you are ${describeActor(actor)}.`, {
    memberId: actor.memberId,
  });
}

export function cleanAdvisoryMeeting(input: AdvisoryPanelMeetingInput): Omit<AdvisoryPanelMeeting, 'id' | 'created_by_member_id'> {
  if (input === null || typeof input !== 'object') throw new BusinessRuleError('INVALID_INPUT', 'Send the meeting as an object.', {});
  return {
    meeting_date: assertIsoDate(input.meeting_date, 'Meeting date'),
    title: assertText(input.title, 'Meeting title', 200),
    location: optionalText(input.location, 'Location', 200),
    agenda: optionalText(input.agenda, 'Agenda', 1000),
  };
}

export function cleanAdvisoryFeedback(input: AdvisoryFeedbackInput): AdvisoryFeedbackInput {
  if (input === null || typeof input !== 'object') throw new BusinessRuleError('INVALID_INPUT', 'Send the feedback as an object.', {});
  return { topic: assertText(input.topic, 'Topic', ADVISORY_TOPIC_MAX_LENGTH), body: assertText(input.body, 'Feedback', ADVISORY_BODY_MAX_LENGTH) };
}
