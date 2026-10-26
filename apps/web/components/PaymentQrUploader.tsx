'use client';
// Payment QR codes (Sprint 10 Revision 5.0, file-repository.ts): one row per donation method the council has enabled
// (Venmo, Zelle, Square...), with its current QR code and a '📁 Upload QR Code Image' drop zone. The image goes to
// /api/council/payment-qr, which files it in the council's repository (or on the portal server for a Google Drive
// council) and answers its link; the card then saves that link as the method's DonationMethodURL through
// lookups.saveCouncilSpecific, keeping the row's account owner and account name. The phone's collection screen shows the
// uploaded code to donors. In the Standard Bank Accounts drawer of Council Wide Settings, for the members who keep the
// council's donation methods (canManageCouncilLookups); the route and the driver check again.
//
// Sprint 11 Revision 1.0: Cash, Check, card readers and Physical Items never show a QR code (methodAcceptsQrCode), so the
// card lists them with the control disabled. The upload itself (uploadPaymentQrImage) and the compact preview
// (QrThumbnail) are shared with the Council Lookups grid, where a QR code is a checkbox that reveals a small upload button.
import { useState } from 'react';
import {
  canManageCouncilLookups,
  describeError,
  methodAcceptsQrCode,
  PAYMENT_QR_MAX_BYTES,
  PAYMENT_QR_ROUTE,
  PAYMENT_QR_TYPES,
  UPLOAD_QR_CODE_LABEL,
  type Council,
  type CouncilDonationMethod,
} from '@kofc/shared';
import { cx, Empty, Notice, Panel } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** Whether a stored link is one a browser can show (placeholder:// seed links are not). */
export const showableQrUrl = (url: string | null | undefined): url is string => !!url && (/^https?:\/\//i.test(url) || url.startsWith('/api/'));
const showable = showableQrUrl;

/**
 * Checks and uploads one QR image for the council (PAYMENT_QR_ROUTE) and resolves to its link. Rejects with a readable
 * message for a wrong type, an oversized file or a refused upload.
 */
export async function uploadPaymentQrImage(councilId: number, file: File): Promise<string> {
  if (!PAYMENT_QR_TYPES[file.type.toLowerCase()]) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (file.size > PAYMENT_QR_MAX_BYTES) throw new Error(`The image is larger than ${PAYMENT_QR_MAX_BYTES / (1024 * 1024)} MB.`);
  const form = new FormData();
  form.append('councilId', String(councilId));
  form.append('file', file);
  const res = await fetch(PAYMENT_QR_ROUTE, { method: 'POST', body: form, credentials: 'same-origin' });
  const answer = (await res.json().catch(() => null)) as { url?: string; message?: string } | null;
  if (!res.ok || !answer?.url) throw new Error(answer?.message ?? `The server answered HTTP ${res.status}.`);
  return answer.url;
}

/** A compact QR preview: the image when the link can be shown, else a small placeholder. */
export function QrThumbnail({ url, name, className }: { url: string | null | undefined; name: string; className?: string }) {
  return (
    <span className={cx('inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-white', className)}>
      {showable(url) ? <img src={url} alt={`${name} QR code`} className="size-full object-contain" /> : <span className="px-0.5 text-center text-[10px] leading-tight text-muted">{url ? 'Saved' : 'None'}</span>}
    </span>
  );
}

function QrRow({ council, row, name, onSaved }: { council: Council; row: CouncilDonationMethod; name: string; onSaved: () => Promise<unknown> }) {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    setBusy(true);
    try {
      const url = await uploadPaymentQrImage(council.id, file);
      await db.lookups.saveCouncilSpecific(user.memberId, council.id, 'CouncilDonationMethod', [
        {
          id: row.id,
          DonationMethodID: row.DonationMethodID,
          DonationMethodURL: url,
          account_owner_entity: row.account_owner_entity ?? 'COUNCIL',
          account_identity_label: row.account_identity_label ?? null,
          lookup_status: row.lookup_status ?? 'Active',
          account_id: row.account_id ?? null,
        },
      ]);
      await onSaved();
      setMessage({ tone: 'info', text: `The ${name} QR code is saved. The phone shows it to donors.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const inputId = `qr-upload-${row.id}`;
  // Sprint 11 Revision 1.0: Cash, Check, card readers and Physical Items take no QR code; the control is disabled.
  if (!methodAcceptsQrCode(name)) {
    return (
      <li className="flex items-center gap-3 rounded border-2 border-line bg-white p-2 opacity-70" aria-disabled="true">
        <QrThumbnail url={null} name={name} />
        <span className="font-bold text-navy">{name}</span>
        <span className="text-xs text-muted">No QR code for this payment method.</span>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-4 rounded border-2 border-navy bg-white p-3">
      <div className="flex size-24 shrink-0 items-center justify-center rounded border border-line bg-white">
        {showable(row.DonationMethodURL) ? (
          <img src={row.DonationMethodURL} alt={`${name} QR code`} className="size-full object-contain" />
        ) : (
          <span className="px-1 text-center text-xs text-muted">No QR code yet</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-bold text-navy">{name}</span>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files?.[0]);
          }}
          className={cx(
            'flex cursor-pointer flex-col items-center rounded border-2 border-dashed px-3 py-3 text-center text-sm',
            dragging ? 'border-gold bg-gold/20' : 'border-navy hover:bg-gold/10',
            busy && 'pointer-events-none opacity-60',
          )}
        >
          <span className="font-bold">{busy ? 'Uploading…' : UPLOAD_QR_CODE_LABEL}</span>
          <span className="text-xs text-muted">Drop the image here or click to choose it (PNG, JPEG or WebP, up to 5 MB).</span>
          <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
      </div>
    </li>
  );
}

export function PaymentQrUploader({ council }: { council: Council }) {
  const user = useUser();
  const allowed = canManageCouncilLookups(user, council.id, 'CouncilDonationMethod');
  const data = useLoad(async () => {
    if (!allowed) return null;
    const [rows, methods] = await Promise.all([db.lookups.listCouncilSpecific(user.memberId, council.id, 'CouncilDonationMethod'), db.donations.listMethods(council.id)]);
    return { rows, names: new Map(methods.map((o) => [o.method.id, o.method.DonationMethod])) };
  }, [allowed, user.memberId, council.id]);
  if (!allowed) return null;
  return (
    <Panel title="Payment QR Codes" className="mt-6">
      <p className="mb-3 text-sm">The QR code donors scan for each enabled payment method. Upload the image your Venmo, Zelle or Square account gives you.</p>
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      {data.data && data.data.rows.length === 0 ? <Empty>No payment methods are enabled yet. Enable them on Council Lookups.</Empty> : null}
      <ul className="flex flex-col gap-3">
        {(data.data?.rows ?? []).map((row) => (
          <QrRow key={row.id} council={council} row={row} name={data.data!.names.get(row.DonationMethodID) ?? `Method ${row.DonationMethodID}`} onSaved={data.reload} />
        ))}
      </ul>
    </Panel>
  );
}
