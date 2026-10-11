// /api/assist - Co-Watching Remote Assistance (Sprint 7F; services/server/assist.ts holds the requests).
//   POST   { note?, route, viewport, html }   an Active officer or Admin opens a request with a copy of their screen
//   PUT    { id, route, viewport, html }      the same member refreshes the copy while sharing
//   DELETE ?id=                               the member stops sharing, or a Super Admin closes the request
//   GET                                       Super Admins: the open requests, without screen copies
//   GET    ?id=                               Super Admins: one request with its latest screen copy
import { NextResponse } from 'next/server';
import { mayRequestRemoteAssistance, mayWatchRemoteAssistance } from '@kofc/shared';
import { formatPersonName } from '@/lib/format';
import {
  cleanAssistSnapshot,
  closeAssistRequest,
  getAssistRequest,
  listAssistRequests,
  openAssistRequest,
  updateAssistSnapshot,
} from '@/services/server/assist';
import { memberDirectory, readPortalSession, requirePortalSession } from '@/services/server/session';
import { sessionActor } from '@/services/server/session-token';

export async function POST(req: Request) {
  const session = await requirePortalSession(req, mayRequestRemoteAssistance, { open: false });
  if ('denied' in session) return session.denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const snapshot = cleanAssistSnapshot(body);
  if (typeof snapshot === 'string') return NextResponse.json({ open: false, message: snapshot }, { status: 400 });
  const member = await (await memberDirectory()).members.get(session.claims.memberId);
  const memberName = member ? formatPersonName(member.MemberFirstName, member.MemberLastName) : session.claims.username;
  const request = openAssistRequest({ memberId: session.claims.memberId, councilId: session.claims.councilId, memberName }, body?.note, snapshot);
  console.info(`[assist] member ${session.claims.memberId} opened remote assistance request ${request.id} on ${snapshot.route}.`);
  return NextResponse.json({ open: true, id: request.id });
}

export async function PUT(req: Request) {
  const session = await requirePortalSession(req, mayRequestRemoteAssistance, { open: false });
  if ('denied' in session) return session.denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const snapshot = cleanAssistSnapshot(body);
  if (typeof snapshot === 'string') return NextResponse.json({ open: false, message: snapshot }, { status: 400 });
  const open = typeof body?.id === 'string' && updateAssistSnapshot(body.id, session.claims.memberId, snapshot);
  return NextResponse.json({ open }, { status: open ? 200 : 404 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const session = await requirePortalSession(req, (actor) => mayRequestRemoteAssistance(actor) || mayWatchRemoteAssistance(actor), { closed: false });
  if ('denied' in session) return session.denied;
  const closed = closeAssistRequest(id, session.claims.memberId, mayWatchRemoteAssistance(session.actor));
  return NextResponse.json({ closed }, { status: closed ? 200 : 404 });
}

export async function GET(req: Request) {
  const claims = await readPortalSession(req);
  if (!claims) return NextResponse.json({ requests: [], message: 'Sign in again: there is no portal session on the server.' }, { status: 401 });
  if (!mayWatchRemoteAssistance(sessionActor(claims))) return NextResponse.json({ requests: [], message: 'Only a Super Admin may watch.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (id === null) return NextResponse.json({ requests: listAssistRequests() });
  const request = getAssistRequest(id);
  return request ? NextResponse.json({ request }) : NextResponse.json({ message: 'That request is closed.' }, { status: 404 });
}
