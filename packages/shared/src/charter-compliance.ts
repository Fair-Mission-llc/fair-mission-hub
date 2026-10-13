// =========================================================================
// THE KofC CHARTER COMPLIANCE GATE (Sprint 8J, schema version 80)
//
// A two-stage check the Operations Knowledge Archive's entry form runs on every draft as the officer types, and
// the drivers run again before an entry is stored (cleanOperationsKnowledgeEntry):
//   - ADVISORY  the Charter Advisory Warning Panel shows the rule and its authority; the entry may still be saved.
//   - SEVERE    the panel turns red and the save button is disabled; a driver refuses CHARTER_VIOLATION_BLOCKED.
// The rules cover the Order's non-partisan and non-profit boundaries: endorsing or opposing candidates, giving council
// money to campaigns or parties, private use of council funds, partisan material at council events, the Order's name in
// political campaigns, ballot measures, and off-the-books cash.
//
// The engine is deterministic pattern matching, like the Constitutional Advisor (advisor.ts); there is no language model.
// The repository holds no text of the Charter, Constitution and Laws of the Knights of Columbus, so no rule quotes a
// Charter section number. Each rule names its authority honestly and tells the officer to confirm the exact section with
// the State Deputy. The one verbatim quotation is the U.S. Internal Revenue Code's ban on political campaign activity.
// =========================================================================
import { BusinessRuleError } from './rules';

/** ADVISORY shows the panel; SEVERE also disables saving. */
export type CharterSeverity = 'ADVISORY' | 'SEVERE';

/** One rule of the gate. */
export interface CharterRule {
  id: string;
  severity: CharterSeverity;
  /** Matched against the lower-cased draft with whitespace collapsed. */
  pattern: RegExp;
  /** The panel's heading for the rule. */
  title: string;
  /** The rule in plain English. */
  rule: string;
  /** Where the rule comes from. Never an invented Charter section. */
  authority: string;
  /** A verbatim quotation of the authority, only where the exact text is known. */
  quotation?: string;
}

/** One rule a draft breaks, as the panel shows it. */
export interface CharterFinding {
  id: string;
  severity: CharterSeverity;
  title: string;
  rule: string;
  authority: string;
  quotation?: string;
}

/** The gate's verdict on a draft. */
export interface CharterReview {
  findings: CharterFinding[];
  /** ADVISORY or SEVERE when any rule matched; null for a clean draft. */
  level: CharterSeverity | null;
  /** True when a SEVERE rule matched: the save button is disabled and the drivers refuse the entry. */
  blocksSave: boolean;
}

/** The panel's title. */
export const CHARTER_ADVISORY_PANEL_TITLE = 'Charter Advisory Warning';

/** Every rule's closing instruction: the repository has no Charter text to cite. */
export const CHARTER_SECTION_CHECK =
  'Confirm the exact section of the Charter, Constitution and Laws of the Knights of Columbus with your State Deputy.';

const SUPREME_NONPARTISAN = 'Knights of Columbus Supreme Council policy: the Order and its councils are non-partisan';
const SUPREME_FUNDS = 'Knights of Columbus Supreme Council policy: council funds serve the council\'s fraternal and charitable purposes';
const IRC_501C3 = 'U.S. Internal Revenue Code § 501(c)(3), which governs the council\'s charitable funds and the charities it supports';

/** The statutory text of IRC § 501(c)(3)'s campaign ban. */
const IRC_CAMPAIGN_QUOTATION =
  '"…and which does not participate in, or intervene in (including the publishing or distributing of statements), any political campaign on behalf of (or in opposition to) any candidate for public office."';

// "Candidate", "nominee" and "campaign" are ordinary council words (degree candidates, officer nominees, the Coats for
// Kids campaign), so the patterns need a public office or a political qualifier next to them.
const OFFICES =
  '(mayor|governor|senate|senator|congress|congressman|congresswoman|president|city council|county (board|commission|commissioner)|school board|state (house|senate|assembly|representative)|sheriff|district attorney|alderman|public office)';
const CANDIDATE = `(political candidates?|candidates? (for|running for) (public office|${OFFICES})|${OFFICES} candidates?|(democratic|republican|libertarian|green party|independent) candidates?)`;
const POLITICAL_CAMPAIGN = `(political campaigns?|election campaigns?|(re-?election|campaign) (funds?|committees?|accounts?)|pacs?|super ?pacs?|political (party|parties|action committees?)|${CANDIDATE})`;

