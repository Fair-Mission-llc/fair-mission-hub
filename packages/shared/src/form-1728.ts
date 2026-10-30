// =========================================================================
// FORM 1728 EVENT INTERROGATION (Sprint 11 Revision 9.0, widened in Revision 10.0)
// Reads the title of a saved Event or Ongoing Activity and files it under a line of Supreme's Form 1728 (Annual
// Survey of Fraternal Activity).
//
// The engine runs on the device or server with no outside service. It is an intent classifier, not a keyword
// lookup: each line has weighted cues (whole phrases weigh more than single words), the title is normalized (case,
// punctuation, simple plurals and a few verb endings) before matching, the description counts at half weight, and the
// line with the highest score wins once it clears CONFIDENCE_THRESHOLD. A vague title files to Community line N,
// Miscellaneous Community Activities.
//
// Revision 10.0 ("double engine"): the catalog covers all four sections (Faith A-G, Family A-F, Community A-N, Life
// A-G). A second engine reads the Local Category's Supreme Mission Area and nudges lines in that section
// (SECTION_PRIOR_WEIGHT), and suggestForm1728Lines ranks the alternatives the event form's suggestion popup offers.
// An event stores the officer's confirmed choice in Event.form_1728_line (schema 108); resolveForm1728Line prefers
// that stored choice and falls back to the engine. Activities have no column, so they are always read from the title.
// =========================================================================
import { BusinessRuleError } from './rules';

export type Form1728Section = 'Faith' | 'Family' | 'Community' | 'Life';

export interface Form1728Line {
  /** Stable key, `<SECTION>_<LETTER>`. */
  code: string;
  section: Form1728Section;
  /** The line letter within its section. */
  line: string;
  label: string;
}

/**
 * Every line the engine files to, in report order: Faith A-G, Family A-F, Community A-N and Life A-G (Revision 10.0).
 * Community A, B, C, M and N and Life C are the lines the user named in Revision 9.0; the other labels are the order's
 * Faith in Action programs as I placed them and should be checked against the current printed Form 1728.
 */
export const FORM_1728_LINES = [
  { code: 'FAITH_A', section: 'Faith', line: 'A', label: 'Into the Breach' },
  { code: 'FAITH_B', section: 'Faith', line: 'B', label: 'Holy Hour & Eucharistic Adoration' },
  { code: 'FAITH_C', section: 'Faith', line: 'C', label: 'Rosary Program' },
  { code: 'FAITH_D', section: 'Faith', line: 'D', label: 'Sacramental Gifts' },
  { code: 'FAITH_E', section: 'Faith', line: 'E', label: 'Retreats & Faith Formation' },
  { code: 'FAITH_F', section: 'Faith', line: 'F', label: 'Vocations Support' },
  { code: 'FAITH_G', section: 'Faith', line: 'G', label: 'Keep Christ in Christmas' },
  { code: 'FAMILY_A', section: 'Family', line: 'A', label: 'Food for Families' },
  { code: 'FAMILY_B', section: 'Family', line: 'B', label: 'Family Fully Alive' },
  { code: 'FAMILY_C', section: 'Family', line: 'C', label: 'Family of the Month & Year' },
  { code: 'FAMILY_D', section: 'Family', line: 'D', label: 'Consecration to the Holy Family' },
  { code: 'FAMILY_E', section: 'Family', line: 'E', label: 'Family Week & Family Activities' },
  { code: 'FAMILY_F', section: 'Family', line: 'F', label: 'Good Friday Family Promotion' },
  { code: 'COMMUNITY_A', section: 'Community', line: 'A', label: 'Coats for Kids' },
  { code: 'COMMUNITY_B', section: 'Community', line: 'B', label: 'Global Wheelchair Mission' },
  { code: 'COMMUNITY_C', section: 'Community', line: 'C', label: 'Habitat for Humanity' },
  { code: 'COMMUNITY_D', section: 'Community', line: 'D', label: 'Disaster Preparedness & Relief' },
  { code: 'COMMUNITY_E', section: 'Community', line: 'E', label: 'Helping Hands' },
  { code: 'COMMUNITY_F', section: 'Community', line: 'F', label: 'Catholic Citizenship Essay Contest' },
  { code: 'COMMUNITY_G', section: 'Community', line: 'G', label: 'Free Throw Championship' },
  { code: 'COMMUNITY_H', section: 'Community', line: 'H', label: 'Soccer Challenge' },
  { code: 'COMMUNITY_I', section: 'Community', line: 'I', label: 'Blood Drives' },
  { code: 'COMMUNITY_J', section: 'Community', line: 'J', label: 'Environmental & Grounds Care' },
  { code: 'COMMUNITY_K', section: 'Community', line: 'K', label: 'Senior & Homebound Outreach' },
  { code: 'COMMUNITY_L', section: 'Community', line: 'L', label: 'Youth Programs & Scouting' },
  { code: 'COMMUNITY_M', section: 'Community', line: 'M', label: 'Veteran & Military Support' },
  { code: 'COMMUNITY_N', section: 'Community', line: 'N', label: 'Miscellaneous Community Activities' },
  { code: 'LIFE_A', section: 'Life', line: 'A', label: 'Ultrasound Initiative' },
  { code: 'LIFE_B', section: 'Life', line: 'B', label: 'March for Life & Pro-Life Witness' },
  { code: 'LIFE_C', section: 'Life', line: 'C', label: 'Special Olympics' },
  { code: 'LIFE_D', section: 'Life', line: 'D', label: 'Christian Refugee Relief' },
  { code: 'LIFE_E', section: 'Life', line: 'E', label: 'Mothers & Babies Support' },
  { code: 'LIFE_F', section: 'Life', line: 'F', label: 'Silver Rose' },
  { code: 'LIFE_G', section: 'Life', line: 'G', label: 'Prayer & Memorials for the Unborn' },
] as const satisfies readonly Form1728Line[];

