// The shared asset photo folder on the portal server's disk (Sprint 7F Extension). SERVER ONLY.
//
// Asset photos used to go to the Google Drive vault only when an Admin uploaded them, and stayed a browser-only link
// otherwise. Now every officer cleared for the inventory (mayAttachAssetPhoto: the asset managers, the Deputy Grand
// Knight and the Trustees) uploads to /api/assets/photo, which saves the image here and answers its portal path,
// /api/media/assets/<council>/<file>. The path is what CouncilAssetsInventory.photo_url stores, so the photo lasts
// across sessions and browsers. /api/media/assets serves it back to signed-in members.
//
//   ASSET_MEDIA_DIR   where the files go; default <server working directory>/.media/assets (git-ignored)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

if (typeof window !== 'undefined') throw new Error('services/server/asset-media.ts was loaded in a browser.');

/** Largest photo accepted. */
export const ASSET_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** The portal path prefix photo_url values start with. */
export const ASSET_MEDIA_ROUTE = '/api/media/assets';

/** The image types accepted, by the bytes they start with (the browser's own type is not trusted). */
const SIGNATURES: { ext: string; type: string; test: (b: Uint8Array) => boolean }[] = [
  { ext: 'jpg', type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', type: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'gif', type: 'image/gif', test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { ext: 'webp', type: 'image/webp', test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
  { ext: 'heic', type: 'image/heic', test: (b) => ascii(b, 4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1|hevc)$/.test(ascii(b, 8, 12)) },
];

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to));
}

/** A stored file name: a UUID and one of the extensions above, nothing else (no paths). */
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp|heic)$/;

export const assetMediaDir = (env: Record<string, string | undefined> = process.env): string =>
  // turbopackIgnore: photos are runtime data, so the build must not trace (and bundle) this folder.
  resolve(/*turbopackIgnore: true*/ env.ASSET_MEDIA_DIR?.trim() || join(/*turbopackIgnore: true*/ process.cwd(), '.media', 'assets'));

/** The image's extension and type, or null when the bytes are not an accepted image. */
export function sniffAssetImage(bytes: Uint8Array): { ext: string; type: string } | null {
  const hit = SIGNATURES.find((s) => bytes.length >= 12 && s.test(bytes));
  return hit ? { ext: hit.ext, type: hit.type } : null;
}

/** Saves the image under the council's folder and answers its portal path. */
export async function saveAssetPhoto(councilId: number, bytes: Uint8Array, ext: string, dir = assetMediaDir()): Promise<string> {
  const name = `${globalThis.crypto.randomUUID()}.${ext}`;
  const folder = join(/*turbopackIgnore: true*/ dir, String(councilId));
  await mkdir(folder, { recursive: true });
  await writeFile(join(/*turbopackIgnore: true*/ folder, name), bytes);
  return `${ASSET_MEDIA_ROUTE}/${councilId}/${name}`;
}

/** The stored image for a council id and file name, or null for a bad name or a missing file. */
export async function readAssetPhoto(council: string, file: string, dir = assetMediaDir()): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (!/^\d{1,9}$/.test(council) || !FILE_NAME.test(file)) return null;
  try {
    const bytes = new Uint8Array(await readFile(join(/*turbopackIgnore: true*/ dir, council, file)));
    const kind = sniffAssetImage(bytes);
    return kind ? { bytes, type: kind.type } : null;
  } catch {
    return null;
  }
}
