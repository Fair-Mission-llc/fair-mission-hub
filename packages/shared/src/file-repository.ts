// =========================================================================
// FILE REPOSITORY PROVIDERS (Sprint 10 Revision 3.1, schema version 101; four providers since Revision 3.2)
//
// Where the portal server files the documents and photos people upload - receipts, minutes, gallery and meeting photos,
// oral history recordings, asset photos and check photos. Council.file_repository_mode holds one provider key:
//   - 'GOOGLE_DRIVE'          the council's Google Drive vault (the default). Its service-account key is the Credentials
//                             Vault's GOOGLE_DRIVE_PRIVATE_KEY.
//   - 'ONEDRIVE_SHAREPOINT'   a SharePoint document library through Microsoft Graph. file_server_path holds the SharePoint
//                             site URL, file_server_username the Azure app's Application (client) ID, and the vault's
//                             ONEDRIVE_CLIENT_SECRET the app's client secret.
//   - 'DROPBOX_BUSINESS'      a Dropbox Business team folder. file_server_path holds the folder path; the vault's
//                             DROPBOX_ACCESS_TOKEN the app's access token. No username.
//   - 'LOCAL_NETWORK_SERVER'  a file server on the council's own network. file_server_path holds the UNC path,
//                             file_server_username the service account; the vault's FILE_SERVER_PASSWORD its password.
// The schema stays at 101, so the two existing Council columns carry each provider's location and identity fields
// (FILE_REPOSITORY_PROVIDERS says which, in words), and every secret lives in the Secure Access Vault. Revision 3.1's stored
// values 'CLOUD' and 'LOCAL_NETWORK' still read as GOOGLE_DRIVE and LOCAL_NETWORK_SERVER (the column default is 'CLOUD').
// A file filed with ONEDRIVE_SHAREPOINT, DROPBOX_BUSINESS or LOCAL_NETWORK_SERVER is stored in its record as a portal link
// (fileRepositoryRef) naming the provider, which only a signed-in member of that council (or a Super Admin) can open
// through /api/file-repository. The council's Active Admins and Super Admins change the provider.
// =========================================================================
import { assertMayMaintainCouncilRecords, BusinessRuleError, optionalText, type MemberWriteActor } from './rules';
import type { Council } from './types';

export type FileRepositoryMode = 'GOOGLE_DRIVE' | 'ONEDRIVE_SHAREPOINT' | 'DROPBOX_BUSINESS' | 'LOCAL_NETWORK_SERVER';
/** The vault keys a provider's secret is saved under. */
export type FileRepositorySecretKey = 'GOOGLE_DRIVE_PRIVATE_KEY' | 'ONEDRIVE_CLIENT_SECRET' | 'DROPBOX_ACCESS_TOKEN' | 'FILE_SERVER_PASSWORD';

/** One input the File Repository Mode card shows for a provider; nothing else is shown. */
export interface FileRepositoryField {
  /** A Council column, or a Secure Access Vault key (kind 'secret', saved on the Secure Access Vault page). */
  key: 'file_server_path' | 'file_server_username' | FileRepositorySecretKey;
  kind: 'text' | 'secret';
  label: string;
  hint: string;
  required: boolean;
}

export interface FileRepositoryProvider {
  id: FileRepositoryMode;
  label: string;
  summary: string;
  fields: readonly FileRepositoryField[];
}