export type Form1728LineCode = (typeof FORM_1728_LINES)[number]['code'];

/** The four sections in report order. */
export const FORM_1728_SECTIONS: readonly Form1728Section[] = ['Faith', 'Family', 'Community', 'Life'];

/** Where a vague record goes. */
export const FORM_1728_DEFAULT_LINE: Form1728LineCode = 'COMMUNITY_N';
/** The lowest score that files a record to a named line instead of the default. */
export const CONFIDENCE_THRESHOLD = 2;
/** How much the description counts against the title. */
const DESCRIPTION_WEIGHT = 0.5;
/**
 * The second engine: a line in the section the record's Local Category couples to (Category.SupremeMissionArea) gains
 * this much, but only once the title or description already scored for it. The category breaks ties and nudges a close
 * call; it never files a record on its own.
 */
export const SECTION_PRIOR_WEIGHT = 1;
/** Event.form_1728_line VARCHAR(20) (schema 108). */
export const FORM_1728_LINE_MAX_LENGTH = 20;

type Cues = readonly (readonly [string, number])[];

/** Cues per line: phrases (normalized like titles) and their weight. Community N has none: it is the default. */
const INTENT_CUES: Partial<Record<Form1728LineCode, Cues>> = {
  FAITH_A: [['into the breach', 5], ['mens faith', 3], ['catholic men', 2]],
  FAITH_B: [['holy hour', 5], ['adoration', 4], ['eucharistic', 3], ['benediction', 3]],
  FAITH_C: [['rosary', 4], ['marian', 2]],
  FAITH_D: [['sacramental gift', 5], ['first communion', 3], ['confirmation', 2.5], ['baptism', 2]],
  FAITH_E: [['retreat', 3], ['bible study', 4], ['faith formation', 3], ['refuel', 4], ['catechism', 2.5]],
  FAITH_F: [['vocation', 4], ['seminarian', 4], ['seminary', 3], ['rsvp program', 4], ['priesthood', 3]],
  FAITH_G: [['keep christ in christmas', 5], ['nativity', 3], ['christmas card', 2]],
  FAMILY_A: [['food for families', 5], ['food drive', 4], ['food pantry', 4], ['food bank', 4], ['thanksgiving basket', 4]],
  FAMILY_B: [['family fully alive', 5], ['family night', 3], ['family prayer', 3]],
  FAMILY_C: [['family of the month', 5], ['family of the year', 5]],
  FAMILY_D: [['holy family', 4], ['consecration', 3]],
  FAMILY_E: [['family week', 5], ['family picnic', 4], ['family day', 3], ['family fun', 3]],
  FAMILY_F: [['good friday', 4], ['stations of the cross', 4]],
  COMMUNITY_A: [['coat for kid', 4], ['coat drive', 3], ['winter coat', 3], ['coat', 2], ['jacket', 1.5], ['outerwear', 1.5], ['kid', 0.5], ['child', 0.5]],
  COMMUNITY_B: [['global wheelchair mission', 5], ['wheelchair', 4], ['mobility', 1]],
  COMMUNITY_C: [['habitat for humanity', 5], ['habitat', 3], ['home build', 2.5], ['house build', 2.5], ['build day', 2], ['build site', 2], ['construction', 1]],
  COMMUNITY_D: [['disaster', 4], ['hurricane', 4], ['wildfire', 4], ['flood', 3], ['emergency preparedness', 4], ['storm relief', 4]],
  COMMUNITY_E: [['helping hand', 5], ['yard work', 3], ['home repair', 3], ['handyman', 3]],
  COMMUNITY_F: [['essay contest', 5], ['essay', 3], ['citizenship', 3]],
  COMMUNITY_G: [['free throw', 5], ['basketball', 2]],
  COMMUNITY_H: [['soccer', 4]],
  COMMUNITY_I: [['blood drive', 5], ['blood', 3], ['red cross', 3]],
  COMMUNITY_J: [['cleanup', 3], ['clean up', 3], ['litter', 3], ['garbage', 3], ['grounds care', 4], ['highway', 2], ['tree planting', 4]],
  COMMUNITY_K: [['homebound', 4], ['nursing home', 4], ['elderly', 3], ['senior', 2], ['transport', 2]],
  COMMUNITY_L: [['youth', 3], ['scout', 4], ['squire', 4], ['cyo', 3]],
  COMMUNITY_M: [
    ['veteran', 4],
    ['military', 4],
    ['armed force', 4],
    ['troop', 3],
    ['soldier', 3],
    ['service member', 3],
    ['va hospital', 4],
    ['vfw', 3],
    ['american legion', 3],
    ['memorial day', 2.5],
    ['deployed', 2],
    ['wounded warrior', 4],
    ['honor guard', 2],
  ],
  LIFE_A: [['ultrasound', 5], ['pregnancy center', 4], ['pregnancy resource', 4]],
  LIFE_B: [['march for life', 5], ['pro life', 4], ['life chain', 4]],
  LIFE_C: [['special olympic', 5], ['special need', 2.5], ['intellectual disability', 2.5], ['unified sport', 2]],
  LIFE_D: [['refugee', 5], ['persecuted christian', 4]],
  LIFE_E: [['diaper', 4], ['baby shower', 3], ['expectant mother', 4], ['crib', 2], ['mother', 1.5]],
  LIFE_F: [['silver rose', 5]],
  LIFE_G: [['unborn', 5], ['novena for life', 5]],
};

