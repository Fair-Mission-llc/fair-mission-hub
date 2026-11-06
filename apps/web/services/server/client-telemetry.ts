// Client telemetry log (Sprint 11 Revision 21.5, client-telemetry.ts): each password sign-in's client version and device
// platform, kept beside the hub data in client-telemetry.json - the last CLIENT_TELEMETRY_KEEP sign-ins and the latest per
// member. No table changes (schema 113). A write that fails is logged and never blocks the sign-in.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLIENT_TELEMETRY_KEEP, describeError, type ClientTelemetryRecord } from '@kofc/shared';
import { hubDataDir } from './hub/hub-vault';

export interface ClientTelemetryLog {
  recent: ClientTelemetryRecord[];
  latestByMember: Record<string, ClientTelemetryRecord>;
}

const logPath = () => join(/*turbopackIgnore: true*/ hubDataDir(), 'client-telemetry.json');

export async function readClientTelemetryLog(): Promise<ClientTelemetryLog> {
  try {
    const parsed = JSON.parse(await readFile(logPath(), 'utf8')) as Partial<ClientTelemetryLog>;
    return { recent: Array.isArray(parsed.recent) ? parsed.recent : [], latestByMember: parsed.latestByMember ?? {} };
  } catch {
    return { recent: [], latestByMember: {} };
  }
}

// Sign-ins are written one at a time so two at once never lose a row.
let queue: Promise<void> = Promise.resolve();

export function recordClientSignIn(record: ClientTelemetryRecord): Promise<void> {
  queue = queue.then(async () => {
    try {
      const log = await readClientTelemetryLog();
      log.recent = [record, ...log.recent].slice(0, CLIENT_TELEMETRY_KEEP);
      log.latestByMember[String(record.memberId)] = record;
      await mkdir(hubDataDir(), { recursive: true });
      await writeFile(logPath(), JSON.stringify(log, null, 2), 'utf8');
    } catch (err) {
      console.error('[client-telemetry] the sign-in could not be recorded:', describeError(err));
    }
  });
  return queue;
}
