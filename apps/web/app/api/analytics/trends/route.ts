// GET /api/analytics/trends?councilId=1&years=2026-2027,2025-2026 - the comparative year-over-year trends (Sprint 8F):
// each fraternal year's monthly revenue split (cash, electronic) and volunteer hours (events, activities), July first,
// newest year first (council-goals.ts buildCouncilTrends, through reports.yearOverYearTrends). Without `years` it compares
// the current fraternal year with the two before it (defaultTrendYears).
//
// The route reads the server's own copy of the data (memberDirectory) as the signed-in member, so the driver's gate
// applies: the general ledger's readers - the council's officers, Admins and finance officers, and any Super Admin.
// 401 without a portal session, 403 for a reader the gate refuses, 400 for a bad council or year list.
import { NextResponse } from 'next/server';
import { BusinessRuleError, defaultTrendYears, describeError, SecurityPrivilegeError } from '@kofc/shared';
import { memberDirectory, requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, () => true);
  if ('denied' in session) return session.denied;
  const params = new URL(req.url).searchParams;
  const councilId = Number(params.get('councilId') ?? session.claims.councilId);
  const yearsParam = params.get('years');
  const years = yearsParam ? yearsParam.split(',').map((y) => y.trim()).filter(Boolean) : defaultTrendYears(new Date());
  if (!Number.isInteger(councilId) || councilId < 1) {
    return NextResponse.json({ message: 'councilId must be a council id.' }, { status: 400 });
  }
  try {
    const db = await memberDirectory();
    const trends = await db.reports.yearOverYearTrends(session.claims.memberId, councilId, years);
    return NextResponse.json({ trends }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const status = err instanceof SecurityPrivilegeError ? 403 : err instanceof BusinessRuleError ? 400 : 500;
    return NextResponse.json({ message: describeError(err) }, { status });
  }
}