const LINE_BY_CODE = new Map<string, Form1728Line>(FORM_1728_LINES.map((l) => [l.code, l]));

/** The line with this code. */
export function form1728Line(code: Form1728LineCode): Form1728Line {
  return LINE_BY_CODE.get(code)!;
}

/** Whether `value` names a line in the catalog. */
export function isForm1728LineCode(value: unknown): value is Form1728LineCode {
  return typeof value === 'string' && LINE_BY_CODE.has(value);
}

/** Event.form_1728_line as stored: a catalog code, or null to clear it. Anything else rejects INVALID_INPUT. */
export function cleanForm1728LineCode(value: unknown): Form1728LineCode | null {
  if (value === null) return null;
  const text = typeof value === 'string' ? value.trim().toUpperCase() : value;
  if (isForm1728LineCode(text)) return text;
  throw new BusinessRuleError('INVALID_INPUT', `Form 1728 line must be a line code such as COMMUNITY_N; received ${JSON.stringify(value)}.`, {
    field: 'form_1728_line',
  });
}

/** How the line was chosen: a clear match, a match that just cleared the bar, or the default for a vague record. */
export type Form1728Confidence = 'strong' | 'likely' | 'default';

export interface Form1728Classification extends Form1728Line {
  code: Form1728LineCode;
  score: number;
  confidence: Form1728Confidence;
  /** The cues that matched, strongest first. */
  cues: string[];
}

