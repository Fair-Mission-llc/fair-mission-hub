// GET /api/file-repository?file=c<council>/<folder>/<name> - serves a file kept on a council's Local Network Server
// (Sprint 10 Revision 3.1, services/server/file-repository.ts). A stored record holds this link, never the share path.
// Only a signed-in member of that council or a Super Admin may open it: 401 without a session, 403 for a member of
// another council, 404 for a malformed link or a missing file.
import { NextResponse } from 'next/server';
import { FILE_REPOSITORY_ROUTE, parseFileRepositoryRef } from '@kofc/shared';
import { readFromRepository, repositoryContentType } from '@/services/server/file-repository';
import { readPortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

const message = (text: string, status: number) => NextResponse.json({ message: text }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const claims = await readPortalSession(req);
  if (!claims) return message('Sign in again: there is no portal session on the server.', 401);
  const file = new URL(req.url).searchParams.get('file') ?? '';
  const ref = `${FILE_REPOSITORY_ROUTE}?file=${file}`;
  const parts = parseFileRepositoryRef(ref);
  if (!parts) return message('No such file.', 404);
  if (parts.councilId !== claims.councilId && claims.memberType !== 'Super Admin') return message("That file belongs to another council's repository.", 403);
  try {
    const found = await readFromRepository(ref);
    if (!found) return message('No such file.', 404);
    return new Response(new Uint8Array(found.bytes), {
      headers: { 'Content-Type': repositoryContentType(found.fileName), 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return message('The council file server did not return the file.', 404);
  }
}
