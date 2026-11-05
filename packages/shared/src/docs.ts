// =========================================================================
// DOCS-AS-CODE (Sprint 6Z)
// The SOP Center (/answers/sop) renders the markdown files of docs/sop/ - one standard operating procedure per file -
// and the Council Bylaws Data Vault previews the council's bylaws with the same reader. parseMarkdown turns light
// markdown into plain blocks the portal draws as React elements, never as raw HTML, so a document cannot inject markup.
//
// Supported: '#'-'######' headings, paragraphs, '-'/'*' and '1.' lists ('- [ ]' checklist items keep their box),
// '>' quotes, '|' tables, fenced code, '---' rules, https images, and inline **bold**, *italic*, `code` and
// [links](https://...). HTML comments - the <!-- KEEP_IMAGE --> guards of the technical-writer skill - are dropped.
// =========================================================================

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'code'; text: string }
  | { kind: 'image'; alt: string; src: string }
  | { kind: 'rule' };

const SAFE_URL = /^(https:\/\/|mailto:|\/(?!\/)|#)/i;

/** True for a link or image target the portal may follow: https, mailto, a site path or an in-page anchor. */
export const isSafeDocUrl = (url: string): boolean => SAFE_URL.test(url.trim());

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*|_([^_]+)_/g;

/** Splits one line of markdown into styled segments. A link to an unsafe target stays plain text. */
export function parseInline(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'code', text: m[2] });
    else if (m[3] !== undefined) out.push(isSafeDocUrl(m[4]) ? { kind: 'link', text: m[3], href: m[4] } : { kind: 'text', text: m[3] });
    else out.push({ kind: 'italic', text: m[5] ?? m[6] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

const tableCells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;

/** Splits markdown into blocks in document order. */
export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') {
      i += 1;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      i += 1;
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed);
    if (image) {
      if (isSafeDocUrl(image[2])) blocks.push({ kind: 'image', alt: image[1], src: image[2] });
      else blocks.push({ kind: 'paragraph', text: `[Image: ${image[1] || image[2]}]` });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) body.push(lines[i++].trim().replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: body.join('\n') });
      continue;
    }
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = tableCells(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(tableCells(lines[i++]));
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = item[2] !== undefined;
      const items: string[] = [];
      while (i < lines.length) {
        const next = LIST_ITEM.exec(lines[i]);
        if (next && (next[2] !== undefined) === ordered) {
          items.push(next[3].trim());
          i += 1;
        } else if (lines[i].trim() !== '' && /^\s{2,}/.test(lines[i]) && items.length > 0) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
        } else break;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '' || /^(#{1,6}\s|```|>|\||!\[)/.test(t) || LIST_ITEM.test(lines[i])) break;
      body.push(t);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: body.join(' ') });
  }
  return blocks;
}

/** One document of a docs-as-code folder: its file name without '.md', its title and its markdown. */
export interface DocFile {
  slug: string;
  title: string;
  markdown: string;
}

/** A document's title: its first '# ' heading, else its file name in words. */
export function docTitle(slug: string, markdown: string): string {
  const h1 = /^#\s+(.+)$/m.exec(markdown.replace(/\r\n?/g, '\n'));
  if (h1) return h1[1].trim();
  return slug.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

// =========================================================================
// INTERACTIVE HELP DESK (Sprint 6A, Phase 4)
// /answers/help searches the task workflows of docs/MEMBER_USER_GUIDE.md. Every task there is a '### N.N Title' heading
// followed by the technical-writer skill's five parts - Goal, Start point, Steps, Expected result, Common problems - and
// an optional '> **Who can do this:**' line. parseGuideTasks lifts those parts out; searchGuideTasks ranks them against a
// member's keywords; phoneTarget reads the phone screen a task starts on, for the desk's mock phone view.
// =========================================================================

/** The five tabs of the phone app's bottom bar, left to right (MEMBER_USER_GUIDE.md section 1.3). */
export const PHONE_TABS = ['Home', 'Mtgs', 'Signup', 'Report', 'Collect'] as const;
export type PhoneTab = (typeof PHONE_TABS)[number];

/** One row of a task's Common problems table. */
export interface GuideProblem {
  problem: string;
  cause: string;
  fix: string;
}

/** One task workflow of the member user guide. Text keeps its inline markdown (**bold**, `code`) for parseInline. */
export interface GuideTask {
  /** The task number, e.g. '3.1'. */
  id: string;
  title: string;
  /** The '## ' chapter the task sits in, e.g. '3. Sign up for shifts'. */
  chapter: string;
  /** The 'Who can do this' line, or '' when the task has none. */
  who: string;
  goal: string;
  startPoint: string;
  steps: string[];
  expected: string;
  problems: GuideProblem[];
}

const TASK_HEADING = /^###\s+(\d+(?:\.\d+)+)\s+(.+)$/;
const PART = /^\*\*(Goal|Start point|Steps|Expected result|Common problems):\*\*\s*(.*)$/;
const STEP = /^\s*\d+[.)]\s+(.*)$/;

