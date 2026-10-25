// How Council Wide Settings asks the portal's server for a council's custom user guide (Sprint 7H): it posts the guide,
// the council and the settings it read through the data service to app/api/council/compile-manual, which compiles the
// PDF with ReportLab on the server.
import type { CustomManualPayload } from '@kofc/shared';

export const CUSTOM_MANUAL_ROUTE = '/api/council/compile-manual';

/**
 * The compiled PDF and where the server filed its copy (Sprint 10 Revision 4.0: the 'Official Manuals' folder of the
 * council's file repository), or an Error carrying the server's explanation.
 */
export async function compileCustomManual(payload: CustomManualPayload): Promise<{ pdf: Blob; filed: { saved: boolean; text: string } | null }> {
  const res = await fetch(CUSTOM_MANUAL_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null);
  if (!res) throw new Error('The portal server did not answer. Check the connection and try again.');
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `The guide could not be compiled (HTTP ${res.status}).`);
  }
  const header = res.headers.get('X-Official-Manuals');
  const filed = header ? { saved: header.startsWith('saved;'), text: header.replace(/^(saved|skipped);\s*/, '') } : null;
  return { pdf: await res.blob(), filed };
}
