// =========================================================================
// ON-DEMAND CUSTOM USER GUIDES (Sprint 7H)
// The Council Wide Settings page prints either user guide for one council: the server route
// /api/council/compile-manual reads docs/ADMIN_USER_GUIDE.md or docs/MEMBER_USER_GUIDE.md, passes it through
// customizeManualMarkdown with the council's settings, and lays the result out with the guides' own ReportLab script
// (scripts/compile_all_manuals.py). The guides are written with the default numbers; the customized copy:
//   - opens with a notice naming the council and the print date, and a table of all its Council Wide Settings;
//   - shows the council's value beside the default in the Administrator guide's settings tables (section 16.3);
//   - swaps the default number for the council's own in the sentences listed in MANUAL_SETTING_PHRASES, each tied to
//     one setting. Other numbers (the 5-activity rule's name, worked examples) keep the default wording.
// Pure: the route loads the Markdown and runs the script.
// =========================================================================
import {
  COUNCIL_WIDE_SETTING_NAMES,
  COUNCIL_WIDE_SETTING_RULES,
  COUNCIL_WIDE_SETTING_DEFAULTS,
  cleanCouncilWideSettings,
  councilWideSettings,
  formatSettingValue,
  mayEditCouncilWideSettings,
  type CouncilWideSettingName,
  type CouncilWideSettings,
} from './council-settings';
import { BusinessRuleError, type MemberWriteActor } from './rules';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

/** The two guides a council can print. */
export const CUSTOM_MANUAL_KINDS = ['admin', 'member'] as const;
export type CustomManualKind = (typeof CUSTOM_MANUAL_KINDS)[number];

/** Each guide's Markdown source (repository-relative) and the download's file name. */
export const CUSTOM_MANUAL_SOURCES: Record<CustomManualKind, { source: string; title: string; fileStem: string }> = {
  admin: { source: 'docs/ADMIN_USER_GUIDE.md', title: 'Administrator User Guide', fileStem: 'Admin_User_Guide' },
  member: { source: 'docs/MEMBER_USER_GUIDE.md', title: 'Member User Guide', fileStem: 'Member_User_Guide' },
};

/** Longest CouncilName (VARCHAR(255)). */
const COUNCIL_NAME_MAX_LENGTH = 255;

export interface CustomManualPayload {
  guide: CustomManualKind;
  council: { id: number; number: number; name: string };
  settings: CouncilWideSettings;
}

/**
 * Checks what the settings page posts: { guide, council: { id, number, name }, settings }. Every Council Wide Setting
 * must be within its range (cleanCouncilWideSettings); a missing one takes its default. Rejects INVALID_INPUT.
 */
export function cleanCustomManualPayload(input: unknown): CustomManualPayload {
  if (input === null || typeof input !== 'object') throw invalid('Send the guide, the council and its settings.');
  const raw = input as Record<string, unknown>;
  if (!(CUSTOM_MANUAL_KINDS as readonly unknown[]).includes(raw.guide)) throw invalid(`Choose the guide: ${CUSTOM_MANUAL_KINDS.join(' or ')}.`);
  const c = raw.council as Record<string, unknown> | null | undefined;
  const id = c?.id;
  const number = c?.number;
  const name = typeof c?.name === 'string' ? c.name.trim() : '';
  if (!Number.isInteger(id) || (id as number) <= 0) throw invalid('Name the council by its id.');
  if (!Number.isInteger(number) || (number as number) <= 0) throw invalid('Give the council number.');
  if (name === '' || name.length > COUNCIL_NAME_MAX_LENGTH || /[\u0000-\u001f]/.test(name)) throw invalid('Give the council name (one line, at most 255 characters).');
  const settings = councilWideSettings(cleanCouncilWideSettings(raw.settings));
  return { guide: raw.guide as CustomManualKind, council: { id: id as number, number: number as number, name }, settings };
}

/** Who may print a council's custom guides: the audience of its Council Wide Settings page. */
export const mayCompileCustomManual = (actor: MemberWriteActor, councilId: number): boolean => mayEditCouncilWideSettings(actor, councilId);

/** A guide sentence that names one setting's default, and how it reads with the council's value. */
export interface ManualSettingPhrase {
  guide: CustomManualKind;
  setting: CouncilWideSettingName;
  /** The guide's text, exactly; every occurrence is replaced. */
  find: string;
  /** `value` is the formatted value ('30 days'), `n` the bare number ('30'). */
  replace: (value: string, n: string) => string;
}

