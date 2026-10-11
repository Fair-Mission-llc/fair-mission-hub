'use client';
// Sprint 7F: the onboarding gate, the Inbound Council Mail Center, the view-as banner and the remote assistance button.
//
//   AccessRequestForm      the sign-in page's "Register Your Council / Request Access" card. It posts to
//                          /api/access-requests, which stores the request and emails ACCESS_REQUEST_NOTIFY_EMAIL.
//   InboundMailCenter      the Executive Dashboard card where Super Admins read and approve those requests.
//   ViewAsBanner           the gold bar across the portal while a Super Admin views it as another member.
//   RemoteAssistButton     the header button an officer or Admin clicks to share their screen with the Super Admins.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACCESS_REQUEST_CITY_MAX_LENGTH,
  ACCESS_REQUEST_COUNCIL_NAME_MAX_LENGTH,
  ACCESS_REQUEST_EMAIL_MAX_LENGTH,
  ACCESS_REQUEST_NOTIFY_EMAIL,
  ACCESS_REQUEST_STATE_MAX_LENGTH,
  ASSIST_NOTE_MAX_LENGTH,
  ASSIST_REFRESH_MS,
  type CouncilAccessRequest,
} from '@kofc/shared';
import { Button, Empty, Field, Input, Notice, Pill } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/use-load';

export const ACCESS_REQUESTS_ROUTE = '/api/access-requests';
export const ASSIST_ROUTE = '/api/assist';

// ---- the sign-in page's request form -------------------------------------------------