/** Lower case, letters and digits only, each word stripped of a simple plural or (for ING_VERBS) its '-ing'. */
function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map(stem)
    .join(' ')} `;
}

/** The verbs whose '-ing' form is stripped. Only these: a general rule would turn 'coating' into 'coat'. */
const ING_VERBS = new Set(['build', 'deploy', 'honor', 'transport']);

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ing') && ING_VERBS.has(word.slice(0, -3))) return word.slice(0, -3);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

type Entry = { score: number; cues: Map<string, number> };
type Scores = Map<string, Entry>;

/** Each cue counts once, on whole words, so 'coat' does not match 'coating'. */
function scoreText(text: string, weight: number, into: Scores): void {
  const normalized = normalize(text);
  if (normalized.trim() === '') return;
  for (const [code, cues] of Object.entries(INTENT_CUES) as [string, Cues][]) {
    for (const [cue, cueWeight] of cues) {
      if (!normalized.includes(` ${normalize(cue).trim()} `)) continue;
      const entry = into.get(code) ?? { score: 0, cues: new Map<string, number>() };
      entry.score += cueWeight * weight;
      entry.cues.set(cue, Math.max(entry.cues.get(cue) ?? 0, cueWeight * weight));
      into.set(code, entry);
    }
  }
}

/** The second engine's input: the Supreme Mission Area the record's Local Category couples to, if any. */
export interface Form1728Context {
  missionArea?: string | null;
}

function scoreRecord(title: string, description: string | null | undefined, context: Form1728Context | undefined): Scores {
  const scores: Scores = new Map();
  scoreText(title ?? '', 1, scores);
  if (description) scoreText(description, DESCRIPTION_WEIGHT, scores);
  const section = FORM_1728_SECTIONS.find((s) => s.toLowerCase() === (context?.missionArea ?? '').trim().toLowerCase());
  if (section) {
    for (const [code, entry] of scores) if (LINE_BY_CODE.get(code)?.section === section) entry.score += SECTION_PRIOR_WEIGHT;
  }
  return scores;
}

function toClassification(code: Form1728LineCode, entry: Entry | undefined): Form1728Classification {
  const score = Math.round((entry?.score ?? 0) * 100) / 100;
  if (code === FORM_1728_DEFAULT_LINE || !entry || entry.score < CONFIDENCE_THRESHOLD) {
    return { ...form1728Line(FORM_1728_DEFAULT_LINE), code: FORM_1728_DEFAULT_LINE, score, confidence: 'default', cues: [] };
  }
  const cues = [...entry.cues].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([cue]) => cue);
  return { ...form1728Line(code), code, score, confidence: entry.score >= 2 * CONFIDENCE_THRESHOLD ? 'strong' : 'likely', cues };
}

/** Lines that scored, best first; ties go to the line listed first (the sort is stable). */
function ranked(scores: Scores): { code: Form1728LineCode; entry: Entry }[] {
  return FORM_1728_LINES.filter((l) => scores.has(l.code))
    .map((l) => ({ code: l.code as Form1728LineCode, entry: scores.get(l.code)! }))
    .sort((a, b) => b.entry.score - a.entry.score);
}

/**
 * Files a record to its Form 1728 line from its title (and, at half weight, its description). The highest score wins;
 * ties go to the line listed first. Below CONFIDENCE_THRESHOLD the record files to Community line N. `context` feeds the
 * second engine (the Local Category's mission area).
 */
export function classifyForm1728(title: string, description?: string | null, context?: Form1728Context): Form1728Classification {
  const best = ranked(scoreRecord(title, description, context))[0];
  return best ? toClassification(best.code, best.entry) : toClassification(FORM_1728_DEFAULT_LINE, undefined);
}

/**
 * The suggestion popup's choices: the best guess first, then up to `limit - 1` other lines that cleared the bar, then
 * Community N if it is not already listed. Never empty.
 */
export function suggestForm1728Lines(title: string, description?: string | null, context?: Form1728Context, limit = 4): Form1728Classification[] {
  const out = ranked(scoreRecord(title, description, context))
    .filter((r) => r.entry.score >= CONFIDENCE_THRESHOLD)
    .slice(0, Math.max(1, limit - 1))
    .map((r) => toClassification(r.code, r.entry));
  if (!out.some((l) => l.code === FORM_1728_DEFAULT_LINE)) out.push(toClassification(FORM_1728_DEFAULT_LINE, undefined));
  return out;
}

/**
 * The line a record counts under: the officer's confirmed choice when one is stored (Event.form_1728_line), otherwise
 * the engine's reading of the title. `confirmed` says which.
 */
export function resolveForm1728Line(
  stored: string | null | undefined,
  title: string,
  description?: string | null,
  context?: Form1728Context,
): Form1728Line & { code: Form1728LineCode; confirmed: boolean } {
  if (isForm1728LineCode(stored)) return { ...form1728Line(stored), code: stored, confirmed: true };
  const guess = classifyForm1728(title, description, context);
  return { code: guess.code, section: guess.section, line: guess.line, label: guess.label, confirmed: false };
}

/**
 * The lines matching every word of `query` (case-insensitive), in report order. A one-letter word must be the line
 * letter ('community line n'); longer words may appear anywhere in the section, label or code.
 */
export function searchForm1728Lines(query: string): Form1728Line[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return FORM_1728_LINES.filter((l) => {
    const text = `${l.section} line ${l.label} ${l.code}`.toLowerCase();
    return words.every((w) => (w.length === 1 ? l.line.toLowerCase() === w : text.includes(w)));
  });
}

/** How screens name a line, e.g. 'Community line A - Coats for Kids'. */
export function form1728LineLabel(line: Pick<Form1728Line, 'section' | 'line' | 'label'>): string {
  return `${line.section} line ${line.line} - ${line.label}`;
}

/** One record's logged hours for the tally. */
export interface Form1728HoursRow {
  /** The Event or Activity title the line is read from. */
  title: string;
  description?: string | null;
  /** Revision 10.0: the confirmed line stored on the event, which wins over the title. */
  line?: string | null;
  date: string;
  hours: number;
  memberId: number;
}

export interface Form1728LineTotal extends Form1728Line {
  code: Form1728LineCode;
  hours: number;
  entries: number;
  volunteers: number;
  /** The record titles filed to the line, in name order. */
  records: string[];
}

const quarterHours = (hours: number) => Math.round(hours * 4) / 4;

/**
 * Hours per Form 1728 line for the rows dated between `fromDate` and `toDate` (YYYY-MM-DD, both inclusive). Only lines
 * with hours are returned, in FORM_1728_LINES order.
 */
export function tallyForm1728(rows: readonly Form1728HoursRow[], fromDate: string, toDate: string): Form1728LineTotal[] {
  const totals = new Map<string, { hours: number; entries: number; members: Set<number>; records: Set<string> }>();
  const classified = new Map<string, Form1728LineCode>();
  for (const row of rows) {
    if (row.date < fromDate || row.date > toDate) continue;
    const key = `${row.line ?? ''}\u0000${row.title}\u0000${row.description ?? ''}`;
    let code = classified.get(key);
    if (code === undefined) {
      code = resolveForm1728Line(row.line, row.title, row.description).code;
      classified.set(key, code);
    }
    const total = totals.get(code) ?? { hours: 0, entries: 0, members: new Set<number>(), records: new Set<string>() };
    total.hours += row.hours;
    total.entries += 1;
    total.members.add(row.memberId);
    total.records.add(row.title);
    totals.set(code, total);
  }
  return FORM_1728_LINES.filter((l) => totals.has(l.code)).map((l) => {
    const t = totals.get(l.code)!;
    return { ...l, hours: quarterHours(t.hours), entries: t.entries, volunteers: t.members.size, records: [...t.records].sort((a, b) => a.localeCompare(b)) };
  });
}

/** The calendar year to date on `now`: January 1 through today (local date), the span Form 1728 is filed for. */
export function form1728YearToDate(now: Date): { fromDate: string; toDate: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  return { fromDate: `${now.getFullYear()}-01-01`, toDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` };
}

