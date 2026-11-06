// =========================================================================
// CLIENT TELEMETRY AND UPGRADE NOTICES (Sprint 11 Revision 21.5, schema 113, no table change)
//
// Every password sign-in (POST /api/auth/session, and the hub's auth.signIn on /api/sync/replicate) reads the client's
// release version and device platform:
//   - version  the CLIENT_VERSION_HEADER the client sends (the web bundle and the phone send CLIENT_RELEASE_VERSION);
//              without it, a 'KofCClient/<version>' token in the User-Agent; otherwise unknown;
//   - platform CLIENT_PLATFORM_HEADER when sent ('ios', 'android', 'windows-desktop'...), else parsed from the User-Agent;
//              the Windows desktop client is recognised by its Electron token.
// The server records each sign-in (apps/web/services/server/client-telemetry.ts: a JSON file beside the hub data, the
// last CLIENT_TELEMETRY_KEEP sign-ins plus the latest per member) and answers with clientUpgradeNotice: a notice card
// when the version is older than CLIENT_RELEASE_BASELINE.
// =========================================================================

/** This build's release (Sprint 11 Revision 22.0; was 11.21.5). */
export const CLIENT_RELEASE_VERSION = '11.22.0';
/** The oldest release still recommended. A client below it gets the upgrade notice. */
export const CLIENT_RELEASE_BASELINE = '11.21.0';

export const CLIENT_VERSION_HEADER = 'X-KofC-Client-Version';
export const CLIENT_PLATFORM_HEADER = 'X-KofC-Client-Platform';
/** How many sign-ins the server keeps in its log. */
export const CLIENT_TELEMETRY_KEEP = 500;
/** Super Admins read the log here (GET). */
export const CLIENT_TELEMETRY_ROUTE = '/api/auth/client-telemetry';

export type ClientPlatform = 'Windows Desktop' | 'Windows' | 'macOS' | 'iOS' | 'Android' | 'Linux' | 'ChromeOS' | 'Unknown';
export type ClientKind = 'desktop' | 'browser' | 'phone';

export interface ClientTelemetry {
  /** 'major.minor.patch', or null when the client did not say. */
  version: string | null;
  platform: ClientPlatform;
  kind: ClientKind;
}

export interface ClientTelemetryRecord extends ClientTelemetry {
  memberId: number;
  councilId: number;
  at: string;
  route: 'portal' | 'hub';
}

export interface ClientUpgradeNotice {
  title: string;
  body: string;
  actionLabel: string;
  current: string | null;
  baseline: string;
}

const VERSION = /^v?(\d{1,4})\.(\d{1,4})(?:\.(\d{1,4}))?$/;

/** A clean 'major.minor.patch', or null when `raw` is not a version. */
export function normalizeClientVersion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = VERSION.exec(raw.trim());
  return m ? `${Number(m[1])}.${Number(m[2])}.${Number(m[3] ?? 0)}` : null;
}

/** -1, 0 or 1, comparing two normalized versions part by part. */
export function compareClientVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

const PLATFORM_HINTS: Readonly<Record<string, ClientPlatform>> = {
  'windows-desktop': 'Windows Desktop',
  windows: 'Windows',
  macos: 'macOS',
  ios: 'iOS',
  android: 'Android',
  linux: 'Linux',
  chromeos: 'ChromeOS',
};

/** The platform a User-Agent names. */
export function platformFromUserAgent(ua: string): ClientPlatform {
  if (/Electron\//.test(ua) && /Windows/.test(ua)) return 'Windows Desktop';
  if (/iPhone|iPad|iPod|CFNetwork|Darwin.*Expo/i.test(ua)) return 'iOS';
  if (/Android|okhttp/i.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

const kindOf = (platform: ClientPlatform): ClientKind => (platform === 'Windows Desktop' ? 'desktop' : platform === 'iOS' || platform === 'Android' ? 'phone' : 'browser');

/** Reads version and platform from a sign-in request's headers (any header-like getter). */
export function parseClientTelemetry(headers: { get(name: string): string | null }): ClientTelemetry {
  const ua = headers.get('user-agent') ?? '';
  const version = normalizeClientVersion(headers.get(CLIENT_VERSION_HEADER)) ?? normalizeClientVersion(/KofCClient\/(\S+)/.exec(ua)?.[1]);
  const hint = PLATFORM_HINTS[(headers.get(CLIENT_PLATFORM_HEADER) ?? '').trim().toLowerCase()];
  const platform = hint ?? platformFromUserAgent(ua);
  return { version, platform, kind: kindOf(platform) };
}

/** The notice card for a client older than `baseline`, or null when it is current (or did not say its version). */
export function clientUpgradeNotice(telemetry: Pick<ClientTelemetry, 'version' | 'kind'>, baseline: string = CLIENT_RELEASE_BASELINE): ClientUpgradeNotice | null {
  if (!telemetry.version || compareClientVersions(telemetry.version, baseline) >= 0) return null;
  const how =
    telemetry.kind === 'desktop'
      ? 'Install the new Windows desktop client from your council Admin.'
      : telemetry.kind === 'phone'
        ? 'Update the phone app, then sign in again.'
        : 'Reload this page to load the current portal.';
  return {
    title: 'Upgrade recommended',
    body: `Client ${telemetry.version} is older than release ${baseline}. ${how}`,
    actionLabel: telemetry.kind === 'browser' ? 'Reload now' : 'Dismiss',
    current: telemetry.version,
    baseline,
  };
}

/** The hub's sign-in reply header carrying an upgrade notice body (URI-encoded) for an outdated client. */
export const CLIENT_UPGRADE_HEADER = 'X-KofC-Upgrade-Notice';
