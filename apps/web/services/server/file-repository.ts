// The council file repository on the portal server (Sprint 10 Revision 3.1; four providers since Revision 3.2, shared
// file-repository.ts).
//
// Every upload route hands its bytes to fileIntoRepository before it looks at Google Drive. For a council whose provider
// is ONEDRIVE_SHAREPOINT, DROPBOX_BUSINESS or LOCAL_NETWORK_SERVER the server files the bytes there and answers a portal
// link (fileRepositoryRef, naming the provider) that the record stores; for GOOGLE_DRIVE it answers null and the route
// carries on to the Drive vault as before. Nothing is written to the uploader's computer or phone, and the browser never
// learns a path, URL or key. /api/file-repository serves a stored link back through readFromRepository, which follows the
// provider named in the link - so files filed before a council changes provider still open while the old provider's
// settings and keys are saved.
//
//   ONEDRIVE_SHAREPOINT   Microsoft Graph, app-only: a client-credentials token for the tenant behind the site's host
//                         (<name>.onmicrosoft.com), then PUT / GET /sites/{host}:{site}:/drive/root:/{folder}/{file}:/content.
//                         The client secret is the vault's ONEDRIVE_CLIENT_SECRET.
//   DROPBOX_BUSINESS      the Dropbox content API (files/upload, files/download) under the saved team folder path, with
//                         the vault's DROPBOX_ACCESS_TOKEN.
//   LOCAL_NETWORK_SERVER  the share at the saved UNC path. On Windows, with a saved username and the vault's
//                         FILE_SERVER_PASSWORD, the server connects the share root once per process with `net use`
//                         (execFile, no shell). Off Windows the path must already be mounted.
// Secrets exist only inside these calls; they are never logged.
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  councilFileRepository,
  describeError,
  FILE_SERVER_PASSWORD_KEY,
  fileRepositoryRef,
  parseFileRepositoryRef,
  OFFICIAL_MANUALS_FOLDER,
  DRIVE_VAULT_ROOT,
  repositoryFileName,
  repositoryFolderName,
  sharePointSiteParts,
  uncShareRoot,
  type FileRepositoryFolder,
  type FileRepositoryMode,
  type FileRepositorySettings,
} from '@kofc/shared';
import { councilDriveCredentials, councilDriveOffReason, credentialsVault, driveVaultClient } from '@/services/server/credentials-vault';
import { memberDirectory } from '@/services/server/session';

const run = promisify(execFile);
/** Share roots this server process has already connected with `net use`. */
const connected = new Set<string>();
/** Graph tokens by council, reused until a minute before they expire. */
const graphTokens = new Map<number, { token: string; expires: number }>();

type RemoteProvider = Exclude<FileRepositoryMode, 'GOOGLE_DRIVE'>;

/** The council's saved repository settings, read from the server's own data copy. */
export async function councilRepositorySettings(councilId: number): Promise<FileRepositorySettings> {
  return councilFileRepository(await (await memberDirectory()).councils.get(councilId));
}

// ---- Local Network Server --------------------------------------------------------------------------------------------

async function connectShare(councilId: number, settings: FileRepositorySettings): Promise<void> {
  const root = uncShareRoot(settings.file_server_path!);
  if (process.platform !== 'win32' || connected.has(root) || !settings.file_server_username) return;
  const password = credentialsVault().reveal(councilId, FILE_SERVER_PASSWORD_KEY);
  if (!password) return;
  try {
    await run('net', ['use', root, password, `/user:${settings.file_server_username}`, '/persistent:no'], { windowsHide: true, timeout: 20_000 });
  } catch (err) {
    // Error 1219 means this Windows session is already connected to the server; the write below still works.
    const text = describeError(err).replace(password, '•••');
    if (!/1219/.test(text)) console.warn(`[file-repository] could not connect ${root} for council ${councilId}: ${text}`);
  }
  connected.add(root);
}

// ---- OneDrive / SharePoint -----------------------------------------------------------------------------------------

