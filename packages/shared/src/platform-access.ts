// =========================================================================
// ONBOARDING GATES, CHECK PAYMENTS, ADMIN IMPERSONATION AND REMOTE ASSISTANCE (Sprint 7F)
// Pure helpers behind:
//   - accessRequests.*: a council that is not on the platform asks for access from the sign-in page
//     (CouncilAccessRequests). Anyone may file one; each is emailed to ACCESS_REQUEST_NOTIFY_EMAIL, and Super Admins
//     read and approve them in the Inbound Council Mail Center on the Executive Dashboard.
//   - JournalEntry.payment_method: 'CASH', 'CARD' or 'CHECK'; a CHECK line carries its check number.
//   - auth.impersonate and /api/admin/impersonate: an Active Super Admin views the portal as another member. The view is
//     read-only (guardViewAsWrites) and never reaches another Super Admin.
//   - /api/assist: an officer or Admin asks for help and shares a sanitized copy of their screen with Super Admins.
// =========================================================================
import type { AccessRequestInput } from './contract';
import { NOTIFICATION_SENDER, type EmailPayload } from './notifications';
import { CHECK_NUMBER_MAX_LENGTH } from './expenses';
import { assertText, BusinessRuleError, describeActor, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { AccessRequestStatus, CouncilAccessRequest, JournalPaymentMethod } from './types';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

// ---- council access requests ---------------------------------------------------

/** CouncilAccessRequests.status values: every request starts PENDING; a Super Admin marks it APPROVED. */
export const ACCESS_REQUEST_STATUSES: readonly AccessRequestStatus[] = ['PENDING', 'APPROVED'];
/** Where every new access request is emailed: Council 15295's own mailbox. */
export const ACCESS_REQUEST_NOTIFY_EMAIL = 'council15295@stmarys.org';
/** Longest council_name (VARCHAR(150)). */
export const ACCESS_REQUEST_COUNCIL_NAME_MAX_LENGTH = 150;
/** Longest contact_email (VARCHAR(255)). */
export const ACCESS_REQUEST_EMAIL_MAX_LENGTH = 255;
/** Longest city (VARCHAR(100)). */
export const ACCESS_REQUEST_CITY_MAX_LENGTH = 100;
/** Longest state (VARCHAR(50)): a postal code or a full state, province or country name. */
export const ACCESS_REQUEST_STATE_MAX_LENGTH = 50;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The four form fields, trimmed. A missing or over-long field, or an email that is not one: INVALID_INPUT. */
export function cleanAccessRequest(input: AccessRequestInput): AccessRequestInput {
  const b = (input ?? {}) as Partial<AccessRequestInput>;
  const contact_email = assertText(b.contact_email, 'Contact email', ACCESS_REQUEST_EMAIL_MAX_LENGTH);
  if (!EMAIL.test(contact_email)) throw invalid(`"${contact_email}" is not an email address.`, { field: 'contact_email' });
  return {
    council_name: assertText(b.council_name, 'Council name', ACCESS_REQUEST_COUNCIL_NAME_MAX_LENGTH),
    contact_email,
    city: assertText(b.city, 'City', ACCESS_REQUEST_CITY_MAX_LENGTH),
    state: assertText(b.state, 'State', ACCESS_REQUEST_STATE_MAX_LENGTH),
  };
}

/** The notice emailed to ACCESS_REQUEST_NOTIFY_EMAIL for one new request. */
export function accessRequestEmail(request: Pick<CouncilAccessRequest, 'id' | 'council_name' | 'contact_email' | 'city' | 'state' | 'submitted_at'>): EmailPayload {
  return {
    from: NOTIFICATION_SENDER,
    to: ACCESS_REQUEST_NOTIFY_EMAIL,
    subject: `New council access request: ${request.council_name}`,
    text: [
      'A council asked for access to the platform from the sign-in page.',
      '',
      `Council: ${request.council_name}`,
      `City: ${request.city}, ${request.state}`,
      `Contact: ${request.contact_email}`,
      `Received: ${request.submitted_at}`,
      `Request number: ${request.id}`,
      '',
      'A Super Admin reviews it in the Inbound Council Mail Center on the Executive Dashboard.',
    ].join('\n'),
    attachments: [],
  };
}

/** Reading and approving access requests: Active Super Admins only (SUPER_ADMIN_REQUIRED). */
export const mayReviewAccessRequests = (actor: MemberWriteActor): boolean => hasSuperAdminRights(actor);

export function assertMayReviewAccessRequests(actor: MemberWriteActor, action: string): void {
  if (!mayReviewAccessRequests(actor)) {
    throw new SecurityPrivilegeError('SUPER_ADMIN_REQUIRED', `Only an Active Super Admin may ${action}; you are ${describeActor(actor)}.`, { memberId: actor.memberId });
  }
}

/** PENDING -> APPROVED only; anything else is INVALID_INPUT. */
export function assertAccessRequestTransition(current: AccessRequestStatus, next: unknown): AccessRequestStatus {
  if (!(ACCESS_REQUEST_STATUSES as readonly unknown[]).includes(next)) {
    throw invalid(`An access request's status must be one of ${ACCESS_REQUEST_STATUSES.join(', ')}; received ${JSON.stringify(next)}.`, { status: next });
  }
  if (current !== 'PENDING' || next !== 'APPROVED') throw invalid(`An access request that is ${current} cannot become ${String(next)}.`, { current, next });
  return next;
}

/** Newest first: pending requests ahead of approved ones, then by submission time, then id. */
export const sortAccessRequests = <T extends Pick<CouncilAccessRequest, 'id' | 'status' | 'submitted_at'>>(rows: readonly T[]): T[] =>
  [...rows].sort(
    (a, b) =>
      ACCESS_REQUEST_STATUSES.indexOf(a.status) - ACCESS_REQUEST_STATUSES.indexOf(b.status) ||
      b.submitted_at.localeCompare(a.submitted_at) ||
      b.id - a.id,
  );

// ---- journal payment methods -----------------------------------------------------

/** JournalEntry.payment_method values, the column's CHECK list. */
export const JOURNAL_PAYMENT_METHODS: readonly JournalPaymentMethod[] = ['CASH', 'CARD', 'CHECK'];
/** How the revenue card labels each method. */
export const JOURNAL_PAYMENT_METHOD_LABELS: Readonly<Record<JournalPaymentMethod, string>> = { CASH: 'Cash', CARD: 'Card', CHECK: 'Check' };

/**
 * The payment fields of a posting: no method (NULL, and no check number), CASH or CARD (no check number), or CHECK with
 * its check number. An unknown method, a CHECK without a number, or a number on CASH or CARD: INVALID_INPUT.
 */
export function cleanJournalPayment(method: unknown, checkNumber: unknown): { payment_method: JournalPaymentMethod | null; CheckNumber: string | null } {
  const number = checkNumber === undefined || checkNumber === null || String(checkNumber).trim() === '' ? null : assertText(checkNumber, 'Check number', CHECK_NUMBER_MAX_LENGTH);
  if (method === undefined || method === null || method === '') {
    if (number !== null) throw invalid('Choose Check as the payment method to record a check number.', { field: 'payment_method' });
    return { payment_method: null, CheckNumber: null };
  }
  if (!(JOURNAL_PAYMENT_METHODS as readonly unknown[]).includes(method)) {
    throw invalid(`Payment method must be one of ${JOURNAL_PAYMENT_METHODS.join(', ')}; received ${JSON.stringify(method)}.`, { field: 'payment_method' });
  }
  if (method === 'CHECK' && number === null) throw invalid('Enter the check number of a payment by check.', { field: 'CheckNumber' });
  if (method !== 'CHECK' && number !== null) throw invalid('Only a payment by check has a check number.', { field: 'CheckNumber' });
  return { payment_method: method as JournalPaymentMethod, CheckNumber: number };
}

// ---- impersonation (view-as) -------------------------------------------------------

/** The longest a view-as session lasts before the server ends it, in minutes. */
export const IMPERSONATION_MAX_MINUTES = 60;

/**
 * May `actor` view the portal as `target`? Only an Active Super Admin (SUPER_ADMIN_REQUIRED), never as themself and
 * never as another Super Admin (IMPERSONATION_REFUSED), so the view never holds more power than the actor's own.
 */
export function assertMayImpersonate(actor: MemberWriteActor, target: { memberId: number; memberType: string | undefined }): void {
  if (!hasSuperAdminRights(actor)) {
    throw new SecurityPrivilegeError('SUPER_ADMIN_REQUIRED', `Only an Active Super Admin may view the portal as another member; you are ${describeActor(actor)}.`, {
      memberId: actor.memberId,
    });
  }
  if (target.memberId === actor.memberId) throw new BusinessRuleError('IMPERSONATION_REFUSED', 'You are already signed in as yourself.', { memberId: target.memberId });
  if (target.memberType === 'Super Admin') {
    throw new BusinessRuleError('IMPERSONATION_REFUSED', 'A Super Admin cannot be impersonated.', { memberId: target.memberId });
  }
}

/** The member grid's "Impersonate User" button: shown to Super Admins beside every member but themselves and other Super Admins. */
export const mayImpersonateMember = (viewer: { memberId: number; memberType: string | undefined }, target: { memberId: number; memberType: string | undefined }): boolean =>
  viewer.memberType === 'Super Admin' && target.memberId !== viewer.memberId && target.memberType !== 'Super Admin';

/** Data-service methods a view-as session may call: reads only. Anything else is refused (VIEW_AS_READ_ONLY). */
const VIEW_AS_READ_METHOD = /^(get|list|search|count|preview)([A-Z]|$)|^(monthlySummary|missionAreaFootprint|memberCenter|memberHours|councilEngagement)$/;

export const isViewAsReadMethod = (name: string): boolean => VIEW_AS_READ_METHOD.test(name);

/**
 * Wraps a data service so that, while `active()` is true, every namespace method that is not a read rejects
 * VIEW_AS_READ_ONLY before it runs. Top-level members (init, reset) and anything that is not a plain object pass
 * through. The wrapper is the same object shape, so screens use it unchanged.
 */
export function guardViewAsWrites<T extends object>(service: T, active: () => boolean): T {
  const wrapped = new Map<PropertyKey, unknown>();
  return new Proxy(service, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      // Only the service's namespaces (plain object literals) are wrapped; class instances and Maps pass untouched.
      if (typeof value !== 'object' || value === null || Object.getPrototypeOf(value) !== Object.prototype) return value;
      if (!wrapped.has(prop)) {
        const namespace = value as Record<string, unknown>;
        wrapped.set(
          prop,
          new Proxy(namespace, {
            get(ns, method, nsReceiver) {
              const fn = Reflect.get(ns, method, nsReceiver);
              if (typeof fn !== 'function' || typeof method !== 'string' || isViewAsReadMethod(method)) return fn;
              return (...args: unknown[]) =>
                active()
                  ? Promise.reject(
                      new BusinessRuleError('VIEW_AS_READ_ONLY', 'You are viewing the portal as another member, so nothing can be saved. Return to your own account first.', {
                        method: `${String(prop)}.${method}`,
                      }),
                    )
                  : (fn as (...a: unknown[]) => unknown).apply(ns, args);
            },
          }),
        );
      }
      return wrapped.get(prop);
    },
  });
}

