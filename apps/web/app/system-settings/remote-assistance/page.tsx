'use client';
// Co-Watching Remote Assistance Desk (Sprint 7F): the Super Admin's view of the screens officers and Admins share when
// they click "Request Remote Officer Assistance" in the header. The list re-reads /api/assist every ASSIST_REFRESH_MS;
// the chosen request's latest screen copy is drawn in a sandboxed frame (no scripts, no same-origin access) at the
// member's own window width. The copy carries no form values: the member's browser and the server both remove them.
// Super Admins only (canOpenRemoteAssistanceDesk); the route checks the session too.
import { useEffect, useState } from 'react';
import { ASSIST_REFRESH_MS } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { ASSIST_ROUTE } from '@/components/PlatformAccessParts';
import { Button, Empty, Notice, PageTitle, Panel } from '@/components/ui';

interface AssistSummary {
  id: string;
  memberId: number;
  councilId: number;
  memberName: string;
  note: string;
  route: string;
  viewport: { width: number; height: number };
  openedAt: string;
  updatedAt: string;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

function useAssistPoll<T>(url: string | null, pick: (body: Record<string, unknown>) => T): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (url === null) {
      setData(null);
      return;
    }
    let live = true;
    const read = async () => {
      const res = await fetch(url).catch(() => null);
      const body = ((await res?.json().catch(() => null)) ?? {}) as Record<string, unknown>;
      if (!live) return;
      if (res?.ok) {
        setData(pick(body));
        setError(null);
      } else {
        setData(null);
        setError(typeof body.message === 'string' ? body.message : 'The server did not answer.');
      }
    };
    void read();
    const timer = setInterval(() => void read(), ASSIST_REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return { data, error };
}

function Desk() {
  const [selected, setSelected] = useState<string | null>(null);
  const list = useAssistPoll(ASSIST_ROUTE, (b) => (b.requests ?? []) as AssistSummary[]);
  const watched = useAssistPoll(selected === null ? null : `${ASSIST_ROUTE}?id=${encodeURIComponent(selected)}`, (b) => b.request as AssistSummary & { html: string });
  const requests = list.data ?? [];

  const close = async (id: string) => {
    await fetch(`${ASSIST_ROUTE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    if (selected === id) setSelected(null);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel title={`Open requests (${requests.length})`}>
        {list.error ? <Notice tone="error">{list.error}</Notice> : null}
        {requests.length === 0 ? (
          <Empty>Nobody is sharing a screen. A request appears here when an officer clicks Request Remote Officer Assistance.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className={`rounded border-2 px-3 py-2 ${selected === r.id ? 'border-gold bg-navy text-white' : 'border-navy bg-white'}`}>
                <button type="button" onClick={() => setSelected(r.id)} className="w-full text-left" aria-pressed={selected === r.id}>
                  <span className="block font-bold">{r.memberName}</span>
                  <span className="block text-sm">On {r.route}</span>
                  {r.note ? <span className="block text-sm italic">“{r.note}”</span> : null}
                  <span className="block text-xs">Last update {timeOf(r.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title={watched.data ? `Watching ${watched.data.memberName}` : 'Live screen'}
        actions={
          watched.data ? (
            <Button size="sm" variant="secondary" onClick={() => void close(watched.data!.id)}>
              Close request
            </Button>
          ) : undefined
        }
      >
        {watched.error ? <Notice tone="error">{watched.error}</Notice> : null}
        {!watched.data ? (
          <Empty>Choose a request to see that member&apos;s screen. It refreshes every {ASSIST_REFRESH_MS / 1000} seconds.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              {watched.data.route} · {watched.data.viewport.width} × {watched.data.viewport.height} · updated {timeOf(watched.data.updatedAt)}. Form fields
              show empty: what the member types is never sent.
            </p>
            <div className="overflow-auto rounded border-4 border-navy">
              <iframe
                title={`Screen shared by ${watched.data.memberName}`}
                sandbox=""
                srcDoc={watched.data.html}
                style={{ width: watched.data.viewport.width, height: watched.data.viewport.height }}
                className="block bg-white"
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function RemoteAssistancePage() {
  return (
    <RequireArea area="system-settings/remote-assistance">
      <PageTitle>Co-Watching Remote Assistance Desk</PageTitle>
      <p className="mb-4 text-sm text-muted">
        Officers and Admins share a copy of their screen when they ask for help. You see the page as they see it, without what they typed in form fields.
        Sharing stops when they click Stop sharing, when you close the request, or after 30 minutes without an update.
      </p>
      <Desk />
    </RequireArea>
  );
}
