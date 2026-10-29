// Email the server composes itself (Sprint 7F): today only the council access request notice, which the server's data
// copy (session.ts memberDirectory) sends to ACCESS_REQUEST_NOTIFY_EMAIL when the sign-in page's form is filed.
//
// SERVER ONLY. With SENDGRID_API_KEY and SENDGRID_LIVE=1 it goes out through SendGrid; otherwise it is logged with the
// key redacted, like every other simulated email.
// Sprint 11 Revision 12.0, mail separation: every email from here is platform operations mail, so it is always sent from
// PLATFORM_OPERATIONS_SENDER (outboundMailRoute), whatever sender the request named. The browser never chooses the recipient or the text: the driver
// builds both from the stored request (accessRequestEmail), so the public form cannot be used to mail anyone else.
import { buildSendGridMailRequest, describeError, logSendGridRequest, outboundMailRoute, type SendGridMailRequest } from '@kofc/shared';
import { liveSendGridKey } from './secrets';

export async function deliverServerEmail(request: SendGridMailRequest): Promise<void> {
  const route = outboundMailRoute('platform-operations', false);
  const b = request.body;
  const message = { to: b.personalizations[0].to[0].email, from: route.via === 'platform-sendgrid' ? route.from : b.from.email, subject: b.subject, text: b.content[0].value, attachments: [] };
  const key = liveSendGridKey();
  if (!key) {
    await logSendGridRequest(console.log)(buildSendGridMailRequest(message));
    return;
  }
  const live = buildSendGridMailRequest(message, key);
  try {
    const res = await fetch(live.url, { method: live.method, headers: live.headers, body: JSON.stringify(live.body) });
    if (!res.ok) throw new Error(`SendGrid answered HTTP ${res.status}.`);
  } catch (err) {
    // The request is already saved; a failed notice is logged rather than failing the applicant's form.
    console.error('[notification] SendGrid send of a server email failed:', describeError(err));
  }
}