export const MANUAL_SETTING_PHRASES: readonly ManualSettingPhrase[] = [
  // Administrator guide. Sprint 9 Master Hardening Pass: the pruned guide keeps only the data protection sentence; the
  // flagged-hours, inactivity-sweep and padding sentences moved with their chapters into the role manuals, which a
  // council does not print as a custom copy.
  { guide: 'admin', setting: 'volunteer_logging_window_days', find: 'The default is 90 days (section 16.3)', replace: (v) => `This council's window is ${v} (section 16.3)` },
  // Member guide
  { guide: 'member', setting: 'volunteer_logging_window_days', find: 'Dates up to 90 days before today', replace: (v) => `Dates up to ${v} before today` },
  { guide: 'member', setting: 'volunteer_logging_window_days', find: 'Shifts up to 90 days before today', replace: (v) => `Shifts up to ${v} before today` },
  { guide: 'member', setting: 'er_submission_window_days', find: 'From the event start to 30 days after the event ends', replace: (v) => `From the event start to ${v} after the event ends` },
  { guide: 'member', setting: 'volunteer_logging_window_days', find: 'inside the 90-day window', replace: (_v, n) => `inside the ${n}-day window` },
  {
    guide: 'member',
    setting: 'volunteer_logging_window_days',
    find: 'The numbers in the table are the defaults. Your council can change the 90 days and the 30 days.',
    replace: () => "The numbers in the table are this council's settings on the day this copy was printed.",
  },
  { guide: 'member', setting: 'reminder_delay_days', find: 'The first reminder goes out 5 days after the shift.', replace: (v) => `The first reminder goes out ${v} after the shift.` },
  { guide: 'member', setting: 'reminder_cadence_days', find: 'A new reminder goes out every 7 days.', replace: (v) => `A new reminder goes out every ${v}.` },
  { guide: 'member', setting: 'volunteer_logging_window_days', find: 'Reminders stop when the shift is more than 90 days old.', replace: (v) => `Reminders stop when the shift is more than ${v} old.` },
  {
    guide: 'member',
    setting: 'reminder_delay_days',
    find: 'The numbers are the defaults. Your council can change them.',
    replace: () => "The numbers are this council's settings on the day this copy was printed.",
  },
  { guide: 'member', setting: 'volunteer_logging_window_days', find: '(90 days by default)', replace: (v) => `(${v} in this council)` },
  { guide: 'member', setting: 'volunteer_logging_window_days', find: 'within 90 days', replace: (v) => `within ${v}` },
  { guide: 'member', setting: 'er_submission_window_days', find: 'the event ended more than 30 days ago', replace: (v) => `the event ended more than ${v} ago` },
  {
    guide: 'member',
    setting: 'er_submission_window_days',
    find: 'The window closes 30 days after the last day, by default. Your council can change the 30 days.',
    replace: (v) => `The window closes ${v} after the last day in this council.`,
  },
  { guide: 'member', setting: 'er_submission_window_days', find: 'More than 30 days (or your council\'s number)', replace: (v) => `More than ${v}` },
  { guide: 'member', setting: 'er_submission_window_days', find: 'The 30-day', replace: (_v, n) => `The ${n}-day` },
  { guide: 'member', setting: 'shift_signup_lock_hours', find: 'Wait until 2 hours before the first shift, by default.', replace: (v) => `Wait until ${v} before the first shift.` },
  {
    guide: 'member',
    setting: 'shift_signup_lock_hours',
    find: 'from 2 hours before the first shift (by default; your council sets the time)',
    replace: (v) => `from ${v} before the first shift`,
  },
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A Markdown table cell's text with its pipes escaped. */
const cell = (text: string) => text.replace(/\|/g, '\\|');

/** The notice and settings table the customized copy opens with. */
export function councilSettingsSummary(council: CustomManualPayload['council'], settings: CouncilWideSettings, printedOn: string): string {
  const rows = COUNCIL_WIDE_SETTING_NAMES.map((name) => {
    const rule = COUNCIL_WIDE_SETTING_RULES[name];
    return `| ${cell(rule.label)} | **${formatSettingValue(rule, settings[name])}** | ${formatSettingValue(rule, COUNCIL_WIDE_SETTING_DEFAULTS[name])} | ${rule.inUse ? 'Yes' : 'Not used yet'} |`;
  });
  return [
    `> **Printed for ${council.name} ${council.number} on ${printedOn}.** The numbers in this copy are the council's Council Wide Settings on that day. ` +
      'The Admins and officers can change them on **Council Wide Settings**; the portal always uses the current numbers.',
    '',
    `### ${council.name}: Council Wide Settings`,
    '',
    '| Setting | This council | Default | In use |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

/**
 * The guide's Markdown for one council (see the file header). The summary goes before the first '## ' heading (the
 * contents); a guide without one gets it after the title. `printedOn` is 'YYYY-MM-DD'.
 */
export function customizeManualMarkdown(
  guide: CustomManualKind,
  markdown: string,
  council: CustomManualPayload['council'],
  settings: CouncilWideSettings,
  printedOn: string,
): string {
  let out = markdown;
  for (const phrase of MANUAL_SETTING_PHRASES) {
    if (phrase.guide !== guide) continue;
    const rule = COUNCIL_WIDE_SETTING_RULES[phrase.setting];
    const value = settings[phrase.setting];
    out = out.split(phrase.find).join(phrase.replace(formatSettingValue(rule, value), value.toLocaleString('en-US')));
  }
  // The settings tables (Administrator guide 16.3): the council's value beside the default.
  for (const name of COUNCIL_WIDE_SETTING_NAMES) {
    const rule = COUNCIL_WIDE_SETTING_RULES[name];
    const row = new RegExp(`^(\\| \\*\\*${escapeRegExp(rule.label)}\\*\\* \\| )([^|\\n]+?)( \\|)`, 'gm');
    out = out.replace(row, (_m, head: string, def: string, tail: string) => `${head}${def} (this council: **${formatSettingValue(rule, settings[name])}**)${tail}`);
  }
  const summary = councilSettingsSummary(council, settings, printedOn);
  const contents = out.search(/^## /m);
  if (contents >= 0) return `${out.slice(0, contents)}${summary}\n${out.slice(contents)}`;
  const title = out.indexOf('\n');
  return title < 0 ? `${out}\n\n${summary}` : `${out.slice(0, title + 1)}\n${summary}\n${out.slice(title + 1)}`;
}

/** The download's file name, e.g. 'Admin_User_Guide_Council_15295.pdf'. */
export const customManualFileName = (guide: CustomManualKind, councilNumber: number): string =>
  `${CUSTOM_MANUAL_SOURCES[guide].fileStem}_Council_${councilNumber}.pdf`;
