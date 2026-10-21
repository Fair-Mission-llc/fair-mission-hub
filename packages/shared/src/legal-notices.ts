// Sprint 8S Revision 8: the About, Terms of Service and Privacy Policy notices behind the sign-in footer
// (apps/web/components/LegalFooter.tsx). Plain text, one paragraph per entry; the About notice ends with its signature.

/** The official name of the platform, shown on the launch splash. */
export const PLATFORM_APP_NAME = 'Fraternal Council Archives';
/** The company that built the platform, closing the About notice. */
export const PLATFORM_ENGINEERED_BY = 'Engineered by Fair Mission, LLC';

export type LegalNoticeId = 'about' | 'terms' | 'privacy';

export interface LegalNotice {
  id: LegalNoticeId;
  title: string;
  paragraphs: readonly string[];
  /** A closing line printed in bold under the paragraphs. */
  signature?: string;
}

export const LEGAL_NOTICES: readonly LegalNotice[] = [
  {
    id: 'about',
    title: 'About',
    paragraphs: [
      `${PLATFORM_APP_NAME} is the administration platform of a fraternal council: its events and volunteer shifts, meetings and minutes, budget and ledger, charity requests and history.`,
      "The platform enforces the council's constitutional bylaws in its workflows. An expense is paid only after three different officers sign it: the Financial Secretary's payment request, the Treasurer's ledger coding and the Grand Knight's release. Nobody signs, codes, releases or pays his own report.",
      'A motion goes on the agenda of a meeting at least 10 days away. Floor votes are recorded by secret ballot or by the Recorder\'s hand tally. The Knight Shepherd of a charity request never vets it, and the council\'s goals lock on July 1 of their fraternal year.',
      "Each office opens only the desks its seat clears, and an officer loses a desk the moment he leaves the seat. The Constitutional Advisor names the source of each answer. The council's Charter, bylaws and the Supreme Council's rules stay the final authority.",
    ],
    signature: PLATFORM_ENGINEERED_BY,
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    paragraphs: [
      `These terms apply to every member who signs in to ${PLATFORM_APP_NAME}. By signing in, you agree to them.`,
      'Your account is for you alone. Do not share your password or setup code, and tell an officer at once if you think someone else used your account.',
      'Use the platform only for the business of your council: its events, meetings, finances, charity work and records. Enter only information that is true and that you have the right to share.',
      'Officers are responsible for the records they sign, code, release and approve. The platform checks the order of the steps; it does not replace the judgement of the officers, the Trustees\' audit or professional financial, tax or legal advice.',
      'The official records of the order are kept by the Supreme Council. A report or export from this platform does not replace a form or filing the Supreme Council requires.',
      'The platform is provided as is. Its features may change, and access may be paused for maintenance. Your council may close an account that breaks these terms.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    paragraphs: [
      `${PLATFORM_APP_NAME} keeps the information your council needs to run: your name, contact details and member number; your offices and membership history; the shifts you sign up for and the hours you log; your expense reports and receipts; donations, charity requests, meeting minutes, and the photos, diary entries, prayer intentions and recordings you choose to share.`,
      'Fellow members of your council can see the roster and your contact details. Officers see the records their office needs, such as expense reports at the desks that sign them. Platform administrators can open records only to support your council.',
      'Your council uses this information only for council business. It is not sold, and it is not shared for advertising.',
      'When your council connects its own Google Drive or email account, the photos, documents and messages sent there are kept under that account and its own terms.',
      'To correct your information, open My Profile. To ask what the platform holds about you, or to ask for a record to be removed, speak to your Grand Knight or Financial Secretary.',
    ],
  },
];