async function graphToken(councilId: number, settings: FileRepositorySettings): Promise<string> {
  const cached = graphTokens.get(councilId);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const secret = credentialsVault().reveal(councilId, 'ONEDRIVE_CLIENT_SECRET');
  if (!secret || !settings.file_server_username || !settings.file_server_path) throw new Error('OneDrive / SharePoint is not fully set up: save the site URL, the client ID and the client secret.');
  const { tenant } = sharePointSiteParts(settings.file_server_path);
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: settings.file_server_username, client_secret: secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  });
  const answer = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !answer?.access_token) throw new Error(`Microsoft sign-in refused the app (HTTP ${res.status}).`);
  graphTokens.set(councilId, { token: answer.access_token, expires: Date.now() + (answer.expires_in ?? 3600) * 1000 });
  return answer.access_token;
}

const graphItemUrl = (settings: FileRepositorySettings, folder: FileRepositoryFolder, fileName: string) => {
  const { host, sitePath } = sharePointSiteParts(settings.file_server_path!);
  return `https://graph.microsoft.com/v1.0/sites/${host}:${sitePath}:/drive/root:/${encodeURIComponent(repositoryFolderName(folder))}/${encodeURIComponent(fileName)}:/content`;
};

// ---- Dropbox Business ----------------------------------------------------------------------------------------------

/** Dropbox-API-Arg must be ASCII: non-ASCII characters are written as JSON \u escapes. */
const dropboxArg = (value: object) => JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

function dropboxToken(councilId: number): string {
  const token = credentialsVault().reveal(councilId, 'DROPBOX_ACCESS_TOKEN');
  if (!token) throw new Error('Dropbox Business is not fully set up: save the access token on the Credentials Vault page.');
  return token;
}

const dropboxPath = (settings: FileRepositorySettings, folder: FileRepositoryFolder, fileName: string) => `${settings.file_server_path!.replace(/\/+$/, '')}/${repositoryFolderName(folder)}/${fileName}`;

// ---- filing and reading ----------------------------------------------------------------------------------------------

