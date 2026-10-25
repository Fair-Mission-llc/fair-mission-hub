// The Local Network Server file repository on the portal server (Sprint 10 Revision 3.1, shared file-repository.ts).
//
// When a council's Council.file_repository_mode is 'LOCAL_NETWORK', every upload route hands the bytes to
// fileIntoRepository before it ever looks at Google Drive. The server writes the file to
//   <file_server_path>\<folder>\<server-chosen file name>
// and answers a portal link (fileRepositoryRef) that the record stores. Nothing is written to the uploader's computer
// or phone, and the browser never learns the share's path. /api/file-repository serves the file back to a signed-in
// member of that council (or a Super Admin) through readFromRepository.
//
// Signing in to the share: on Windows, when the council saved a service account username and the Credentials Vault
// holds FILE_SERVER_PASSWORD, the server connects the share root once per process with `net use` (execFile, no shell).
// Without a username the portal server's own Windows account must be able to write to the share. Off Windows the path
// must already be mounted. The password exists only inside this function call; it is never logged.
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
  repositoryFileName,
  uncShareRoot,
  type FileRepositoryFolder,
  type FileRepositorySettings,
} from '@kofc/shared';
import { credentialsVault } from '@/services/server/credentials-vault';
import { memberDirectory } from '@/services/server/session';

const run = promisify(execFile);
/** Share roots this server process has already connected with `net use`. */
const connected = new Set<string>();

/** The council's saved repository settings, read from the server's own data copy. */
export async function councilRepositorySettings(councilId: number): Promise<FileRepositorySettings> {
  return councilFileRepository(await (await memberDirectory()).councils.get(councilId));
}

async function connectShare(councilId: number, settings: FileRepositorySettings): Promise<void> {
  const path = settings.file_server_path!;
  const root = uncShareRoot(path);
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

/**
 * Files `bytes` on the council's network share when its mode is LOCAL_NETWORK and answers the portal link to store;
 * answers null in CLOUD mode, so the route carries on to Google Drive as before. Throws when the share refuses the write.
 */
export async function fileIntoRepository(
  councilId: number,
  file: { folder: FileRepositoryFolder; prefix: string; originalName: string; bytes: Uint8Array },
): Promise<string | null> {
  const settings = await councilRepositorySettings(councilId);
  if (settings.file_repository_mode !== 'LOCAL_NETWORK' || !settings.file_server_path) return null;
  await connectShare(councilId, settings);
  const name = repositoryFileName(file.prefix, file.originalName, randomBytes(6).toString('hex'));
  const dir = join(/*turbopackIgnore: true*/ settings.file_server_path, file.folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(/*turbopackIgnore: true*/ dir, name), file.bytes);
  console.info(`[file-repository] council ${councilId} filed ${file.folder}/${name} on its network share.`);
  return fileRepositoryRef(councilId, file.folder, name);
}

/** The bytes behind a stored link, or null when the link is malformed or the council is not on a network share. */
export async function readFromRepository(ref: string): Promise<{ councilId: number; fileName: string; bytes: Buffer } | null> {
  const parts = parseFileRepositoryRef(ref);
  if (!parts) return null;
  const settings = await councilRepositorySettings(parts.councilId);
  if (!settings.file_server_path) return null;
  await connectShare(parts.councilId, settings);
  const bytes = await readFile(join(/*turbopackIgnore: true*/ settings.file_server_path, parts.folder, parts.fileName));
  return { councilId: parts.councilId, fileName: parts.fileName, bytes };
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