export function AccessRequestForm({ onCancel }: { onCancel: () => void }) {
  const [draft, setDraft] = useState({ council_name: '', contact_email: '', city: '', state: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(ACCESS_REQUESTS_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { submitted?: boolean; message?: string } | null;
      if (!res?.ok || !body?.submitted) throw new Error(body?.message ?? 'The request could not be sent. Try again.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-lg font-bold">Request received</h2>
        <p className="text-sm">
          Thank you. Your request was sent to {ACCESS_REQUEST_NOTIFY_EMAIL}. A platform administrator will contact {draft.contact_email.trim()} after reviewing it.
        </p>
        <Button variant="secondary" onClick={onCancel}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" aria-label="Register your council">
      <h2 className="font-serif text-lg font-bold">Register your council</h2>
      <p className="text-sm text-muted">Is your council not on the platform yet? Send this form and a platform administrator will contact you.</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="Council name">
        {(id) => <Input id={id} value={draft.council_name} onChange={set('council_name')} maxLength={ACCESS_REQUEST_COUNCIL_NAME_MAX_LENGTH} required />}
      </Field>
      <Field label="Contact email">
        {(id) => <Input id={id} type="email" autoComplete="email" value={draft.contact_email} onChange={set('contact_email')} maxLength={ACCESS_REQUEST_EMAIL_MAX_LENGTH} required />}
      </Field>
      <Field label="City">{(id) => <Input id={id} value={draft.city} onChange={set('city')} maxLength={ACCESS_REQUEST_CITY_MAX_LENGTH} required />}</Field>
      <Field label="State">{(id) => <Input id={id} value={draft.state} onChange={set('state')} maxLength={ACCESS_REQUEST_STATE_MAX_LENGTH} required />}</Field>
      <Button type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send request'}
      </Button>
      <button type="button" onClick={onCancel} className="self-center text-sm font-bold underline">
        Back to sign in
      </button>
    </form>
  );
}

// ---- Inbound Council Mail Center ------------------------------------------------------

async function readAccessRequests(): Promise<CouncilAccessRequest[]> {
  const res = await fetch(ACCESS_REQUESTS_ROUTE).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { requests?: CouncilAccessRequest[]; message?: string } | null;
  if (!res?.ok) throw new Error(body?.message ?? 'The server did not answer.');
  return body?.requests ?? [];
}

/** Super Admins: council access requests from the sign-in page, newest pending first, each with an Approve button. */
export function InboundMailCenter() {
  const requests = useLoad(readAccessRequests, []);
  const [error, setError] = useState<string | null>(null);
  const approve = async (id: number) => {
    setError(null);
    const res = await fetch(ACCESS_REQUESTS_ROUTE, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'APPROVED' }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { message?: string } | null;
    if (!res?.ok) setError(body?.message ?? 'The request could not be approved.');
    await requests.reload();
  };
  const rows = requests.data ?? [];
  const pending = rows.filter((r) => r.status === 'PENDING').length;

  return (
    <section aria-label="Inbound Council Mail Center" className="rounded border-4 border-navy border-t-8 border-t-gold bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-navy px-4 py-2 text-white">
        <h2 className="font-serif text-lg font-bold">Inbound Council Mail Center</h2>
        <span className="rounded border-2 border-gold px-2 text-sm font-bold">{pending} pending</span>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm">
          Councils that asked for access from the sign-in page. Each request is also emailed to <strong>{ACCESS_REQUEST_NOTIFY_EMAIL}</strong>. Approving marks it
          reviewed; add the council on the Councils page.
        </p>
        {error || requests.error ? <Notice tone="error">{error ?? requests.error}</Notice> : null}
        {requests.loading && !requests.data ? (
          <p className="text-sm text-muted">Loading requests…</p>
        ) : rows.length === 0 ? (
          <Empty>No council has asked for access yet.</Empty>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded border-2 border-navy px-3 py-2">
                <div className="min-w-0">
                  <p className="font-bold">{r.council_name}</p>
                  <p className="text-sm">
                    {r.city}, {r.state} · <a className="font-bold underline" href={`mailto:${r.contact_email}`}>{r.contact_email}</a>
                  </p>
                  <p className="text-xs text-muted">Received {formatFullDate(r.submitted_at.slice(0, 10))}</p>
                </div>
                {r.status === 'PENDING' ? (
                  <Button size="sm" onClick={() => void approve(r.id)}>
                    Approve
                  </Button>
                ) : (
                  <Pill tone="gold">Approved</Pill>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---- view-as banner -----------------------------------------------------------------------

export function ViewAsBanner() {
  const { user, impersonator, stopImpersonating } = useSession();
  const [busy, setBusy] = useState(false);
  if (!user || !impersonator) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-navy bg-gold px-6 py-2 text-navy">
      <p className="text-sm font-bold">
        👥 You are viewing the portal as {user.firstName} {user.lastName} ({user.memberType}). Nothing can be saved in this view.
      </p>
      <Button
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void stopImpersonating().finally(() => setBusy(false));
        }}
      >
        Return to my account
      </Button>
    </div>
  );
}

// ---- remote assistance (the member's side) ------------------------------------------------

/**
 * A sanitized copy of what the member sees: the portal's <main> (or the whole body) with every form field's value,
 * every script and every element marked data-assist-private removed, plus links to the page's stylesheets so the desk
 * draws it the same. The server sanitizes it again (sanitizeAssistSnapshot).
 */
export function captureAssistSnapshot(): { route: string; viewport: { width: number; height: number }; html: string } {
  const source = document.querySelector('main') ?? document.body;
  const copy = source.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('script, iframe, object, embed, [data-assist-private]').forEach((el) => el.remove());
  copy.querySelectorAll('input').forEach((el) => {
    el.removeAttribute('value');
    if (el.type === 'password' || el.type === 'hidden') el.remove();
  });
  copy.querySelectorAll('textarea').forEach((el) => (el.textContent = ''));
  copy.querySelectorAll('option[selected]').forEach((el) => el.removeAttribute('selected'));
  const styles = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map((l) => `<link rel="stylesheet" href="${new URL(l.href, location.href).href}">`)
    .join('');
  const inlineStyles = Array.from(document.querySelectorAll('style'))
    .map((s) => `<style>${s.textContent ?? ''}</style>`)
    .join('');
  return {
    route: location.pathname,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    html: `<!doctype html><html><head>${styles}${inlineStyles}</head><body class="${document.body.className}">${copy.outerHTML}</body></html>`,
  };
}

/**
 * The header's "Request Remote Officer Assistance" button. After the member confirms, their screen copy goes to the
 * Super Admins' desk and is re-sent every ASSIST_REFRESH_MS until they click Stop sharing (or the desk closes it).
 */
export function RemoteAssistButton() {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  idRef.current = requestId;

  const stop = useCallback(async () => {
    const id = idRef.current;
    setRequestId(null);
    if (id) await fetch(`${ASSIST_ROUTE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
  }, []);

  useEffect(() => {
    if (!requestId) return;
    const timer = setInterval(() => {
      void fetch(ASSIST_ROUTE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: requestId, ...captureAssistSnapshot() }) })
        .then((res) => {
          // The desk closed the request, or it went idle: stop sharing.
          if (res.status === 404) setRequestId(null);
        })
        .catch(() => null);
    }, ASSIST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [requestId]);

  const open = async () => {
    setError(null);
    const res = await fetch(ASSIST_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note, ...captureAssistSnapshot() }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res?.ok || !body?.id) {
      setError(body?.message ?? 'The request could not be sent.');
      return;
    }
    setRequestId(body.id);
    setAsking(false);
    setNote('');
  };

  if (requestId) {
    return (
      <button type="button" onClick={() => void stop()} className="rounded border-2 border-gold bg-brand-red px-3 py-1 text-sm font-bold text-white">
        ● Sharing screen · Stop sharing
      </button>
    );
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => setAsking((a) => !a)} aria-expanded={asking} className="rounded border-2 border-white px-3 py-1 text-sm font-bold hover:underline">
        ❓ Request Remote Officer Assistance
      </button>
      {asking ? (
        <div className="absolute right-0 z-20 mt-2 flex w-80 flex-col gap-3 rounded border-2 border-navy border-t-4 border-t-gold bg-white p-4 text-navy shadow-xl">
          <p className="text-sm">
            A Super Admin will see a copy of this page, refreshed every {ASSIST_REFRESH_MS / 1000} seconds, until you stop sharing. Text you type in form fields
            is not sent.
          </p>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field label="What do you need help with? (optional)">
            {(id) => <Input id={id} value={note} maxLength={ASSIST_NOTE_MAX_LENGTH} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void open()}>
              Share my screen
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