async function store(councilId: number, provider: RemoteProvider, settings: FileRepositorySettings, folder: FileRepositoryFolder, name: string, bytes: Uint8Array, overwrite = false): Promise<void> {
  switch (provider) {
    case 'LOCAL_NETWORK_SERVER': {
      await connectShare(councilId, settings);
      const dir = join(/*turbopackIgnore: true*/ settings.file_server_path!, repositoryFolderName(folder));
      await mkdir(dir, { recursive: true });
      await writeFile(join(/*turbopackIgnore: true*/ dir, name), bytes);
      return;
    }
    case 'ONEDRIVE_SHAREPOINT': {
      const res = await fetch(graphItemUrl(settings, folder, name), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${await graphToken(councilId, settings)}`, 'Content-Type': 'application/octet-stream' },
        body: new Blob([new Uint8Array(bytes)]),
      });
      if (!res.ok) throw new Error(`SharePoint refused the file (HTTP ${res.status}).`);
      return;
    }
    case 'DROPBOX_BUSINESS': {
      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${dropboxToken(councilId)}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': dropboxArg({ path: dropboxPath(settings, folder, name), mode: overwrite ? 'overwrite' : 'add', autorename: false, mute: true }),
        },
        body: new Blob([new Uint8Array(bytes)]),
      });
      if (!res.ok) throw new Error(`Dropbox refused the file (HTTP ${res.status}).`);
      return;
    }
  }
}

/**
 * Files `bytes` with the council's repository provider and answers the portal link to store; answers null for
 * GOOGLE_DRIVE, so the route carries on to the Drive vault. Throws when the provider refuses the file.
 */
export async function fileIntoRepository(
  councilId: number,
  file: { folder: FileRepositoryFolder; prefix: string; originalName: string; bytes: Uint8Array },
): Promise<string | null> {
  const settings = await councilRepositorySettings(councilId);
  const provider = settings.file_repository_mode;
  if (provider === 'GOOGLE_DRIVE' || !settings.file_server_path) return null;
  const name = repositoryFileName(file.prefix, file.originalName, randomBytes(6).toString('hex'));
  await store(councilId, provider, settings, file.folder, name, file.bytes);
  console.info(`[file-repository] council ${councilId} filed ${file.folder}/${name} with ${provider}.`);
  return fileRepositoryRef(councilId, file.folder, name, provider);
}

/** Where a compiled guide went: the provider and the place in words, or why it was not filed. */
export type ManualFilingResult = { saved: true; provider: FileRepositoryMode; location: string } | { saved: false; reason: string };

/**
 * Sprint 10 Revision 4.0: files a council's compiled custom guide in the 'Official Manuals' folder of its selected
 * provider, under the guide's own file name, replacing an older copy where the provider allows it. Google Drive uses the
 * council's Drive vault ('manual' kind); without Drive credentials nothing is filed and the reason is returned. Never
 * throws: a provider that refuses the file is reported, and the download goes on.
 */
export async function fileManualIntoRepository(councilId: number, fileName: string, pdf: Uint8Array): Promise<ManualFilingResult> {
  try {
    const settings = await councilRepositorySettings(councilId);
    const provider = settings.file_repository_mode;
    if (provider === 'GOOGLE_DRIVE') {
      const creds = councilDriveCredentials(councilId);
      if (!creds) return { saved: false, reason: councilDriveOffReason(councilId) };
      await driveVaultClient(creds).upload('manual', { name: fileName, mimeType: 'application/pdf', data: pdf });
      return { saved: true, provider, location: `Google Drive / ${DRIVE_VAULT_ROOT} / ${OFFICIAL_MANUALS_FOLDER} / ${fileName}` };
    }
    if (!settings.file_server_path) return { saved: false, reason: 'The file repository has no location saved yet.' };
    await store(councilId, provider, settings, 'Official_Manuals', fileName, pdf, true);
    return { saved: true, provider, location: `${OFFICIAL_MANUALS_FOLDER} / ${fileName}` };
  } catch (err) {
    console.error(`[file-repository] council ${councilId} could not file ${fileName}:`, describeError(err));
    return { saved: false, reason: 'The council file repository did not accept the guide.' };
  }
}

/** The bytes behind a stored link, or null when the link is malformed or the provider's settings are gone. */
export async function readFromRepository(ref: string): Promise<{ councilId: number; fileName: string; bytes: Buffer } | null> {
  const parts = parseFileRepositoryRef(ref);
  if (!parts) return null;
  const settings = await councilRepositorySettings(parts.councilId);
  if (!settings.file_server_path) return null;
  switch (parts.provider) {
    case 'LOCAL_NETWORK_SERVER': {
      await connectShare(parts.councilId, settings);
      return { ...parts, bytes: await readFile(join(/*turbopackIgnore: true*/ settings.file_server_path, repositoryFolderName(parts.folder), parts.fileName)) };
    }
    case 'ONEDRIVE_SHAREPOINT': {
      const res = await fetch(graphItemUrl(settings, parts.folder, parts.fileName), { headers: { Authorization: `Bearer ${await graphToken(parts.councilId, settings)}` } });
      return res.ok ? { ...parts, bytes: Buffer.from(await res.arrayBuffer()) } : null;
    }
    case 'DROPBOX_BUSINESS': {
      const res = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: { Authorization: `Bearer ${dropboxToken(parts.councilId)}`, 'Dropbox-API-Arg': dropboxArg({ path: dropboxPath(settings, parts.folder, parts.fileName) }) },
      });
      return res.ok ? { ...parts, bytes: Buffer.from(await res.arrayBuffer()) } : null;
    }
  }
}

/** The Content-Type for a served file, by extension. */
export function repositoryContentType(fileName: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    webm: 'audio/webm',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    txt: 'text/plain; charset=utf-8',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return types[ext] ?? 'application/octet-stream';
}