/** Sprint 11 Revision 15.0: one section of the compiled report, with its lines and subtotals. */
export interface Form1728SectionTotal {
  section: Form1728Section;
  hours: number;
  entries: number;
  /** Distinct members with hours on any line of the section. */
  volunteers: number;
  /** The section's lines with hours (every line when the report keeps empty lines), in report order. */
  lines: Form1728LineTotal[];
}

/** Sprint 11 Revision 15.0: the print-ready Form 1728 report for a span, built from the synced time rows. */
export interface Form1728Report {
  fromDate: string;
  toDate: string;
  sections: Form1728SectionTotal[];
  totals: { hours: number; entries: number; volunteers: number; lines: number };
}

/**
 * Compiles the Form 1728 report for the rows dated `fromDate` to `toDate` (inclusive): lines grouped under Faith, Family,
 * Community and Life, each section with its hours, entries and distinct volunteers, and the grand totals. Hours are
 * rounded to the quarter hour, as tallyForm1728 rounds them. With `includeEmptyLines` every catalog line is listed, so
 * the printed sheet mirrors the paper form; otherwise only lines with hours appear.
 */
export function compileForm1728Report(
  rows: readonly Form1728HoursRow[],
  fromDate: string,
  toDate: string,
  options: { includeEmptyLines?: boolean } = {},
): Form1728Report {
  const tallied = new Map(tallyForm1728(rows, fromDate, toDate).map((l) => [l.code, l]));
  const sectionMembers = new Map<Form1728Section, Set<number>>(FORM_1728_SECTIONS.map((s) => [s, new Set<number>()]));
  const allMembers = new Set<number>();
  for (const row of rows) {
    if (row.date < fromDate || row.date > toDate) continue;
    const section = form1728Line(resolveForm1728Line(row.line, row.title, row.description).code).section;
    sectionMembers.get(section)!.add(row.memberId);
    allMembers.add(row.memberId);
  }
  const sections = FORM_1728_SECTIONS.map((section) => {
    const lines = FORM_1728_LINES.filter((l) => l.section === section)
      .map((l) => tallied.get(l.code) ?? (options.includeEmptyLines ? { ...l, hours: 0, entries: 0, volunteers: 0, records: [] } : null))
      .filter((l): l is Form1728LineTotal => l !== null);
    return {
      section,
      hours: quarterHours(lines.reduce((n, l) => n + l.hours, 0)),
      entries: lines.reduce((n, l) => n + l.entries, 0),
      volunteers: sectionMembers.get(section)!.size,
      lines,
    };
  });
  return {
    fromDate,
    toDate,
    sections,
    totals: {
      hours: quarterHours(sections.reduce((n, s) => n + s.hours, 0)),
      entries: sections.reduce((n, s) => n + s.entries, 0),
      volunteers: allMembers.size,
      lines: tallied.size,
    },
  };
}

/** A CSV cell: quoted when it holds a comma, quote or line break. */
const csvCell = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * The compiled report as CSV, one row per line plus a subtotal row per section and a grand total row, for the
 * one-click export beside the printed sheet.
 */
export function form1728ReportCsv(report: Form1728Report): string {
  const out: (string | number)[][] = [['Section', 'Line', 'Label', 'Records', 'Entries', 'Volunteers', 'Hours']];
  for (const s of report.sections) {
    for (const l of s.lines) out.push([s.section, l.line, l.label, l.records.join('; '), l.entries, l.volunteers, l.hours]);
    out.push([s.section, '', `${s.section} subtotal`, '', s.entries, s.volunteers, s.hours]);
  }
  out.push(['All', '', `Total ${report.fromDate} to ${report.toDate}`, '', report.totals.entries, report.totals.volunteers, report.totals.hours]);
  return `${out.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
