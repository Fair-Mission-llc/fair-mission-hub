// =========================================================================
// ROLE MANUALS ON THE OFFICER DESKS (Sprint 9 Master Hardening Pass)
// The master Administrator guide is split into three officer manuals plus a pruned system-maintenance guide
// (scripts/compile_all_manuals.py). Each officer desk header carries its own manual:
//   - Grand Knight Desk        EXECUTIVE_GOVERNANCE_MANUAL  the Grand Knight and the Deputy Grand Knight share one book
//   - Financial Secretary Desk FINANCIAL_SECRETARY_MANUAL
//   - Treasurer Desk           TREASURER_MANUAL
// The header has a '📘 <title> (PDF)' link with a copy-link button (GET /api/manuals/pdf?manual=<key>) and a
// 'How do I…' search that ranks only that manual's task workflows (GET /api/manuals?manual=<key>, parseGuideTasks).
// Pure: the routes read the files from docs/.
// =========================================================================
import { parseGuideTasks, searchGuideTasks, type GuideTask } from './docs';
import type { DashboardTabId } from './officer-desks';

export const ROLE_MANUAL_KEYS = ['executive', 'financial-secretary', 'treasurer'] as const;
export type RoleManualKey = (typeof ROLE_MANUAL_KEYS)[number];

/** The token each desk passes to its header (DeskManualHeader manual=...): the manual's file name without '.md'. */
export const ROLE_MANUAL_TOKENS = ['EXECUTIVE_GOVERNANCE_MANUAL', 'FINANCIAL_SECRETARY_MANUAL', 'TREASURER_MANUAL'] as const;
export type RoleManualToken = (typeof ROLE_MANUAL_TOKENS)[number];

export interface RoleManual {
  key: RoleManualKey;
  token: RoleManualToken;
  title: string;
  /** The Markdown source under docs/. */
  markdown: string;
  /** The compiled print edition under docs/ (py scripts/compile_all_manuals.py). */
  pdf: string;
  /** The Active Desks tab whose header carries the manual. */
  desk: DashboardTabId;
}

export const ROLE_MANUALS: Record<RoleManualKey, RoleManual> = {
  executive: {
    key: 'executive',
    token: 'EXECUTIVE_GOVERNANCE_MANUAL',
    title: 'Executive Governance Manual',
    markdown: 'EXECUTIVE_GOVERNANCE_MANUAL.md',
    pdf: 'EXECUTIVE_GOVERNANCE_MANUAL.pdf',
    desk: 'grand-knight',
  },
  'financial-secretary': {
    key: 'financial-secretary',
    token: 'FINANCIAL_SECRETARY_MANUAL',
    title: 'Financial Secretary Manual',
    markdown: 'FINANCIAL_SECRETARY_MANUAL.md',
    pdf: 'FINANCIAL_SECRETARY_MANUAL.pdf',
    desk: 'financial-secretary',
  },
  treasurer: { key: 'treasurer', token: 'TREASURER_MANUAL', title: 'Treasurer Manual', markdown: 'TREASURER_MANUAL.md', pdf: 'TREASURER_MANUAL.pdf', desk: 'treasurer' },
};

export const isRoleManualKey = (value: unknown): value is RoleManualKey => (ROLE_MANUAL_KEYS as readonly unknown[]).includes(value);

/**
 * Sprint 11 Revision 2.0: the Administration Manual (docs/ADMIN_USER_GUIDE.md) on the Admin Desk's first two drawers - its
 * PDF and its 'How do I...' search. It is not an officer desk's manual, so it is kept apart from ROLE_MANUALS; the
 * /api/manuals routes serve it under the key 'admin'.
 */
export const ADMIN_MANUAL_KEY = 'admin';
export const ADMIN_MANUAL = {
  key: ADMIN_MANUAL_KEY,
  token: 'ADMIN_USER_GUIDE',
  title: 'Administration Manual',
  markdown: 'ADMIN_USER_GUIDE.md',
  pdf: 'ADMIN_USER_GUIDE.pdf',
} as const;

/** A manual the /api/manuals routes serve: one of the three role manuals, or the Administration Manual. */
export type DeskManualKey = RoleManualKey | typeof ADMIN_MANUAL_KEY;
export type DeskManualToken = RoleManualToken | typeof ADMIN_MANUAL.token;
export type DeskManual = Pick<RoleManual, 'title' | 'markdown' | 'pdf'> & { key: DeskManualKey; token: DeskManualToken };

export const isDeskManualKey = (value: unknown): value is DeskManualKey => value === ADMIN_MANUAL_KEY || isRoleManualKey(value);

/** The manual a key names. */
export const deskManual = (key: DeskManualKey): DeskManual => (key === ADMIN_MANUAL_KEY ? ADMIN_MANUAL : ROLE_MANUALS[key]);

/** The manual a token names, the Administration Manual included. */
export const deskManualByToken = (token: DeskManualToken): DeskManual => (token === ADMIN_MANUAL.token ? ADMIN_MANUAL : roleManualByToken(token));

/** The manual a token names. */
export const roleManualByToken = (token: RoleManualToken): RoleManual => ROLE_MANUAL_KEYS.map((k) => ROLE_MANUALS[k]).find((m) => m.token === token)!;

/** The manual a desk header carries, or null for a desk without one (Home, Member, Recorder, Historian, Super Admin). */
export const roleManualForDesk = (desk: DashboardTabId): RoleManual | null => ROLE_MANUAL_KEYS.map((k) => ROLE_MANUALS[k]).find((m) => m.desk === desk) ?? null;

/** The routes the desk header calls. */
export const ROLE_MANUAL_ROUTE = '/api/manuals';
export const roleManualTasksHref = (key: DeskManualKey): string => `${ROLE_MANUAL_ROUTE}?manual=${key}`;
export const roleManualPdfHref = (key: DeskManualKey): string => `${ROLE_MANUAL_ROUTE}/pdf?manual=${key}`;

/** The task workflows of one role manual's Markdown. */
export const roleManualTasks = (markdown: string): GuideTask[] => parseGuideTasks(markdown);

/** How many answers the desk's 'How do I…' search lists. */
export const ROLE_MANUAL_HELP_LIMIT = 3;

/** The best `limit` tasks of one role manual for a question; none for a question without keywords. */
export const searchRoleManual = (tasks: readonly GuideTask[], query: string, limit = ROLE_MANUAL_HELP_LIMIT): GuideTask[] =>
  searchGuideTasks(tasks, query).slice(0, limit);
