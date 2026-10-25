// =========================================================================
// FILE REPOSITORY MODE (Sprint 10 Revision 3.1, schema version 101)
//
// Where the portal server files the documents and photos people upload - receipts, minutes, gallery and meeting photos,
// oral history recordings, asset photos and check photos:
//   - 'CLOUD'          the council's Google Drive vault (the default, as before);
//   - 'LOCAL_NETWORK'  a file server on the council's own network. The server writes each file to
//                      Council.file_server_path (a UNC path such as \\hall-server\kofc), signed in as
//                      Council.file_server_username with the password sealed in the Credentials Vault
//                      (FILE_SERVER_PASSWORD). Nothing is kept on the uploader's own computer or phone.
// A file written to the network share is stored in its record as a portal link (fileRepositoryRef), which only a
// signed-in member of that council (or a Super Admin) can open through /api/file-repository.
// The council's Active Admins and Super Admins change the mode (councils.setFileRepositorySettings).
// =========================================================================
import { assertMayMaintainCouncilRecords, BusinessRuleError, optionalText, type MemberWriteActor } from './rules';
import type { Council } from './types';

export const FILE_REPOSITORY_MODES = [
  { id: 'CLOUD', label: 'Cloud (Google Drive vault)' },
  { id: 'LOCAL_NETWORK', label: 'Local Network Server' },
] as const;
export type FileRepositoryMode = (typeof FILE_REPOSITORY_MODES)[number]['id'];

/** The Credentials Vault key that holds the file server's service account password. */
export const FILE_SERVER_PASSWORD_KEY = 'FILE_SERVER_PASSWORD';
export const FILE_SERVER_PATH_MAX_LENGTH = 260;
export const FILE_SERVER_USERNAME_MAX_LENGTH = 100;
/** The portal route that serves a file kept on a council's network share. */
export const FILE_REPOSITORY_ROUTE = '/api/file-repository';

/** The folders a network share is split into, one per kind of upload. */
export const FILE_REPOSITORY_FOLDERS = ['Minutes', 'Vouchers', 'Media', 'Flyers', 'Meeting_Photos', 'Oral_Histories', 'Assets', 'Check_Photos'] as const;
export type FileRepositoryFolder = (typeof FILE_REPOSITORY_FOLDERS)[number];

export interface FileRepositorySettings {
  file_repository_mode: FileRepositoryMode;
  file_server_path: string | null;
  file_server_username: string | null;
}

/** \\host\share, then any number of \folder parts; host may be a name or an IPv4 address. */
const UNC = /^\\\\[A-Za-z0-9][A-Za-z0-9.-]*\\[^\\/:*?"<>|]+(\\[^\\/:*?"<>|]+)*\\?$/;

export const isFileRepositoryMode = (value: unknown): value is FileRepositoryMode => FILE_REPOSITORY_MODES.some((m) => m.id === value);

/** A council's stored settings; a missing mode reads as CLOUD. */
export function councilFileRepository(council: Partial<Pick<Council, 'file_repository_mode' | 'file_server_path' | 'file_server_username'>> | null | undefined): FileRepositorySettings {
  const mode = council?.file_repository_mode;
  return {
    file_repository_mode: isFileRepositoryMode(mode) ? mode : 'CLOUD',
    file_server_path: council?.file_server_path ?? null,
    file_server_username: council?.file_server_username ?? null,
  };
}

/**
 * councils.setFileRepositorySettings's input, checked. LOCAL_NETWORK needs a UNC path; the username is optional (the
 * portal server's own Windows account is used without one). CLOUD keeps whatever path was saved, so switching back is
 * one click. INVALID_INPUT names the field.
 */
export function cleanFileRepositorySettings(input: Partial<FileRepositorySettings>): FileRepositorySettings {
  if (input === null || typeof input !== 'object') throw new BusinessRuleError('INVALID_INPUT', 'Send the file repository settings as an object.', {});
  if (!isFileRepositoryMode(input.file_repository_mode)) {
    throw new BusinessRuleError('INVALID_INPUT', 'Choose Cloud or Local Network Server as the file repository mode.', { field: 'file_repository_mode' });
  }
  const path = optionalText(input.file_server_path, 'Server network address', FILE_SERVER_PATH_MAX_LENGTH);
  const username = optionalText(input.file_server_username, 'Service account username', FILE_SERVER_USERNAME_MAX_LENGTH);
  if (path !== null && !UNC.test(path)) {
    throw new BusinessRuleError('INVALID_INPUT', 'Enter the server network address as a UNC path, for example \\\\hall-server\\kofc or \\\\192.168.1.20\\kofc.', {
      field: 'file_server_path',
    });
  }
  if (input.file_repository_mode === 'LOCAL_NETWORK' && path === null) {
    throw new BusinessRuleError('INVALID_INPUT', 'Local Network Server needs the server network address.', { field: 'file_server_path' });
  }
  return { file_repository_mode: input.file_repository_mode, file_server_path: path, file_server_username: username };
}

/** Who changes where the council's files go: its Active Admins and any Active Super Admin. */
export function assertMaySetFileRepository(actor: MemberWriteActor, councilId: number): void {
  assertMayMaintainCouncilRecords(actor, councilId, "change where the council's files are kept");
}

/** The share root of a UNC path: \\host\share. */
export function uncShareRoot(path: string): string {
  const parts = path.replace(/\\+$/, '').split('\\').filter(Boolean);
  return `\\\\${parts[0]}\\${parts[1]}`;
}

const SAFE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

/** The link stored in a record for a file kept on council `councilId`'s share: folder and file name only, never a path. */
export function fileRepositoryRef(councilId: number, folder: FileRepositoryFolder, fileName: string): string {
  if (!SAFE_PART.test(fileName)) throw new BusinessRuleError('INVALID_INPUT', 'The stored file name has characters a file server does not allow.', {});
  return `${FILE_REPOSITORY_ROUTE}?file=c${councilId}/${folder}/${fileName}`;
}

/** The parts of a stored link, or null when it is not one (or names a folder or file outside the rules). */
export function parseFileRepositoryRef(ref: string): { councilId: number; folder: FileRepositoryFolder; fileName: string } | null {
  const m = /^\/api\/file-repository\?file=c(\d+)\/([A-Za-z_]+)\/([^/?#]+)$/.exec(ref);
  if (!m) return null;
  const folder = m[2] as FileRepositoryFolder;
  if (!FILE_REPOSITORY_FOLDERS.includes(folder) || !SAFE_PART.test(m[3]!)) return null;
  return { councilId: Number(m[1]), folder, fileName: m[3]! };
}

export const isFileRepositoryRef = (value: string): boolean => parseFileRepositoryRef(value) !== null;

/** A file name the server picks for an upload: kind, time, random part and the original extension. */
export function repositoryFileName(prefix: string, originalName: string, random: string, now = Date.now()): string {
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(originalName)?.[1]?.toLowerCase() ?? 'bin';
  return `${prefix.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'file'}-${now}-${random.replace(/[^a-z0-9]/gi, '')}.${ext}`;
}
