// =========================================================================
// THE GLOBAL OPERATIONS KNOWLEDGE VAULT (Sprint 8I, schema version 79)
//
// A council's long-term operating notes (CouncilOperationsKnowledge), so a new chairman inherits what the last one
// learned. Each entry is filed under one of six governance tags and carries an automatic signature stamp.
//   - Writing   the Oversight Desk's Global Operations Knowledge Vault card: the council's Active Admins, Grand Knight
//               and Deputy Grand Knight, and any Active Super Admin (assertMayWriteOperationsKnowledge). Entries are
//               append-only: there is no edit or delete, so the record a chair leaves stays as written.
//   - Reading   System Settings > Operations Knowledge Archive (/system-settings/knowledge-archive), read-only: every
//               Active officer and Admin of any council and any Active Super Admin (assertMayReadOperationsKnowledge),
//               filtered by tag, fraternal year (July 1 - June 30 of date_logged) and text (filterOperationsKnowledge).
//
// Sprint 8J (schema version 80) opens the archive across councils: the list returns every council's entries, each with
// origin_council_stamp ('Council <number> · <name>', written when the entry is saved) shown as a badge, and the archive's
// "Filter by My Home Council Only" toggle narrows it to the viewer's own council. Every save now passes the content guard
// (the diary's foul-language, hate and partisan-keyword patterns, KNOWLEDGE_CONTENT_BLOCKED) and the KofC Charter
// compliance gate (charter-compliance.ts, CHARTER_VIOLATION_BLOCKED for a SEVERE rule).
// =========================================================================
import { assertCharterCompliant } from './charter-compliance';
import type { SessionUser } from './contract';
import { findDiaryContentViolation, type DiaryContentCategory } from './history';
import { holdsGrandKnightSeat, isAdmin, isSuperAdmin } from './permissions';
import {
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  holdsGrandKnightAuthority,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { Council, CouncilOperationsKnowledge, OperationsKnowledgeCategory } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

/** The six governance tags, in the order the vault and the archive offer them. */
export const OPERATIONS_KNOWLEDGE_CATEGORIES: readonly OperationsKnowledgeCategory[] = ['RECRUITING', 'TREASURY', 'CLERGY', 'COMPLIANCE', 'DEVOTIONAL', 'LOGISTICS'];

export const OPERATIONS_KNOWLEDGE_CATEGORY_LABELS: Record<OperationsKnowledgeCategory, string> = {
  RECRUITING: 'Recruiting',
  TREASURY: 'Treasury',
  CLERGY: 'Clergy',
  COMPLIANCE: 'Compliance',
  DEVOTIONAL: 'Devotional',
  LOGISTICS: 'Logistics',
};

/** Longest CouncilOperationsKnowledge.entry_text. */
export const OPERATIONS_KNOWLEDGE_MAX_LENGTH = 8000;

/** The archive's page. */
export const KNOWLEDGE_ARCHIVE_HREF = '/system-settings/knowledge-archive';

export const isOperationsKnowledgeCategory = (v: unknown): v is OperationsKnowledgeCategory =>
  typeof v === 'string' && (OPERATIONS_KNOWLEDGE_CATEGORIES as readonly string[]).includes(v);

// ---- access -----------------------------------------------------------------------------------------------------------

const crossCouncil = (actor: MemberWriteActor, councilId: number, action: string) =>
  new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} for council ${councilId}.`, {
    actorId: actor.memberId,
    actorCouncilId: actor.councilId,
    councilId,
  });

/**
 * Writing a vault entry: the council's Active Admins, Grand Knight and Deputy Grand Knight, or any Active Super Admin.
 * GRAND_KNIGHT_REQUIRED, or COUNCIL_ACCESS_DENIED for another council's leader.
 */
export function assertMayWriteOperationsKnowledge(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  const leader = actor.active && (hasAdminRights(actor) || holdsGrandKnightAuthority(actor.roles));
  if (leader && actor.councilId === councilId) return;
  if (leader) throw crossCouncil(actor, councilId, action);
  throw new SecurityPrivilegeError(
    'GRAND_KNIGHT_REQUIRED',
    `Only the council's Admins, Grand Knight, Deputy Grand Knight or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, councilId },
  );
}

