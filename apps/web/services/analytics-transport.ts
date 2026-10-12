// How the Executive Dashboard asks for the year-over-year trends (Sprint 8F): GET /api/analytics/trends, the backend
// analytics route. The portal server answers from its own copy of the data (session.ts), which does not see what changed
// in this browser tab, and refuses a member who has no server session (a tab-only member). In that case the dashboard
// computes the same trends in the browser through the data service, and says which source it shows.
import type { CouncilTrends } from '@kofc/shared';
import { db } from '@/services/db';

export const ANALYTICS_TRENDS_ROUTE = '/api/analytics/trends';

export interface TrendsAnswer {
  trends: CouncilTrends;
  source: 'server' | 'browser';
}

/** The trends from the analytics route, or from the browser's data service when the route cannot answer. */
export async function loadCouncilTrends(actorId: number, councilId: number, years: readonly string[]): Promise<TrendsAnswer> {
  const query = new URLSearchParams({ councilId: String(councilId), years: years.join(',') });
  const res = await fetch(`${ANALYTICS_TRENDS_ROUTE}?${query.toString()}`, { cache: 'no-store' }).catch(() => null);
  if (res?.ok) {
    const body = (await res.json().catch(() => null)) as { trends?: CouncilTrends } | null;
    if (body?.trends) return { trends: body.trends, source: 'server' };
  }
  // A 403 here means the server's gate refused; the browser's driver applies the same gate and throws the same refusal.
  return { trends: await db.reports.yearOverYearTrends(actorId, councilId, years), source: 'browser' };
}
