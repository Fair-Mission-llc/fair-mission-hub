'use client';
// Sprint 11 Revision 2.0: moved from apps/web/app/expenses/assets/page.tsx so the Admin Desk drawers mount the same module; the page renders CouncilAssets.
// Council Assets (Sprint 6P): the asset form and the assets inventory. When the Grand Knight counter-signs a sheet marked
// "This item is a long-term Council Asset" on the Authorization Desk, the workflow engine writes its CouncilAssetsInventory
// row and the desk opens this page at ?asset=<id>. The name and cost basis come from the sheet; the approver adds the
// serial number, where the item is kept and notes (expenses.updateAssetRecord). Without ?asset the page lists the
// inventory. Open to the council's expense leadership, its Grand Knight and (Sprint 7F Extension 2) its Deputy Grand
// Knight (canManageCouncilAssets); the drivers check assertMayManageCouncilAssets.
// Sprint 7F: the Asset Photo Vault. The form takes one image per asset and saves it at once as photo_url; the inventory
// shows each photo as a thumbnail. Sprint 7F Extension 2: every upload goes through /api/assets/photo to the council's
// Google Drive, under Fraternal Enterprise Suite / Assets / <asset name>, whoever sends it, and photo_url keeps the Drive
// file id, drawn through Drive's thumbnail service. The council's Trustees may open the inventory and add photos too
// (canAttachAssetPhoto); only the asset managers change the other details.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  ASSET_LOCATION_MAX_LENGTH,
  ASSET_NAME_MAX_LENGTH,
  ASSET_NOTES_MAX_LENGTH,
  ASSET_SERIAL_MAX_LENGTH,
  assetFormPath,
  canAttachAssetPhoto,
  canManageCouncilAssets,
  COUNCIL_ASSET_STATUSES,
  describeError,
  formatDate,
  type CouncilAssetsInventory,
  type CouncilAssetStatus,
} from '@kofc/shared';
import { CouncilSelect, useCouncilScope } from '@/components/CouncilScope';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { photoSrc } from '@/lib/media';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** Where asset photos are uploaded (Sprint 7F Extension; Google Drive since Extension 2). */
const ASSET_PHOTO_ROUTE = '/api/assets/photo';