/** The task workflows of a user guide, in document order. A '###' heading without a **Goal:** line is not a task. */
export function parseGuideTasks(markdown: string): GuideTask[] {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n');
  const tasks: GuideTask[] = [];
  let chapter = '';
  let task: GuideTask | null = null;
  let part = '';
  const finish = () => {
    if (task && task.goal) tasks.push(task);
    task = null;
    part = '';
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s/.test(trimmed)) {
      finish();
      chapter = trimmed.replace(/^##\s+/, '');
      continue;
    }
    const heading = TASK_HEADING.exec(trimmed);
    if (heading) {
      finish();
      task = { id: heading[1], title: heading[2].trim(), chapter, who: '', goal: '', startPoint: '', steps: [], expected: '', problems: [] };
      continue;
    }
    if (/^###\s/.test(trimmed)) {
      finish();
      continue;
    }
    const t: GuideTask | null = task;
    if (!t) continue;
    // Sprint 9 Master Hardening Pass: the officer manuals write it '**Prerequisite (who can do this):**'.
    const who = /^>\s*\*\*(?:Who can do this|Prerequisite \(who can do this\)):\*\*\s*(.*)$/.exec(trimmed);
    if (who) {
      t.who = who[1].trim();
      continue;
    }
    const p = PART.exec(trimmed);
    if (p) {
      part = p[1];
      if (part === 'Goal') t.goal = p[2].trim();
      else if (part === 'Start point') t.startPoint = p[2].trim();
      else if (part === 'Expected result') t.expected = p[2].trim();
      continue;
    }
    if (part === 'Steps') {
      const step = STEP.exec(line);
      if (step) t.steps.push(step[1].trim());
      else if (/^\s{2,}\S/.test(line) && !/^\s*[-*+]\s/.test(line) && t.steps.length > 0) t.steps[t.steps.length - 1] += ` ${trimmed}`;
    } else if (part === 'Common problems' && trimmed.startsWith('|')) {
      const cells = tableCells(trimmed);
      const isRule = cells.every((c) => /^:?-{3,}:?$/.test(c));
      if (!isRule && cells[0] !== 'Problem' && cells.length >= 3) t.problems.push({ problem: cells[0], cause: cells[1], fix: cells[2] });
    } else if (part === 'Expected result' && trimmed !== '' && !trimmed.startsWith('!') && !trimmed.startsWith('|') && !/^-{3,}$/.test(trimmed)) {
      t.expected += ` ${trimmed}`;
    }
  }
  finish();
  return tasks;
}

/** Inline markdown reduced to its plain words: **bold**, `code` and [link](url) markers dropped. */
export const plainDocText = (text: string): string =>
  parseInline(text)
    .map((s) => s.text)
    .join('');

// ---- Sprint 11 Revision 19.5: the keyword TF-IDF ranker -------------------------------------------------------------
// The 'How do I...' searches (the Help Desk, each desk's manual search) rank task workflows by keyword weight, not by
// literal text. A query is normalized (normalizeSearchText), stripped of conversational filler (SEARCH_STOPWORDS) and
// cut to its operational tokens ('expense', 'report', 'submit'). Each token scores by how often it appears in a task
// section (term frequency), how rare it is across the manual (inverse document frequency) and how much that section
// weighs (GUIDE_SECTION_WEIGHTS: the title most, the steps least). A task that matches more tokens always ranks first.

