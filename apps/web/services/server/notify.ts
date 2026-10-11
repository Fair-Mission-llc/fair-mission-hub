// Email the server composes itself (Sprint 7F): today only the council access request notice, which the server's data
// copy (session.ts memberDirectory) sends to ACCESS_REQUEST_NOTIFY_EMAIL when the sign-in page's form is filed.
//
// SERVER ONLY. With SENDGRID_API_KEY and SENDGRID_LIVE=1 it goes out through SendGrid; otherwise it is logged with the
// key redacted, like every other simulated email. The browser never chooses the recipient or the text: the driver
// builds both from the stored request (accessRequestEmail), so the public form cannot be used to mail anyone else.
import { buildSendGridMailRequest, describeError, logSendGridRequest, type SendGridMailRequest } from '@kofc/shared';
import { liveSendGridKey } from './secrets';

export async function deliverServerEmail(request: SendGridMailRequest): Promise<void> {
  const key = liveSendGridKey();
  if (!key) {
    await logSendGridRequest(console.log)(request);
    return;
  }
  const b = request.body;
  const live = buildSendGridMailRequest(
    { to: b.personalizations[0].to[0].email, from: b.from.email, subject: b.subject, text: b.content[0].value, attachments: [] },
    key,
  );
  try {
    const res = await fetch(live.url, { method: live.method, headers: live.headers, body: JSON.stringify(live.body) });
    if (!res.ok) throw new Error(`SendGrid answered HTTP ${res.status}.`);
  } catch (err) {
    // The request is already saved; a failed notice is logged rather than failing the applicant's form.
    console.error('[notification] SendGrid send of a server email failed:', describeError(err));
  }
}
