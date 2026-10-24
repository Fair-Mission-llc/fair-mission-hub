// How the Calendar page gets the member's personal calendar feed link (Sprint 9 Revision 2.0): GET /api/calendar/link,
// which signs the link on the server for the member in the portal session cookie. The browser never holds the secret.
export const CALENDAR_LINK_ROUTE = '/api/calendar/link';

export interface CalendarLink {
  /** The http(s) feed URL to paste into Google Calendar or Outlook. */
  url: string;
  /** The same feed as webcal://, which Apple Calendar and Outlook open as a subscription in one tap. */
  webcalUrl: string;
}

/** The member's feed link; throws the server's reason when it refuses (no session, or a view-as session). */
export async function fetchCalendarLink(): Promise<CalendarLink> {
  const res = await fetch(CALENDAR_LINK_ROUTE, { cache: 'no-store' }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as (Partial<CalendarLink> & { message?: string }) | null;
  if (res?.ok && body?.url && body.webcalUrl) return { url: body.url, webcalUrl: body.webcalUrl };
  throw new Error(body?.message ?? 'The server did not answer, so your calendar link could not be made.');
}