// ---- remote assistance (co-watching) ---------------------------------------------

/** Who may ask for remote assistance: Active officers and Admins (Super Admins are the ones who help). */
export const mayRequestRemoteAssistance = (actor: MemberWriteActor): boolean =>
  actor.active && actor.memberType !== 'Super Admin' && (actor.officer === true || hasAdminRights(actor));

/** Who may watch: Active Super Admins. */
export const mayWatchRemoteAssistance = (actor: MemberWriteActor): boolean => hasSuperAdminRights(actor);

/** Largest screen snapshot accepted, in characters of HTML. */
export const ASSIST_SNAPSHOT_MAX_LENGTH = 1_500_000;
/** How often the officer's screen re-sends its snapshot while sharing, and how often the desk re-reads it. */
export const ASSIST_REFRESH_MS = 5_000;
/** A request with no new snapshot for this long is closed. */
export const ASSIST_IDLE_MINUTES = 30;
/** Longest note the officer types with the request. */
export const ASSIST_NOTE_MAX_LENGTH = 500;

/**
 * Removes what must never leave the officer's screen or run on the Super Admin's: script, iframe, object and embed
 * elements, event-handler attributes, javascript: links, and the value of every form field. The browser clears field
 * values before sending too (captureAssistSnapshot); this second pass on the server does not trust it.
 */
export function sanitizeAssistSnapshot(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|object|embed|base|meta)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src|action|formaction|xlink:href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, '')
    .replace(/(<input\b[^>]*?)\s+value\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '$1')
    .replace(/(<textarea\b[^>]*>)[\s\S]*?(<\/textarea\s*>)/gi, '$1$2');
}
