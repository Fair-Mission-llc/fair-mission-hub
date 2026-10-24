// Sprint 9 Revision 4.0: where a deposit photo is kept. On the phone's own database it stays in the app's media folder
// (the path the camera tile saved). In hub mode the photo is uploaded to the hub laptop (POST /api/sync/photo), which
// keeps it beside the vault for every later session, and the hub's path is what TransactionAttachments stores.
import { HUB_PHOTO_ROUTE } from '@kofc/shared';
import { HUB_MODE, HUB_URL } from './db';

/** The path to store for a photo the camera saved at `localUri`. */
export async function storeDepositPhoto(localUri: string): Promise<string> {
  if (!HUB_MODE) return localUri;
  const photo = await (await fetch(localUri)).blob();
  const res = await fetch(`${HUB_URL}${HUB_PHOTO_ROUTE}`, {
    method: 'POST',
    headers: { 'Content-Type': /\.png$/i.test(localUri) ? 'image/png' : 'image/jpeg' },
    credentials: 'include',
    body: photo,
  });
  const body = (await res.json().catch(() => null)) as { path?: string; message?: string } | null;
  if (!res.ok || !body?.path) throw new Error(body?.message ?? `The hub did not keep the photo (${res.status}).`);
  return body.path;
}