/** Conversational filler that carries no task meaning: question words, pronouns, polite phrases and helper verbs. */
export const SEARCH_STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'about', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could', 'did', 'do',
  'does', 'doing', 'for', 'from', 'get', 'go', 'going', 'got', 'had', 'has', 'have', 'hello', 'help', 'hey', 'hi', 'how',
  'i', 'id', 'if', 'im', 'in', 'into', 'is', 'it', 'its', 'just', 'know', 'let', 'like', 'me', 'might', 'must', 'my',
  'need', 'needs', 'no', 'not', 'now', 'of', 'off', 'ok', 'okay', 'on', 'one', 'or', 'our', 'please', 'should', 'so',
  'some', 'someone', 'something', 'than', 'thank', 'thanks', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'to', 'trying', 'try', 'us', 'very', 'want', 'wanted', 'wants', 'was', 'way', 'we', 'were',
  'what', 'when', 'where', 'which', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your',
]);

/** How much a keyword found in each part of a task counts. */
export const GUIDE_SECTION_WEIGHTS = { title: 6, chapter: 3, goal: 3, startPoint: 2, body: 1 } as const;

const CP1252_BYTES: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b,
  'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99,
  'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

/** One pass of undoing UTF-8 text that was decoded as Windows-1252 ('â€”' -> '—'); the text unchanged when it is clean. */
function undoMojibakePass(text: string): string {
  if (!/[Â-ô][\u0080-¿Œ-™]/.test(text)) return text;
  // Each run of high Windows-1252 characters is repaired on its own, so a real 'é' elsewhere in the text is kept.
  return text.replace(/[\u0080-ÿŒ-™]+/g, (run) => {
    const bytes: number[] = [];
    for (const ch of run) {
      const code = ch.codePointAt(0)!;
      if (code < 0x100) bytes.push(code);
      else if (CP1252_BYTES[ch] !== undefined) bytes.push(CP1252_BYTES[ch]);
      else return run; // a real character outside Windows-1252: this run was not double-decoded
    }
    return decodeUtf8Strict(bytes) ?? run;
  });
}

/** Strict UTF-8 decoding without platform APIs (the phone app shares this file); null on any invalid sequence. */
function decodeUtf8Strict(bytes: readonly number[]): string | null {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]!;
    const len = b < 0x80 ? 1 : b >= 0xc2 && b <= 0xdf ? 2 : b >= 0xe0 && b <= 0xef ? 3 : b >= 0xf0 && b <= 0xf4 ? 4 : 0;
    if (len === 0 || i + len > bytes.length) return null;
    let code = len === 1 ? b : b & (0xff >> (len + 1));
    for (let k = 1; k < len; k += 1) {
      const c = bytes[i + k]!;
      if ((c & 0xc0) !== 0x80) return null;
      code = (code << 6) | (c & 0x3f);
    }
    if ((len === 3 && code < 0x800) || (len === 4 && (code < 0x10000 || code > 0x10ffff)) || (code >= 0xd800 && code <= 0xdfff)) return null;
    out += String.fromCodePoint(code);
    i += len;
  }
  return out;
}

/**
 * Search text in one canonical form: double-decoded characters repaired (up to three layers deep), Unicode compatibility
 * forms folded (NFKC), accents dropped ('Café' -> 'cafe'), curly quotes and dashes made plain, and lower case.
 */
export function normalizeSearchText(text: string): string {
  let out = text;
  for (let i = 0; i < 3; i += 1) {
    const next = undoMojibakePass(out);
    if (next === out) break;
    out = next;
  }
  return out
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/'/g, '')
    .toLowerCase();
}

/** The words of a text after normalization: runs of letters and digits. */
const searchWords = (text: string): string[] => normalizeSearchText(text).match(/[a-z0-9]+/g) ?? [];

/**
 * A light stem, so 'submitted', 'submitting' and 'submits' all reduce to 'submit' and 'expenses' to 'expens'. Words of
 * four letters or fewer are kept whole.
 */
