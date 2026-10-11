// The Co-Watching Remote Assistance store (Sprint 7F). SERVER ONLY.
//
// An officer or Admin who clicks "Request Remote Officer Assistance" shares a sanitized copy of their screen: the page's
// HTML with every form value, script and event handler removed (the browser's captureAssistSnapshot, then
// sanitizeAssistSnapshot here again). While the request is open their browser re-sends the copy every ASSIST_REFRESH_MS,
// and Super Admins watch it on /system-settings/remote-assistance. Nothing is captured unless the member asks, and
// they can stop sharing at any time. Requests live in this process only and close after ASSIST_IDLE_MINUTES quiet.
import { ASSIST_IDLE_MINUTES, ASSIST_NOTE_MAX_LENGTH, ASSIST_SNAPSHOT_MAX_LENGTH, sanitizeAssistSnapshot } from '@kofc/shared';

if (typeof window !== 'undefined') throw new Error('services/server/assist.ts was loaded in a browser.');

export interface AssistSnapshot {
  /** The page the member is on, e.g. '/expenses'. */
  route: string;
  /** Their window size, so the desk can draw the copy at the same width. */
  viewport: { width: number; height: number };
  html: string;
}

export interface AssistRequest extends AssistSnapshot {
  id: string;
  memberId: number;
  councilId: number;
  memberName: string;
  note: string;
  openedAt: string;
  updatedAt: string;
}

/** What the desk's list shows: everything but the screen copy. */
export type AssistRequestSummary = Omit<AssistRequest, 'html'>;

const requests = new Map<string, AssistRequest>();

function sweep(now: number): void {
  for (const [id, r] of requests) if (now - Date.parse(r.updatedAt) > ASSIST_IDLE_MINUTES * 60_000) requests.delete(id);
}

/** The snapshot fields of a request body, or an error message. */
export function cleanAssistSnapshot(body: unknown): AssistSnapshot | string {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.route !== 'string' || !b.route.startsWith('/') || b.route.length > 300) return 'Send the page path.';
  if (typeof b.html !== 'string' || b.html.length > ASSIST_SNAPSHOT_MAX_LENGTH) return 'The screen copy is missing or too large.';
  const v = (b.viewport ?? {}) as Record<string, unknown>;
  const size = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 200), 4000) : 1280);
  return { route: b.route, viewport: { width: size(v.width), height: size(v.height) }, html: sanitizeAssistSnapshot(b.html) };
}

/** Opens a request for the member, replacing any they already had open. */
export function openAssistRequest(owner: { memberId: number; councilId: number; memberName: string }, note: unknown, snapshot: AssistSnapshot, now = new Date()): AssistRequest {
  sweep(now.getTime());
  for (const [id, r] of requests) if (r.memberId === owner.memberId) requests.delete(id);
  const stamp = now.toISOString();
  const request: AssistRequest = {
    id: globalThis.crypto.randomUUID(),
    ...owner,
    note: typeof note === 'string' ? note.trim().slice(0, ASSIST_NOTE_MAX_LENGTH) : '',
    ...snapshot,
    openedAt: stamp,
    updatedAt: stamp,
  };
  requests.set(request.id, request);
  return request;
}

/** Replaces the screen copy of the member's own open request; false when it is closed or someone else's. */
export function updateAssistSnapshot(id: string, memberId: number, snapshot: AssistSnapshot, now = new Date()): boolean {
  const r = requests.get(id);
  if (!r || r.memberId !== memberId) return false;
  requests.set(id, { ...r, ...snapshot, updatedAt: now.toISOString() });
  return true;
}

/** Closes a request: its owner, or (`asWatcher`) a Super Admin. */
export function closeAssistRequest(id: string, memberId: number, asWatcher: boolean): boolean {
  const r = requests.get(id);
  if (!r || (!asWatcher && r.memberId !== memberId)) return false;
  return requests.delete(id);
}

export function listAssistRequests(now = new Date()): AssistRequestSummary[] {
  sweep(now.getTime());
  return [...requests.values()].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).map(({ html: _html, ...rest }) => rest);
}

export function getAssistRequest(id: string, now = new Date()): AssistRequest | null {
  sweep(now.getTime());
  return requests.get(id) ?? null;
}

/** Test hook: forget every request. */
export function resetAssistRequests(): void {
  requests.clear();
}
