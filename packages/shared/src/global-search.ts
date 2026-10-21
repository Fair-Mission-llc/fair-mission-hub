// Sprint 8P Stage 1: the portal header's global search bar. One input across the top header row finds the reader's own
// pages (the role-filtered sidebar, navigationGuide), the council's events and - for readers who may open the roster -
// its members, and always offers the two help archives (the Online Help Center at /help and the Interactive Help Desk
// at /answers/help) with the typed words carried over as ?q=. Ranking is plain keyword prefix matching, like
// searchGuideTasks: every word found outranks a higher score from fewer words.
// Sprint 8S Revision 7: the role-scoped search guard. Every query re-reads the reader's clearance mask (their
// portalAreas) and drops any restricted page - the general ledger and finance screens, the accounts-payable desks, the
// donation records and the council/platform configuration pages - the reader's own seat does not clear, even when a
// caller passes it in.

/** The header search input's placeholder and accessible name. */
export const GLOBAL_SEARCH_PLACEHOLDER = 'Search pages, events, members and help…';
export const GLOBAL_SEARCH_LABEL = 'Search the portal';
/** Below this many characters the dropdown stays closed. */
export const GLOBAL_SEARCH_MIN_CHARS = 2;
/** At most this many hits of each kind (the two help links are always added). */
export const GLOBAL_SEARCH_MAX_PER_KIND = 5;

export type GlobalSearchKind = 'Page' | 'Event' | 'Member' | 'Help';

export interface GlobalSearchHit {
  kind: GlobalSearchKind;
  label: string;
  detail: string;
  href: string;
}

export interface GlobalSearchPage {
  label: string;
  hint: string;
  href: string;
}
export interface GlobalSearchEvent {
  id: number;
  name: string;
  date: string;
  location: string;
}
export interface GlobalSearchMember {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: number | string;
}

export interface GlobalSearchSources {
  pages: readonly GlobalSearchPage[];
  events?: readonly GlobalSearchEvent[];
  members?: readonly GlobalSearchMember[];
  /** Where an event hit opens (the Event Planner for planners, else the calendar). */
  eventHref?: string;
  /** Where a member hit opens. Members are searched only when this is given. */
  memberHref?: string;
  /**
   * Sprint 8S Revision 7: the reader's clearance mask (portalAreas). When given, a page under
   * GLOBAL_SEARCH_RESTRICTED_PREFIXES shows only if the mask holds its own area.
   */
  areas?: ReadonlySet<string>;
}

/**
 * Sprint 8S Revision 7: the restricted pages - finance ledgers, accounts payable, donation records and the council and
 * platform configuration profiles. The annual budget (/budget) stays open to every member (Sprint 5Y-3 transparency).
 */
export const GLOBAL_SEARCH_RESTRICTED_PREFIXES: readonly string[] = [
  '/finance',
  '/expenses/audit',
  '/expenses/authorize',
  '/expenses/queue',
  '/expenses/disbursements',
  '/donations',
  '/supreme-sync',
  '/system-settings',
  '/lookups',
  '/council-lookups',
  '/councils',
  '/credentials-vault',
  '/feature-flags',
];

const pathOf = (href: string): string => href.split(/[?#]/)[0];

/** True for a page under one of the restricted prefixes. */
export function isRestrictedSearchPage(href: string): boolean {
  const path = pathOf(href);
  return GLOBAL_SEARCH_RESTRICTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** A page the reader's clearance mask lets search show: any open page, or a restricted page whose own area it holds. */
export function isSearchClearedPage(href: string, areas: ReadonlySet<string>): boolean {
  return !isRestrictedSearchPage(href) || areas.has(pathOf(href).replace(/^\//, ''));
}

/** The lower-case keywords of a query (letters and digits only). */
export const globalSearchTerms = (query: string): string[] => query.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** 0 when no term is found; otherwise found terms * 100 plus the weighted prefix matches. */
function rankFields(terms: readonly string[], fields: readonly [string, number][]): number {
  const words = fields.map(([text, weight]) => [text.toLowerCase().match(/[a-z0-9]+/g) ?? [], weight] as const);
  let matched = 0;
  let score = 0;
  for (const term of terms) {
    const best = Math.max(0, ...words.map(([ws, weight]) => (ws.some((w) => w.startsWith(term)) ? weight : 0)));
    if (best > 0) matched += 1;
    score += best;
  }
  return matched === 0 ? 0 : matched * 100 + score;
}

function topRanked<T>(items: readonly T[], terms: readonly string[], fields: (item: T) => [string, number][]): T[] {
  return items
    .map((item, index) => ({ item, index, rank: rankFields(terms, fields(item)) }))
    .filter((s) => s.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .slice(0, GLOBAL_SEARCH_MAX_PER_KIND)
    .map((s) => s.item);
}

/** The two help archive links for a query, each opening its page with the words already typed in. */
export function helpArchiveHits(query: string): GlobalSearchHit[] {
  const q = encodeURIComponent(query.trim());
  return [
    { kind: 'Help', label: `Search the Online Help Center for “${query.trim()}”`, detail: 'Answers from the user manuals', href: `/help?q=${q}` },
    { kind: 'Help', label: `Ask the Interactive Help Desk about “${query.trim()}”`, detail: 'Step-by-step task workflows', href: `/answers/help?q=${q}` },
  ];
}

/**
 * The header search's results for `query`: matching pages, events and members (each kind capped at
 * GLOBAL_SEARCH_MAX_PER_KIND), then the two help archive links. Empty below GLOBAL_SEARCH_MIN_CHARS characters.
 * With `areas`, restricted pages the mask does not clear never show (isSearchClearedPage).
 */
export function searchGlobal(query: string, sources: GlobalSearchSources): GlobalSearchHit[] {
  if (query.trim().length < GLOBAL_SEARCH_MIN_CHARS) return [];
  const terms = globalSearchTerms(query);
  if (terms.length === 0) return [];
  const { areas } = sources;
  const cleared = areas ? sources.pages.filter((p) => isSearchClearedPage(p.href, areas)) : sources.pages;
  const pages = topRanked(cleared, terms, (p) => [
    [p.label, 3],
    [p.hint, 1],
  ]).map<GlobalSearchHit>((p) => ({ kind: 'Page', label: p.label, detail: p.hint, href: p.href }));
  const events = topRanked(sources.events ?? [], terms, (e) => [
    [e.name, 3],
    [e.location, 1],
  ]).map<GlobalSearchHit>((e) => ({
    kind: 'Event',
    label: e.name,
    detail: [e.date.slice(0, 10), e.location].filter(Boolean).join(' · '),
    href: sources.eventHref ?? '/calendar',
  }));
  const members = sources.memberHref
    ? topRanked(sources.members ?? [], terms, (m) => [
        [`${m.firstName} ${m.lastName}`, 3],
        [String(m.memberNumber), 2],
      ]).map<GlobalSearchHit>((m) => ({
        kind: 'Member',
        label: `${m.firstName} ${m.lastName}`.trim(),
        detail: `Member #${m.memberNumber}`,
        href: sources.memberHref as string,
      }))
    : [];
  return [...pages, ...events, ...members, ...helpArchiveHits(query)];
}