export const FILE_REPOSITORY_PROVIDERS: readonly FileRepositoryProvider[] = [
  {
    id: 'GOOGLE_DRIVE',
    label: 'Google Drive',
    summary: "Files go to the council's Google Drive vault.",
    fields: [{ key: 'GOOGLE_DRIVE_PRIVATE_KEY', kind: 'secret', label: 'Drive service-account key', hint: 'Saved on the Secure Access Vault page. Without it the portal Drive is used.', required: false }],
  },
  {
    id: 'ONEDRIVE_SHAREPOINT',
    label: 'OneDrive / SharePoint',
    summary: "Files go to a SharePoint document library through the council's Microsoft 365 app.",
    fields: [
      { key: 'file_server_path', kind: 'text', label: 'SharePoint Site URL', hint: 'For example https://stmarys.sharepoint.com/sites/kofc', required: true },
      { key: 'file_server_username', kind: 'text', label: 'Application (Client) ID', hint: "The Azure app registration's client ID (a GUID).", required: true },
      { key: 'ONEDRIVE_CLIENT_SECRET', kind: 'secret', label: 'Client Secret', hint: "The app's client secret, saved on the Secure Access Vault page.", required: true },
    ],
  },
  {
    id: 'DROPBOX_BUSINESS',
    label: 'Dropbox Business',
    summary: "Files go to a Dropbox Business team folder through the council's Dropbox app.",
    fields: [
      { key: 'file_server_path', kind: 'text', label: 'Team Folder Path', hint: 'For example /KofC Council 15295', required: true },
      { key: 'DROPBOX_ACCESS_TOKEN', kind: 'secret', label: 'Access Token', hint: "The Dropbox app's access token, saved on the Secure Access Vault page.", required: true },
    ],
  },
  {
    id: 'LOCAL_NETWORK_SERVER',
    label: 'Local Network Server',
    summary: "The portal server writes files to the council's own file server.",
    fields: [
      { key: 'file_server_path', kind: 'text', label: 'Server Network Address (UNC/IP Path)', hint: 'For example \\\\hall-server\\kofc or \\\\192.168.1.20\\kofc', required: true },
      { key: 'file_server_username', kind: 'text', label: 'Service Account Username', hint: "For example HALL\\kofc-portal. Leave it blank to use the portal server's own account.", required: false },
      { key: 'FILE_SERVER_PASSWORD', kind: 'secret', label: 'Service Account Password', hint: 'Saved on the Secure Access Vault page.', required: false },
    ],
  },
];

/** The dropdown's choices, in order (the four provider keys). */
export const FILE_REPOSITORY_MODES = FILE_REPOSITORY_PROVIDERS.map((p) => ({ id: p.id, label: p.label }));

/** Revision 3.1's stored values, still read correctly. */
const LEGACY_MODES: Readonly<Record<string, FileRepositoryMode>> = { CLOUD: 'GOOGLE_DRIVE', LOCAL_NETWORK: 'LOCAL_NETWORK_SERVER' };

/** The Secure Access Vault key that holds the file server's service account password. */
export const FILE_SERVER_PASSWORD_KEY = 'FILE_SERVER_PASSWORD';
export const FILE_SERVER_PATH_MAX_LENGTH = 260;
export const FILE_SERVER_USERNAME_MAX_LENGTH = 100;
/** The portal route that serves a file kept with a council's repository provider. */
export const FILE_REPOSITORY_ROUTE = '/api/file-repository';

/** The folders a repository is split into, one per kind of upload. */
export const FILE_REPOSITORY_FOLDERS = ['Minutes', 'Vouchers', 'Media', 'Flyers', 'Meeting_Photos', 'Oral_Histories', 'Assets', 'Check_Photos', 'Official_Manuals', 'Payment_QR_Codes'] as const;
export type FileRepositoryFolder = (typeof FILE_REPOSITORY_FOLDERS)[number];

/**
 * Sprint 10 Revision 4.0: the folder every provider files the council's compiled custom guides in - 'Official Manuals' at
 * the top of the repository (Google Drive: Fraternal Enterprise Suite / Official Manuals). A new copy of a guide replaces
 * the old one of the same name where the provider allows it.
 */
export const OFFICIAL_MANUALS_FOLDER = 'Official Manuals';

/** The folder's name on the provider: 'Official Manuals' (with its space) for the guides, the folder id otherwise. */
export const repositoryFolderName = (folder: FileRepositoryFolder): string =>
  folder === 'Official_Manuals' ? OFFICIAL_MANUALS_FOLDER : folder === 'Payment_QR_Codes' ? PAYMENT_QR_FOLDER : folder;

/**
 * Sprint 10 Revision 5.0: payment QR code images an Admin uploads for a donation method (Venmo, Zelle, Square...) on the
 * Standard Bank Accounts drawer. The link is saved in CouncilDonationMethod.DonationMethodURL. A council with its own
 * repository keeps them there ('Payment QR Codes'); a Google Drive council keeps them on the portal server, because a
 * Drive file would need a Google sign-in for the phone to show it to a donor.
 */
export const PAYMENT_QR_FOLDER = 'Payment QR Codes';
export const PAYMENT_QR_ROUTE = '/api/council/payment-qr';
export const PAYMENT_QR_MAX_BYTES = 5 * 1024 * 1024;
export const PAYMENT_QR_TYPES: Readonly<Record<string, string>> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const UPLOAD_QR_CODE_LABEL = '📁 Upload QR Code Image';