export const CHARTER_RULES: readonly CharterRule[] = [
  {
    id: 'candidate-endorsement',
    severity: 'SEVERE',
    pattern: new RegExp(
      `\\b(endors(e|es|ed|ing|ement)|campaign(s|ed|ing)? (for|against)|vote (for|against)|re-?elect|defeat|support(s|ed|ing)?|oppos(e|es|ed|ing)|back(s|ed|ing)?)\\b.{0,50}\\b${CANDIDATE}\\b|\\b(endorse|vote for|elect|re-?elect|campaign for)\\b.{0,30}\\bfor ${OFFICES}\\b`,
    ),
    title: 'Endorsing or opposing a candidate',
    rule: 'A council may not endorse, campaign for or oppose any candidate for public office, in its own name or in the name of the Order. Members act as private citizens.',
    authority: `${SUPREME_NONPARTISAN}; ${IRC_501C3}`,
    quotation: IRC_CAMPAIGN_QUOTATION,
  },
  {
    id: 'political-contribution',
    severity: 'SEVERE',
    pattern: new RegExp(
      `\\b(donat(e|es|ed|ing|ion)|contribut(e|es|ed|ing|ion)|giv(e|es|ing)|gave|pay|paid|spend|spent|send|sent|write a check)\\b.{0,60}\\b${POLITICAL_CAMPAIGN}\\b`,
    ),
    title: 'Council money to a campaign or party',
    rule: 'Council and charity funds may never go to a candidate, a campaign, a political party or a political action committee.',
    authority: `${SUPREME_FUNDS}; ${IRC_501C3}`,
    quotation: IRC_CAMPAIGN_QUOTATION,
  },
  {
    id: 'private-benefit',
    severity: 'SEVERE',
    pattern:
      /\b(council|charity|charitable|dues|treasury|general fund) (funds?|money|account|cash)\b.{0,50}\b(personal|my own|his own|private|family) (use|expenses?|benefit|bills?|loans?|accounts?)\b|\b(borrow|loan|lend)\b.{0,30}\b(council|charity|charitable|dues) (funds?|money|cash)\b/,
    title: 'Private use of council funds',
    rule: 'Council funds belong to the council. No officer or member may use them, borrow them or lend them for a private purpose.',
    authority: `${SUPREME_FUNDS}; ${IRC_501C3} (no part of the net earnings may benefit a private individual)`,
  },
  {
    id: 'partisan-materials',
    severity: 'ADVISORY',
    pattern: /\b((political|election|candidates?'?) (campaign )?(signs?|literature|flyers?|buttons?|rall(y|ies))|campaign (yard )?signs?|yard signs? for|political rall(y|ies))\b/,
    title: 'Partisan material at council events',
    rule: 'Keep campaign signs, literature and rallies out of council events, council property and council mailings.',
    authority: SUPREME_NONPARTISAN,
  },
  {
    id: 'order-name-in-politics',
    severity: 'ADVISORY',
    pattern:
      /\b(knights of columbus|k of c|kofc|the council|our council)\b.{0,40}\b(name|emblem|logo|letterhead|banner)\b.{0,40}\b(political|party|candidates? for|election campaign)\b/,
    title: 'The Order\'s name or emblem in politics',
    rule: 'The Order\'s name, emblem and council letterhead may not appear in a political campaign or partisan petition.',
    authority: SUPREME_NONPARTISAN,
  },
  {
    id: 'ballot-measure',
    severity: 'ADVISORY',
    pattern: /\bballot (measures?|initiatives?|propositions?|questions?)\b|\b(lobby|lobbying)\b/,
    title: 'Ballot measures and lobbying',
    rule: 'Speaking on moral issues is part of the Order\'s mission, but campaigning on a ballot measure or lobbying has limits for tax-exempt groups. Check before the council commits money or its name.',
    authority: `${SUPREME_NONPARTISAN}; ${IRC_501C3} (no substantial lobbying)`,
  },
  {
    id: 'off-the-books',
    severity: 'ADVISORY',
    pattern: /\boff the books\b|\b(cash|money|funds)\b.{0,40}\b(without|no|skip(ping)?) (a )?(receipts?|records?|count(ing)?|deposit)\b|\bunrecorded (cash|money|funds|donations?)\b/,
    title: 'Unrecorded money',
    rule: 'Every dollar the council takes in is counted, receipted and deposited, so the Trustees can audit it on Form 1295.',
    authority: 'Knights of Columbus Supreme Council: semiannual Trustees\' audit (Form 1295)',
  },
];

/** The rules `text` breaks, in CHARTER_RULES order, and whether they block saving. */
export function reviewCharterCompliance(text: string): CharterReview {
  const flat = (text ?? '').toLowerCase().replace(/\s+/g, ' ');
  const findings: CharterFinding[] = CHARTER_RULES.filter((r) => r.pattern.test(flat)).map(({ id, severity, title, rule, authority, quotation }) => ({
    id,
    severity,
    title,
    rule,
    authority,
    ...(quotation ? { quotation } : {}),
  }));
  const blocksSave = findings.some((f) => f.severity === 'SEVERE');
  return { findings, level: blocksSave ? 'SEVERE' : findings.length > 0 ? 'ADVISORY' : null, blocksSave };
}

/** Refuses CHARTER_VIOLATION_BLOCKED, before anything is stored, when `text` breaks a SEVERE rule. Returns `text`. */
export function assertCharterCompliant(text: string): string {
  const review = reviewCharterCompliance(text);
  if (review.blocksSave) {
    const severe = review.findings.filter((f) => f.severity === 'SEVERE');
    throw new BusinessRuleError(
      'CHARTER_VIOLATION_BLOCKED',
      `This entry was not saved because it crosses the Order's non-partisan or non-profit boundaries (${severe.map((f) => f.title.toLowerCase()).join('; ')}). Please reword it and save it again.`,
      { rules: severe.map((f) => f.id) },
    );
  }
  return text;
}