/**
 * Reading the archive (Sprint 8J: every council's entries): every Active officer (a Role with Officer = 1) and Admin of
 * any council, or any Active Super Admin. ADMIN_REQUIRED otherwise.
 */
export function assertMayReadOperationsKnowledge(actor: MemberWriteActor, action: string): void {
  if (hasSuperAdminRights(actor) || hasAdminRights(actor) || (actor.active && actor.officer === true)) return;
  throw new SecurityPrivilegeError(
    'ADMIN_REQUIRED',
    `Only council officers, Admins or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId },
  );
}

/** The portal's twin of assertMayWriteOperationsKnowledge: the vault card on the Oversight Desk. */
export const canWriteOperationsKnowledge = (u: Actor, councilId: number): boolean =>
  isSuperAdmin(u) || (u.councilId === councilId && (isAdmin(u) || holdsGrandKnightSeat(u)));

// ---- the signature stamp ----------------------------------------------------------------------------------------------

/** The seat a signature names: the Grand Knight seat first, then the Admin keys. */
export function signatureSeatOf(actor: Pick<MemberWriteActor, 'memberType' | 'roles'>): string {
  const roles = actor.roles ?? [];
  if (roles.includes('Grand Knight')) return 'Grand Knight';
  if (roles.includes('Deputy Grand Knight')) return 'Deputy Grand Knight';
  return actor.memberType === 'Super Admin' ? 'Super Admin' : 'Admin';
}

/** The automatic stamp: '<first> <last>, <seat>'. */
export function operationsKnowledgeSignature(firstName: string, lastName: string, actor: Pick<MemberWriteActor, 'memberType' | 'roles'>): string {
  const name = `${(firstName ?? '').trim()} ${(lastName ?? '').trim()}`.trim() || 'Unknown member';
  return `${name}, ${signatureSeatOf(actor)}`.slice(0, 255);
}

// ---- the originating council stamp (Sprint 8J) ---------------------------------------------------------------------

/** The badge text written into origin_council_stamp when an entry is saved: 'Council <number> · <name>'. */
export const operationsKnowledgeCouncilStamp = (c: Pick<Council, 'CouncilNumber' | 'CouncilName'>): string =>
  `Council ${c.CouncilNumber} · ${c.CouncilName}`.slice(0, 255);

/** Fills a blank origin_council_stamp from the council table, for rows saved before schema 80. */
export function withOriginCouncilStamp<R extends Pick<CouncilOperationsKnowledge, 'council_id' | 'origin_council_stamp'>>(
  rows: readonly R[],
  councils: readonly Pick<Council, 'id' | 'CouncilNumber' | 'CouncilName'>[],
): R[] {
  return rows.map((r) => {
    if (r.origin_council_stamp) return r;
    const c = councils.find((x) => x.id === r.council_id);
    return { ...r, origin_council_stamp: c ? operationsKnowledgeCouncilStamp(c) : `Council #${r.council_id}` };
  });
}

// ---- input --------------------------------------------------------------------------------------------------------------

export interface NewOperationsKnowledgeInput {
  category_tag: OperationsKnowledgeCategory;
  /** Plain text with light markdown (# headings, - bullets, **bold**). */
  entry_text: string;
}

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

const CONTENT_LABEL: Record<DiaryContentCategory, string> = {
  profanity: 'foul or vulgar language',
  political: 'partisan political content',
  hate: 'hateful language',
};

/**
 * Sprint 8J, the vault's content guard: the diary's patterns (foul language, hate speech, partisan keywords).
 * KNOWLEDGE_CONTENT_BLOCKED names the kind of language but never repeats the word. Returns `text`.
 */
export function assertKnowledgeTextAllowed(text: string): string {
  const category = findDiaryContentViolation(text);
  if (category) {
    throw new BusinessRuleError(
      'KNOWLEDGE_CONTENT_BLOCKED',
      `This entry was not saved because it contains ${CONTENT_LABEL[category]}. The vault is read by officers of every council, so please reword it and save it again.`,
      { category },
    );
  }
  return text;
}