/** A link to a QR image kept on the portal server: c<council>/<file>. */
export const paymentQrServerUrl = (councilId: number, fileName: string): string => `${PAYMENT_QR_ROUTE}?file=c${councilId}/${fileName}`;

/** The council and file of a portal-server QR link, or null. */
export function parsePaymentQrServerUrl(url: string): { councilId: number; fileName: string } | null {
  const m = /^\/api\/council\/payment-qr\?file=c(\d+)\/(qr-[a-z0-9-]+\.(png|jpg|webp))$/.exec(url);
  return m ? { councilId: Number(m[1]), fileName: m[2]! } : null;
}

export interface FileRepositorySettings {
  file_repository_mode: FileRepositoryMode;
  file_server_path: string | null;
  file_server_username: string | null;
}

/** \\host\share, then any number of \folder parts; host may be a name or an IPv4 address. */
const UNC = /^\\\\[A-Za-z0-9][A-Za-z0-9.-]*\\[^\\/:*?"<>|]+(\\[^\\/:*?"<>|]+)*\\?$/;
const SHAREPOINT_SITE = /^https:\/\/[a-z0-9-]+\.sharepoint\.com\/(sites|teams)\/[A-Za-z0-9._-]+\/?$/i;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DROPBOX_PATH = /^\/[^\\:*?"<>|]{0,250}$/;

export const isFileRepositoryMode = (value: unknown): value is FileRepositoryMode => FILE_REPOSITORY_PROVIDERS.some((p) => p.id === value);

/** The provider for a stored mode; a missing or unknown value reads as GOOGLE_DRIVE. */
export function normalizeFileRepositoryMode(value: unknown): FileRepositoryMode {
  if (isFileRepositoryMode(value)) return value;
  return (typeof value === 'string' && LEGACY_MODES[value]) || 'GOOGLE_DRIVE';
}

export const fileRepositoryProvider = (mode: FileRepositoryMode): FileRepositoryProvider => FILE_REPOSITORY_PROVIDERS.find((p) => p.id === mode)!;

/** The fields the card shows for `mode` - and only those (the dynamic mask). */
export const fileRepositoryFields = (mode: FileRepositoryMode): readonly FileRepositoryField[] => fileRepositoryProvider(mode).fields;

/** A council's stored settings, with the legacy values read as their provider. */
export function councilFileRepository(council: Partial<Pick<Council, 'file_repository_mode' | 'file_server_path' | 'file_server_username'>> | null | undefined): FileRepositorySettings {
  return {
    file_repository_mode: normalizeFileRepositoryMode(council?.file_repository_mode),
    file_server_path: council?.file_server_path ?? null,
    file_server_username: council?.file_server_username ?? null,
  };
}

const invalid = (message: string, field: string) => new BusinessRuleError('INVALID_INPUT', message, { field });

/**
 * councils.setFileRepositorySettings's input, checked for the chosen provider. A column the provider does not use is
 * cleared, so a hidden field never keeps an old value. INVALID_INPUT names the field.
 */
export function cleanFileRepositorySettings(input: Partial<FileRepositorySettings> & { file_repository_mode?: unknown }): FileRepositorySettings {
  if (input === null || typeof input !== 'object') throw new BusinessRuleError('INVALID_INPUT', 'Send the file repository settings as an object.', {});
  const raw = input.file_repository_mode;
  const mode = isFileRepositoryMode(raw) ? raw : typeof raw === 'string' && LEGACY_MODES[raw] ? LEGACY_MODES[raw]! : null;
  if (!mode) throw invalid('Choose Google Drive, OneDrive / SharePoint, Dropbox Business or Local Network Server as the file repository provider.', 'file_repository_mode');
  const uses = new Set(fileRepositoryFields(mode).map((f) => f.key));
  const field = (key: 'file_server_path' | 'file_server_username', label: string, max: number) => (uses.has(key) ? optionalText(input[key], label, max) : null);
  const labelOf = (key: 'file_server_path' | 'file_server_username') => fileRepositoryFields(mode).find((f) => f.key === key)?.label ?? key;
  const path = field('file_server_path', labelOf('file_server_path'), FILE_SERVER_PATH_MAX_LENGTH);
  const username = field('file_server_username', labelOf('file_server_username'), FILE_SERVER_USERNAME_MAX_LENGTH);

  switch (mode) {
    case 'LOCAL_NETWORK_SERVER':
      if (path === null) throw invalid('Local Network Server needs the server network address.', 'file_server_path');
      if (!UNC.test(path)) throw invalid('Enter the server network address as a UNC path, for example \\\\hall-server\\kofc or \\\\192.168.1.20\\kofc.', 'file_server_path');
      break;
    case 'ONEDRIVE_SHAREPOINT':
      if (path === null || !SHAREPOINT_SITE.test(path)) throw invalid('Enter the SharePoint site URL, for example https://stmarys.sharepoint.com/sites/kofc.', 'file_server_path');
      if (username === null || !GUID.test(username)) throw invalid('Enter the Application (Client) ID: the GUID of the Azure app registration.', 'file_server_username');
      break;
    case 'DROPBOX_BUSINESS':
      if (path === null || !DROPBOX_PATH.test(path)) throw invalid('Enter the team folder path, starting with a slash, for example /KofC Council 15295.', 'file_server_path');
      break;
    case 'GOOGLE_DRIVE':
      break;
  }
  return { file_repository_mode: mode, file_server_path: path, file_server_username: username };
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

/** The SharePoint host and site path of a site URL, for Microsoft Graph: ['stmarys.sharepoint.com', '/sites/kofc']. */
export function sharePointSiteParts(url: string): { host: string; sitePath: string; tenant: string } {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  return { host, sitePath: u.pathname.replace(/\/+$/, ''), tenant: `${host.split('.')[0]}.onmicrosoft.com` };
}

/** The short provider code in a stored link. */
export const PROVIDER_REF_CODES: Readonly<Record<Exclude<FileRepositoryMode, 'GOOGLE_DRIVE'>, string>> = {
  ONEDRIVE_SHAREPOINT: 'od',
  DROPBOX_BUSINESS: 'dbx',
  LOCAL_NETWORK_SERVER: 'lan',
};
const PROVIDER_BY_CODE = Object.fromEntries(Object.entries(PROVIDER_REF_CODES).map(([k, v]) => [v, k])) as Record<string, Exclude<FileRepositoryMode, 'GOOGLE_DRIVE'>>;

const SAFE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

export interface FileRepositoryRefParts {
  councilId: number;
  provider: Exclude<FileRepositoryMode, 'GOOGLE_DRIVE'>;
  folder: FileRepositoryFolder;
  fileName: string;
}

/** The link stored in a record for a file kept with `provider`: provider, folder and file name only, never a path. */
export function fileRepositoryRef(councilId: number, folder: FileRepositoryFolder, fileName: string, provider: Exclude<FileRepositoryMode, 'GOOGLE_DRIVE'> = 'LOCAL_NETWORK_SERVER'): string {
  if (!SAFE_PART.test(fileName)) throw new BusinessRuleError('INVALID_INPUT', 'The stored file name has characters a file repository does not allow.', {});
  return `${FILE_REPOSITORY_ROUTE}?file=c${councilId}/${PROVIDER_REF_CODES[provider]}/${folder}/${fileName}`;
}

/** The parts of a stored link, or null when it is not one. Revision 3.1's links (no provider code) are network links. */
export function parseFileRepositoryRef(ref: string): FileRepositoryRefParts | null {
  const m = /^\/api\/file-repository\?file=c(\d+)\/(?:(od|dbx|lan)\/)?([A-Za-z_]+)\/([^/?#]+)$/.exec(ref);
  if (!m) return null;
  const folder = m[3] as FileRepositoryFolder;
  if (!FILE_REPOSITORY_FOLDERS.includes(folder) || !SAFE_PART.test(m[4]!)) return null;
  return { councilId: Number(m[1]), provider: PROVIDER_BY_CODE[m[2] ?? 'lan']!, folder, fileName: m[4]! };
}

export const isFileRepositoryRef = (value: string): boolean => parseFileRepositoryRef(value) !== null;

/** A file name the server picks for an upload: kind, time, random part and the original extension. */
export function repositoryFileName(prefix: string, originalName: string, random: string, now = Date.now()): string {
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(originalName)?.[1]?.toLowerCase() ?? 'bin';
  return `${prefix.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'file'}-${now}-${random.replace(/[^a-z0-9]/gi, '')}.${ext}`;
}