export function stemSearchToken(word: string): string {
  if (word.length <= 4) return word;
  let w = word;
  if (w.endsWith('ies') && w.length > 5) w = `${w.slice(0, -3)}y`;
  else if (/(?:ing|ed)$/.test(w) && w.length > 5) {
    w = w.replace(/(?:ing|ed)$/, '');
    if (/([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1);
  } else if (w.endsWith('es') && w.length > 5) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

/** The keywords of a search: normalized words of two letters or more, without filler words such as 'how' or 'the'. */
export const guideSearchTerms = (query: string): string[] =>
  [...new Set(searchWords(query))].filter((w) => w.length >= 2 && !SEARCH_STOPWORDS.has(w));

/** Whether a document word answers a query token: it starts with the token ('activit') or shares its stem. */
const wordMatches = (word: string, term: string, termStem: string) => word.startsWith(term) || word.startsWith(termStem);

/**
 * The tasks that match a member's keywords, best match first, ranked by TF-IDF with section weights. A task that matches
 * more keywords always outranks one that matches fewer; within that, the weighted TF-IDF score decides, then document
 * order. A query with no keywords matches nothing.
 */
export function searchGuideTasks(tasks: readonly GuideTask[], query: string): GuideTask[] {
  const terms = guideSearchTerms(query);
  if (terms.length === 0) return [];
  const stems = terms.map(stemSearchToken);
  const sections = tasks.map((task) => {
    const out: [string[], number][] = [
      [searchWords(plainDocText(task.title)), GUIDE_SECTION_WEIGHTS.title],
      [searchWords(plainDocText(task.chapter)), GUIDE_SECTION_WEIGHTS.chapter],
      [searchWords(plainDocText(task.goal)), GUIDE_SECTION_WEIGHTS.goal],
      [searchWords(plainDocText(task.startPoint)), GUIDE_SECTION_WEIGHTS.startPoint],
      [
        searchWords(plainDocText([...task.steps, task.expected, ...task.problems.flatMap((p) => [p.problem, p.cause, p.fix])].join(' '))),
        GUIDE_SECTION_WEIGHTS.body,
      ],
    ];
    return out;
  });
  // Term frequency of each keyword in each section of each task.
  const counts = sections.map((fields) => terms.map((term, t) => fields.map(([ws]) => ws.filter((w) => wordMatches(w, term, stems[t])).length)));
  // Inverse document frequency: a keyword in few tasks counts for more than one in most of them.
  const n = tasks.length;
  const idf = terms.map((_, t) => {
    const df = counts.filter((perTerm) => perTerm[t].some((c) => c > 0)).length;
    return df === 0 ? 0 : Math.log(1 + n / df);
  });
  const scored = tasks.map((task, index) => {
    let matched = 0;
    let score = 0;
    terms.forEach((_, t) => {
      const perSection = counts[index][t];
      if (!perSection.some((c) => c > 0)) return;
      matched += 1;
      // Sublinear term frequency per section, weighted by the section, summed, times the keyword's rarity.
      const weighted = perSection.reduce((sum, c, s) => sum + (c > 0 ? (1 + Math.log(c)) * sections[index][s][1] : 0), 0);
      score += idf[t] * weighted;
    });
    return { task, index, matched, score };
  });
  return scored
    .filter((s) => s.matched > 0)
    .sort((a, b) => b.matched - a.matched || b.score - a.score || a.index - b.index)
    .map((s) => s.task);
}

/** The phone screen a task starts on: the bottom tab it opens (null for a header or sign-in screen) and the path in. */
export interface PhoneTarget {
  tab: PhoneTab | null;
  /** The screens after 'Phone app', in plain words, e.g. ['Report tab', 'Activities sub-tab']. */
  trail: string[];
}

/** The phone part of a task's start point, or null when the task starts in the web portal or outside the app. */
export function phoneTarget(startPoint: string): PhoneTarget | null {
  const plain = plainDocText(startPoint);
  const phone = /Phone app\s*→\s*(.*?)(?:\.\s*Web portal\b.*)?$/.exec(plain);
  if (!phone) return null;
  const trail = phone[1]
    .replace(/\.$/, '')
    .split('→')
    .map((s) => s.trim())
    .filter(Boolean);
  const first = trail[0] ?? '';
  const tab = PHONE_TABS.find((t) => first === t || first.startsWith(`${t} `)) ?? null;
  return { tab, trail };
}