/** The content guard's verdict for the editor, or null for clean text. */
export function knowledgeContentProblem(text: string): string | null {
  const category = findDiaryContentViolation(text);
  return category ? `This entry contains ${CONTENT_LABEL[category]}. Reword it before saving.` : null;
}

/**
 * INVALID_INPUT for an unknown tag, blank text or text over OPERATIONS_KNOWLEDGE_MAX_LENGTH; then
 * KNOWLEDGE_CONTENT_BLOCKED (content guard) and CHARTER_VIOLATION_BLOCKED (a SEVERE Charter rule).
 */
export function cleanOperationsKnowledgeEntry(input: NewOperationsKnowledgeInput): NewOperationsKnowledgeInput {
  if (input === null || typeof input !== 'object') throw invalid('Send the entry.');
  if (!isOperationsKnowledgeCategory(input.category_tag)) {
    throw invalid(`Pick one of the governance tags: ${OPERATIONS_KNOWLEDGE_CATEGORIES.join(', ')}.`, { field: 'category_tag' });
  }
  if (typeof input.entry_text !== 'string') throw invalid('The entry must be text.', { field: 'entry_text' });
  const text = input.entry_text.replace(/\r\n/g, '\n').trim();
  if (text === '') throw invalid('Write the entry before saving it.', { field: 'entry_text' });
  if (text.length > OPERATIONS_KNOWLEDGE_MAX_LENGTH) {
    throw invalid(`An entry may be at most ${OPERATIONS_KNOWLEDGE_MAX_LENGTH.toLocaleString('en-US')} characters.`, { field: 'entry_text', length: text.length });
  }
  assertKnowledgeTextAllowed(text);
  assertCharterCompliant(text);
  return { category_tag: input.category_tag, entry_text: text };
}

// ---- the archive ------------------------------------------------------------------------------------------------------

/** The fraternal year (July 1 - June 30) of a 'YYYY-MM-DD...' timestamp, e.g. '2025-2026'. */
export function knowledgeFraternalYear(dateLogged: string): string {
  const y = Number(dateLogged.slice(0, 4));
  const start = Number(dateLogged.slice(5, 7)) >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** The fraternal years the entries span, newest first. */
export function knowledgeYearsOf(rows: readonly Pick<CouncilOperationsKnowledge, 'date_logged'>[]): string[] {
  return [...new Set(rows.map((r) => knowledgeFraternalYear(r.date_logged)))].sort((a, b) => b.localeCompare(a));
}

export interface OperationsKnowledgeFilter {
  /** null or undefined: every tag. */
  category?: OperationsKnowledgeCategory | null;
  /** A fraternal year label ('2025-2026'); null or undefined: every year. */
  fraternalYear?: string | null;
  /** Every word must appear in the text, the signature or the council stamp, ignoring case. */
  query?: string;
  /** Sprint 8J: the "Filter by My Home Council Only" toggle - only this council's entries. null or undefined: every council. */
  homeCouncilId?: number | null;
}

/** Newest first, then by entry_id (newest first). */
export const sortOperationsKnowledge = <R extends Pick<CouncilOperationsKnowledge, 'entry_id' | 'date_logged'>>(rows: readonly R[]): R[] =>
  [...rows].sort((a, b) => b.date_logged.localeCompare(a.date_logged) || b.entry_id - a.entry_id);

/** The archive grid's rows for a filter, newest first. */
export function filterOperationsKnowledge<R extends CouncilOperationsKnowledge>(rows: readonly R[], filter: OperationsKnowledgeFilter = {}): R[] {
  const words = (filter.query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return sortOperationsKnowledge(
    rows.filter((r) => {
      if (filter.category && r.category_tag !== filter.category) return false;
      if (filter.fraternalYear && knowledgeFraternalYear(r.date_logged) !== filter.fraternalYear) return false;
      if (filter.homeCouncilId != null && r.council_id !== filter.homeCouncilId) return false;
      const text = `${r.entry_text} ${r.officer_signature} ${r.origin_council_stamp ?? ''}`.toLowerCase();
      return words.every((w) => text.includes(w));
    }),
  );
}
