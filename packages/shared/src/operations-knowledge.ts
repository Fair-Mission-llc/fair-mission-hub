// =========================================================================
// THE GLOBAL OPERATIONS KNOWLEDGE VAULT (Sprint 8I, schema version 79)
//
// A council's long-term operating notes (CouncilOperationsKnowledge), so a new chairman inherits what the last one
// learned. Each entry is filed under one of six governance tags and carries an automatic signature stamp.
//   - Writing   the Oversight Desk's Global Operations Knowledge Vault card: the council's Active Admins, Grand Knight
//               and Deputy Grand Knight, and any Active Super Admin (assertMayWriteOperationsKnowledge). Entries are
//               append-only: there is no edit or delete, so the record a chair leaves stays as written.
//   - Reading   System Settings > Operations Knowledge Archive (/system-settings/knowledge-archive), read-only: every
//               Active officer and Admin of the council and any Active Super Admin (assertMayReadOperationsKnowledge),
//               filtered by tag, fraternal year (July 1 - June 30 of date_logged) and text (filterOperationsKnowledge).
// =========================================================================
import type { SessionUser } from './contract';
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
import type { CouncilOperationsKnowledge, OperationsKnowledgeCategory } from './types';

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
 * Reading the archive: every Active officer (a Role with Officer = 1) and Admin of the council, or any Active Super
 * Admin. ADMIN_REQUIRED, or COUNCIL_ACCESS_DENIED for another council's leader.
 */
export function assertMayReadOperationsKnowledge(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  const leader = hasAdminRights(actor) || (actor.active && actor.officer === true);
  if (leader && actor.councilId === councilId) return;
  if (leader) throw crossCouncil(actor, councilId, action);
  throw new SecurityPrivilegeError(
    'ADMIN_REQUIRED',
    `Only the council's officers, Admins or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, councilId },
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

// ---- input --------------------------------------------------------------------------------------------------------------

export interface NewOperationsKnowledgeInput {
  category_tag: OperationsKnowledgeCategory;
  /** Plain text with light markdown (# headings, - bullets, **bold**). */
  entry_text: string;
}

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

/** INVALID_INPUT for an unknown tag, blank text or text over OPERATIONS_KNOWLEDGE_MAX_LENGTH. */
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
  /** Every word must appear in the text or the signature, ignoring case. */
  query?: string;
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
      const text = `${r.entry_text} ${r.officer_signature}`.toLowerCase();
      return words.every((w) => text.includes(w));
    }),
  );
}
