// Sprint 8S Revision 8: the About, Terms of Service and Privacy Policy notices behind the sign-in footer
// (apps/web/components/LegalFooter.tsx). Plain text, one paragraph per entry; the About notice ends with its signature.

/** The official name of the platform, shown on the launch splash. Sprint 11 Revision 1.0: carries its trademark sign. */
export const PLATFORM_APP_NAME = 'Fraternal Council Archives™';
/** The company that built the platform, closing the About notice. */
export const PLATFORM_ENGINEERED_BY = 'Engineered by Fair Mission, LLC';

export type LegalNoticeId = 'about' | 'terms' | 'privacy';

/**
 * Sprint 11 Revision 1.0: the Terms of Service and Privacy Policy are Markdown files under docs/legal/, effective
 * October 26, 2026. The sidebar's legal footer reads them through LEGAL_DOCUMENT_ROUTE (GET ?notice=terms|privacy) and
 * draws them with the markdown renderer; the paragraphs below stay as the fallback when the file cannot be read.
 */
export const LEGAL_DOCUMENT_FILES: Partial<Record<LegalNoticeId, string>> = {
  // Sprint 11 Revision 2.0: the owner's own Terms and Privacy Policy, converted from the .docx originals in docs/legal/.
  // Relative to docs/: readDocsFile adds the docs/ folder itself.
  terms: 'legal/TERMS_OF_SERVICE.md',
  privacy: 'legal/PRIVACY_POLICY.md',
};
export const LEGAL_DOCUMENTS_EFFECTIVE_DATE = '2026-10-26';
export const LEGAL_DOCUMENT_ROUTE = '/api/legal';
export const isLegalDocumentId = (value: unknown): value is 'terms' | 'privacy' => value === 'terms' || value === 'privacy';

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
    // Sprint 11 Revision 15.5: a short form of docs/legal/TERMS_OF_SERVICE.md (October 26, 2026), shown
    // only when that file cannot be read. The file is the governing text.
    paragraphs: [
      `Last Updated: October 26, 2026. These Terms govern your use of ${PLATFORM_APP_NAME}, Mission Clarity™ and Clarity Giving™ (the "Software"), owned and operated by Fair Mission, LLC. By using the Software, you agree to these Terms and to our Privacy Policy.`,
      'Accounts: Give accurate, current and complete information when you register. You are responsible for keeping your login credentials confidential and for all activity under your account, and you must notify us immediately of any unauthorized use. The Company may refuse or cancel an account at its sole discretion.',
      'License: The Software, including its code, design, database structure and content, remains the exclusive property of Fair Mission, LLC. You receive a limited, non-exclusive, non-transferable, revocable license to use it for internal business or organizational operations. You may not copy, resell, reverse engineer, bypass its security, or use it to build a competing product.',
      'Your data: You keep exclusive ownership of the data you upload or sync ("Client Data"). You grant the Company a limited license to host, copy, transmit and display it only as needed to provide and support the Software. You agree to indemnify Fair Mission, LLC against third-party claims arising from your misuse of the Software, privacy-law violations in your Client Data, or your breach of these Terms.',
      'Fees: Subscriptions are billed in advance, monthly or annually. Prices may change with reasonable prior notice. You may cancel at any time; except where the law requires, paid fees are non-refundable.',
      'You may not use the Software to break the law, transmit malware, interfere with its security or performance, or scrape its data without written permission. We may suspend or terminate your account at our sole discretion, without prior notice, including for a breach of these Terms.',
      'THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND. THE COMPANY IS NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, AND ITS TOTAL LIABILITY IS LIMITED TO THE AMOUNT YOU PAID IN THE TWELVE (12) MONTHS BEFORE THE CLAIM.',
      'These Terms are governed by the laws of the State of Oregon, with suits brought exclusively in the federal or state courts of Multnomah County, Portland, Oregon. We may change these Terms by posting them with a new "Last Updated" date. Questions: tim@fairmissionsoftware.com.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    // Sprint 11 Revision 15.5: a short form of docs/legal/PRIVACY_POLICY.md (October 26, 2026), shown only
    // when that file cannot be read. The file is the governing text.
    paragraphs: [
      `Last Updated: October 26, 2026. Fair Mission LLC operates ${PLATFORM_APP_NAME}, Mission Clarity™ and Clarity Giving™ (the "Software"). This policy explains how we collect, use, disclose and safeguard your information. By using the Software, you agree to it.`,
      'We collect the information you give us (account details such as your name, email address and username; billing information, processed by a third-party payment processor so we do not store your raw card details; and support messages) and information collected automatically (log data such as IP address and browser, device data, and essential cookies that keep you signed in).',
      'We use it to provide and secure your account, process payments and prevent fraud, monitor and improve the Software, send operational and security notices, and meet legal obligations.',
      'We do not sell, rent or trade your personal data. We share it only with service providers that help run the Software (payment processing, cloud hosting and performance analytics), and they may not use it for any other purpose.',
      'We protect data in transit with SSL/TLS encryption, but no system is 100% secure. We keep personal data only while your account is active or as the law requires.',
      'Depending on where you live (including California, Colorado and Oregon), you may have the right to know, delete, correct and port your data, and to non-discrimination for using these rights. Send requests to tim@fairmissionsoftware.com; we respond to verified requests within forty-five (45) days.',
      'The Software is not directed to children under 13, and we delete any data we learn a child under 13 has provided. We may update this policy by revising its "Last Updated" date.',
      'Contact: Fair Mission LLC, Attn: Legal & Compliance, 3055 NW Yeon Ave, #294, Portland, OR 97210, or tim@fairmissionsoftware.com.',
    ],
  },
];