/** Files the image in the council's Drive under Assets / <asset name> and answers its Drive file id; throws the server's reason. */
async function uploadAssetPhoto(asset: Pick<CouncilAssetsInventory, 'council_id' | 'asset_name'>, file: File): Promise<string> {
  const form = new FormData();
  form.set('councilId', String(asset.council_id));
  form.set('assetName', asset.asset_name);
  form.set('file', file);
  const res = await fetch(ASSET_PHOTO_ROUTE, { method: 'POST', body: form }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { saved?: boolean; fileId?: string; message?: string } | null;
  if (!res?.ok || !body?.saved || !body.fileId) throw new Error(body?.message ?? 'Google Drive did not save the photo. Try again.');
  return body.fileId;
}

/** An asset's photo, or a dashed placeholder; `size` is the square edge in pixels. */
function AssetPhoto({ asset, size }: { asset: Pick<CouncilAssetsInventory, 'asset_name' | 'photo_url'>; size: number }) {
  const src = asset.photo_url ? photoSrc(asset.photo_url) : null;
  return src ? (
    <img src={src} alt={`Photo of ${asset.asset_name}`} width={size} height={size} className="rounded border-2 border-navy object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex items-center justify-center rounded border-2 border-dashed border-line text-center text-xs text-muted"
      style={{ width: size, height: size }}
    >
      No photo
    </span>
  );
}

const STATUS_LABELS: Record<CouncilAssetStatus, string> = { ACTIVE: 'Active', DISPOSED: 'Disposed', LOST: 'Lost' };

const purchaseDay = (asset: CouncilAssetsInventory) => formatDate(asset.purchase_date.slice(0, 10));

function AssetForm({ asset, fromApproval }: { asset: CouncilAssetsInventory; fromApproval: boolean }) {
  const user = useUser();
  // The Deputy Grand Knight and Trustees add photos; only the asset managers edit the other details.
  const mayEdit = canManageCouncilAssets(user, asset.council_id);
  const [name, setName] = useState(asset.asset_name);
  const [status, setStatus] = useState<CouncilAssetStatus>(asset.current_status);
  const [serial, setSerial] = useState(asset.serial_number ?? '');
  const [location, setLocation] = useState(asset.storage_location ?? '');
  const [notes, setNotes] = useState(asset.notes ?? '');
  const [photo, setPhoto] = useState<string | null>(asset.photo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.expenses.updateAssetRecord(user.memberId, asset.id, {
        asset_name: name,
        current_status: status,
        serial_number: serial,
        storage_location: location,
        notes,
      });
      setMessage({ tone: 'info', text: `Saved the details of ${saved.asset_name}.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const savePhoto = async (file: File | null) => {
    setBusy(true);
    setMessage(null);
    try {
      let link: string | null = null;
      if (file) {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`);
        link = await uploadAssetPhoto({ council_id: asset.council_id, asset_name: name.trim() || asset.asset_name }, file);
      }
      const saved = await db.expenses.setAssetPhoto(user.memberId, asset.id, link);
      setPhoto(saved.photo_url ?? null);
      setMessage({ tone: 'info', text: link ? `Saved the photo of ${saved.asset_name}.` : `Removed the photo of ${saved.asset_name}.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Asset Management">
      <div className="flex flex-col gap-4">
        {fromApproval ? (
          <Notice tone="info">
            Expense report #{asset.original_expense_id} is approved and was entered as a council asset. Add the serial number, where the item is
            kept and any notes, then save.
          </Notice>
        ) : null}
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        <dl className="grid gap-3 rounded border border-line p-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-bold">Cost basis</dt>
            <dd>{formatMoney(asset.cost_basis)}</dd>
          </div>
          <div>
            <dt className="font-bold">Purchase date</dt>
            <dd>{purchaseDay(asset)}</dd>
          </div>
          <div>
            <dt className="font-bold">From expense report</dt>
            <dd>{asset.original_expense_id ? `#${asset.original_expense_id}` : 'None'}</dd>
          </div>
        </dl>
        <section aria-label="Asset photo" className="flex flex-wrap items-center gap-4 rounded border-2 border-navy p-3">
          <AssetPhoto asset={{ asset_name: asset.asset_name, photo_url: photo }} size={128} />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">Asset photo</p>
            <p className="text-xs text-muted">One picture of the item, filed in the council Google Drive under Assets / {asset.asset_name} as soon as you choose it.</p>
            <label className="inline-flex cursor-pointer items-center rounded border-2 border-navy bg-white px-3 py-1 text-sm font-bold hover:bg-gold">
              {photo ? 'Replace photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  if (file) void savePhoto(file);
                }}
              />
            </label>
            {photo ? (
              <button type="button" disabled={busy} onClick={() => void savePhoto(null)} className="self-start text-sm font-bold underline">
                Remove photo
              </button>
            ) : null}
          </div>
        </section>
        {!mayEdit ? (
          <dl className="grid gap-3 rounded border border-line p-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-bold">Asset name</dt>
              <dd>{asset.asset_name}</dd>
            </div>
            <div>
              <dt className="font-bold">Status</dt>
              <dd>{STATUS_LABELS[asset.current_status]}</dd>
            </div>
            <div>
              <dt className="font-bold">Serial number</dt>
              <dd>{asset.serial_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-bold">Storage location</dt>
              <dd>{asset.storage_location ?? '—'}</dd>
            </div>
          </dl>
        ) : null}
        {mayEdit ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Asset name">{(id) => <Input id={id} value={name} maxLength={ASSET_NAME_MAX_LENGTH} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as CouncilAssetStatus)}>
                {COUNCIL_ASSET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Serial number">
            {(id) => <Input id={id} value={serial} maxLength={ASSET_SERIAL_MAX_LENGTH} onChange={(e) => setSerial(e.target.value)} />}
          </Field>
          <Field label="Storage location">
            {(id) => (
              <Input id={id} value={location} maxLength={ASSET_LOCATION_MAX_LENGTH} placeholder="For example: parish hall closet" onChange={(e) => setLocation(e.target.value)} />
            )}
          </Field>
        </div>
        ) : null}
        {mayEdit ? (
          <Field label="Notes">{(id) => <Textarea id={id} rows={4} value={notes} maxLength={ASSET_NOTES_MAX_LENGTH} onChange={(e) => setNotes(e.target.value)} />}</Field>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {mayEdit ? (
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save asset details'}
            </Button>
          ) : null}
          <Link href="/expenses/assets" className="self-center text-sm font-bold underline">
            Back to the assets inventory
          </Link>
        </div>
      </div>
    </Panel>
  );
}

function Inventory({ councilId }: { councilId: number }) {
  const user = useUser();
  const router = useRouter();
  const list = useLoad(() => db.expenses.listAssetsInventory(user.memberId, councilId), [user.memberId, councilId]);
  return (
    <Panel title="Assets Inventory">
      {list.error ? <Notice tone="error">{list.error}</Notice> : null}
      {list.data && list.data.length === 0 ? <Empty>No council assets yet. An approved expense report marked as a long-term asset adds one.</Empty> : null}
      {list.data && list.data.length > 0 ? (
        <Table caption="Council assets" head={['Photo', 'Asset', 'Purchased', 'Cost basis', 'Serial number', 'Kept at', 'Status', '']}>
          {list.data.map((a) => (
            <tr key={a.id}>
              <Td>
                <AssetPhoto asset={a} size={48} />
              </Td>
              <Td>{a.asset_name}</Td>
              <Td>{purchaseDay(a)}</Td>
              <Td>{formatMoney(a.cost_basis)}</Td>
              <Td>{a.serial_number ?? '—'}</Td>
              <Td>{a.storage_location ?? '—'}</Td>
              <Td>
                <Pill tone={a.current_status === 'ACTIVE' ? 'navy' : 'outline'}>{STATUS_LABELS[a.current_status]}</Pill>
              </Td>
              <Td>
                <Button size="sm" variant="secondary" onClick={() => router.push(assetFormPath(a.id))}>
                  {canManageCouncilAssets(user, a.council_id) ? 'Edit' : 'Add photo'}
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      ) : null}
    </Panel>
  );
}

/**
 * Sprint 11 Revision 2.0: the inventory alone, for the Admin Desk drawer. A row's Edit button leads to /expenses/assets?asset=<id>,
 * where the record form opens.
 */
export function CouncilAssetInventory() {
  const user = useUser();
  const scope = useCouncilScope();
  if (!canAttachAssetPhoto(user, scope.councilId)) {
    return <Notice tone="info">Only this council&apos;s Grand Knight, Deputy Grand Knight, Trustees, Admins, Financial Secretary and Treasurer, or a Super Admin, open its assets.</Notice>;
  }
  return (
    <div className="flex flex-col gap-3">
      <CouncilSelect scope={scope} />
      <Inventory councilId={scope.councilId} />
    </div>
  );
}

export function CouncilAssets() {
  const user = useUser();
  const scope = useCouncilScope();
  const params = useSearchParams();
  const assetId = Number(params.get('asset')) || null;
  const fromApproval = params.get('from') === 'approval';
  const asset = useLoad(() => (assetId === null ? Promise.resolve(null) : db.expenses.getAssetRecord(user.memberId, assetId)), [assetId, user.memberId]);
  const allowed = canAttachAssetPhoto(user, asset.data?.council_id ?? scope.councilId);

  return (
    <>
      <PageTitle actions={assetId === null ? <CouncilSelect scope={scope} /> : undefined}>Council Assets</PageTitle>
      {!allowed ? (
        <Notice tone="error">
          Only this council&apos;s Grand Knight, Deputy Grand Knight, Trustees, Admins, Financial Secretary and Treasurer, or a Super Admin, open its assets.
        </Notice>
      ) : assetId === null ? (
        <Inventory councilId={scope.councilId} />
      ) : (
        <>
          {asset.error ? <Notice tone="error">{asset.error}</Notice> : null}
          {asset.loading && !asset.data ? <p className="text-sm text-muted">Loading the asset…</p> : null}
          {asset.data ? <AssetForm key={asset.data.id} asset={asset.data} fromApproval={fromApproval} /> : null}
        </>
      )}
    </>
  );
}
