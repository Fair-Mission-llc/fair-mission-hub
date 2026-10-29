// =========================================================================
// FORM 1728 EVENT INTERROGATION (Sprint 11 Revision 9.0)
// Reads the title of a saved Event or Ongoing Activity and files it under a line of Supreme's Form 1728 (Annual
// Survey of Fraternal Activity), behind the scenes. Nothing is stored: schema 107 has no column for the line, so the
// line is worked out again every time a screen or report needs it, and renaming a record refiles it.
//
// The engine runs on the device or server with no outside service. It is an intent classifier, not a keyword
// lookup: each line has weighted cues (whole phrases weigh more than single words), the title is normalized (case,
// punctuation, simple plurals and verb endings) before matching, the description counts at half weight, and the line
// with the highest score wins once it clears CONFIDENCE_THRESHOLD. A vague title files to Community line N,
// Miscellaneous Community Activities.
// =========================================================================

export type Form1728Section = 'Faith' | 'Family' | 'Community' | 'Life';

export interface Form1728Line {
  /** Stable key, `<SECTION>_<LETTER>`. */
  code: string;
  section: Form1728Section;
  /** The line letter within its section. */
  line: string;
  label: string;
}

/** The lines the engine files to, in report order. */
export const FORM_1728_LINES = [
  { code: 'COMMUNITY_A', section: 'Community', line: 'A', label: 'Coats for Kids' },
  { code: 'COMMUNITY_B', section: 'Community', line: 'B', label: 'Global Wheelchair Mission' },
  { code: 'COMMUNITY_C', section: 'Community', line: 'C', label: 'Habitat for Humanity' },
  { code: 'COMMUNITY_M', section: 'Community', line: 'M', label: 'Veteran & Military Support' },
  { code: 'COMMUNITY_N', section: 'Community', line: 'N', label: 'Miscellaneous Community Activities' },
  { code: 'LIFE_C', section: 'Life', line: 'C', label: 'Special Olympics' },
] as const satisfies readonly Form1728Line[];

export type Form1728LineCode = (typeof FORM_1728_LINES)[number]['code'];

/** Where a vague record goes. */
export const FORM_1728_DEFAULT_LINE: Form1728LineCode = 'COMMUNITY_N';
/** The lowest score that files a record to a named line instead of the default. */
export const CONFIDENCE_THRESHOLD = 2;
/** How much the description counts against the title. */
const DESCRIPTION_WEIGHT = 0.5;

/** Cues per line: normalized phrases (see normalize) and their weight. */
const INTENT_CUES: Record<Exclude<Form1728LineCode, 'COMMUNITY_N'>, readonly (readonly [string, number])[]> = {
  COMMUNITY_A: [
    ['coat for kid', 4],
    ['coat drive', 3],
    ['winter coat', 3],
    ['coat', 2],
    ['jacket', 1.5],
    ['outerwear', 1.5],
    ['kid', 0.5],
    ['child', 0.5],
  ],
  COMMUNITY_B: [
    ['global wheelchair mission', 5],
    ['wheelchair', 4],
    ['mobility', 1],
  ],
  COMMUNITY_C: [
    ['habitat for humanity', 5],
    ['habitat', 3],
    ['home build', 2.5],
    ['house build', 2.5],
    ['build day', 2],
    ['build site', 2],
    ['construction', 1],
  ],
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
  LIFE_C: [
    ['special olympic', 5],
    ['special need', 2.5],
    ['intellectual disability', 2.5],
    ['unified sport', 2],
  ],
};

const LINE_BY_CODE = new Map<string, Form1728Line>(FORM_1728_LINES.map((l) => [l.code, l]));

/** The line with this code. */
export function form1728Line(code: Form1728LineCode): Form1728Line {
  return LINE_BY_CODE.get(code)!;
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

/** Lower case, letters and digits only, each word stripped of a simple plural or verb ending. */
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
const ING_VERBS = new Set(['build', 'deploy', 'honor']);

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ing') && ING_VERBS.has(word.slice(0, -3))) return word.slice(0, -3);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Each cue counts once, on whole words, so 'coat' does not match 'coating'. */
function scoreText(text: string, weight: number, into: Map<string, { score: number; cues: Map<string, number> }>): void {
  const normalized = normalize(text);
  if (normalized.trim() === '') return;
  for (const [code, cues] of Object.entries(INTENT_CUES)) {
    for (const [cue, cueWeight] of cues) {
      const stemmed = normalize(cue).trim();
      if (!normalized.includes(` ${stemmed} `)) continue;
      const entry = into.get(code) ?? { score: 0, cues: new Map<string, number>() };
      entry.score += cueWeight * weight;
      entry.cues.set(cue, Math.max(entry.cues.get(cue) ?? 0, cueWeight * weight));
      into.set(code, entry);
    }
  }
}

/**
 * Files a record to its Form 1728 line from its title (and, at half weight, its description). The highest score wins;
 * ties go to the line listed first. Below CONFIDENCE_THRESHOLD the record files to Community line N.
 */
export function classifyForm1728(title: string, description?: string | null): Form1728Classification {
  const scores = new Map<string, { score: number; cues: Map<string, number> }>();
  scoreText(title ?? '', 1, scores);
  if (description) scoreText(description, DESCRIPTION_WEIGHT, scores);
  let best: { code: Form1728LineCode; score: number; cues: Map<string, number> } | null = null;
  for (const line of FORM_1728_LINES) {
    const entry = scores.get(line.code);
    if (entry && (best === null || entry.score > best.score)) best = { code: line.code, ...entry };
  }
  if (best === null || best.score < CONFIDENCE_THRESHOLD) {
    return { ...form1728Line(FORM_1728_DEFAULT_LINE), code: FORM_1728_DEFAULT_LINE, score: best?.score ?? 0, confidence: 'default', cues: [] };
  }
  const cues = [...best.cues].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([cue]) => cue);
  return {
    ...form1728Line(best.code),
    code: best.code,
    score: Math.round(best.score * 100) / 100,
    confidence: best.score >= 2 * CONFIDENCE_THRESHOLD ? 'strong' : 'likely',
    cues,
  };
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
    const key = `${row.title}\u0000${row.description ?? ''}`;
    let code = classified.get(key);
    if (code === undefined) {
      code = classifyForm1728(row.title, row.description).code;
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
