// =========================================================================
// SPRINT 8S REVISION 3 - THE OUTGOING CHARITY COMPLIANCE PIPELINE (schema version 95 -> 96)
//
// The Charitable Donation Workflow drawer (desk-workflows.ts, Sprint 8S Revision 2) tracked gifts coming IN. It now
// tracks the council's money going OUT to a charity, along a strict three-step compliance pipeline:
//
//   [ 📋 Member Charity Request ]           a Knight Shepherd files the request; officers and Trustees vet it and the
//                                           council votes it (CharitableRequest.RequestStatus / VoteStatus).
//   [ ✍️ FS/GK Compliance Endorsement ]     once the vote approves it, the council's Financial Secretary, Grand Knight
//                                           or Deputy Grand Knight (or a Super Admin) endorses it for payment
//                                           (charities.endorseApprovedRequest): CharitableRequest.compliance_endorsed_by_
//                                           member_id and compliance_endorsed_at. New in schema 96.
//   [ ⛪ Treasurer Check Settlement ]        the check (charities.payApprovedRequest, the Charity Check Issuance Console).
//                                           Since schema 96 it refuses an unendorsed request (CHARITY_ENDORSEMENT_
//                                           REQUIRED) and the officer who endorsed it (ENDORSER_PAYOUT_BLOCKED), so two
//                                           different officers sign off on every outgoing charity check.
//
// The Knight Shepherd of a request may neither endorse it (SELF_ENDORSEMENT_BLOCKED) nor pay it (SELF_PAYOUT_BLOCKED).
// Who may write the check is unchanged since Sprint 5V: the council's Financial Secretary or Treasurer, or a Super
// Admin (assertMayDisburseCharity).
// =========================================================================
import type { CharitableRequestDetail, SessionUser } from './contract';
import { canDisburseCharity, isSuperAdmin } from './permissions';
import { BusinessRuleError, describeActor, hasSuperAdminRights, holdsGrandKnightAuthority, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { CharitableRequest } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

export const CHARITY_REQUEST_STEP_LABEL = '[ 📋 Member Charity Request ]';
export const CHARITY_ENDORSEMENT_STEP_LABEL = '[ ✍️ FS/GK Compliance Endorsement ]';
export const CHARITY_SETTLEMENT_STEP_LABEL = '[ ⛪ Treasurer Check Settlement ]';
/** Sprint 8S Revision 10.6: the working folder of the endorse button on the FS and GK Desks (the workflow drawer is read only). */
export const CHARITY_ENDORSEMENT_FOLDER_TITLE = 'FS/GK Compliance Endorsements';

/** The endorsement button. */
export const ENDORSE_CHARITY_REQUEST_LABEL = '✍️ Endorse for payment';

/** The roles whose holders endorse an approved request for payment (with the Super Admins). */
export const CHARITY_ENDORSER_ROLE_NAMES = ['Financial Secretary', 'Grand Knight', 'Deputy Grand Knight'] as const;

const holdsEndorserRole = (roles: readonly string[] | undefined): boolean =>
  (roles ?? []).includes('Financial Secretary') || holdsGrandKnightAuthority(roles);

/**
 * charities.endorseApprovedRequest: an Active Financial Secretary, Grand Knight or Deputy Grand Knight of the council, or
 * an Active Super Admin. CHARITY_ENDORSER_REQUIRED, or COUNCIL_ACCESS_DENIED for another council's officer.
 */
export function assertMayEndorseCharityRequest(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  if (!(actor.active && holdsEndorserRole(actor.roles))) {
    throw new SecurityPrivilegeError(
      'CHARITY_ENDORSER_REQUIRED',
      `Only the council's Financial Secretary, Grand Knight, Deputy Grand Knight or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, councilId },
    );
  }
  if (actor.councilId !== councilId) {
    throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}.`, {
      actorId: actor.memberId,
      actorCouncilId: actor.councilId,
      councilId,
    });
  }
}

/** The portal's twin of assertMayEndorseCharityRequest. */
export const canEndorseCharityRequest = (u: Actor, councilId: number): boolean => isSuperAdmin(u) || (u.councilId === councilId && holdsEndorserRole(u.roles));

type EndorsementFields = Pick<CharitableRequest, 'id' | 'RequestStatus' | 'VoteStatus' | 'PaymentOrderId' | 'ShepherdMemberID'> &
  Partial<Pick<CharitableRequest, 'compliance_endorsed_by_member_id' | 'compliance_endorsed_at'>>;

const conflict = (request: Pick<CharitableRequest, 'id' | 'RequestStatus'>, message: string, details: Record<string, unknown> = {}) =>
  new BusinessRuleError('REQUEST_STATUS_CONFLICT', message, { requestId: request.id, status: request.RequestStatus, ...details });

export const isEndorsed = (r: Partial<Pick<CharitableRequest, 'compliance_endorsed_by_member_id'>>): boolean => r.compliance_endorsed_by_member_id != null;

/**
 * What endorseApprovedRequest may endorse: REQUEST_STATUS_CONFLICT unless the council's vote approved the request, no
 * check has paid it and nobody endorsed it yet; SELF_ENDORSEMENT_BLOCKED for the request's own Knight Shepherd.
 */
export function assertRequestEndorsable(request: EndorsementFields, actorId: number): void {
  if (request.VoteStatus !== 'Approved') {
    throw conflict(request, `Charitable request ${request.id} has not been approved by the council's vote, so it cannot be endorsed for payment.`, { voteStatus: request.VoteStatus });
  }
  if (request.PaymentOrderId != null) throw conflict(request, `Charitable request ${request.id} is already paid by check.`, { paymentOrderId: request.PaymentOrderId });
  if (isEndorsed(request)) {
    throw conflict(request, `Charitable request ${request.id} is already endorsed for payment.`, { endorsedBy: request.compliance_endorsed_by_member_id });
  }
  if (request.ShepherdMemberID === actorId) {
    throw new BusinessRuleError('SELF_ENDORSEMENT_BLOCKED', 'For accounting controls, the Knight Shepherd of a request cannot endorse it for payment.', {
      requestId: request.id,
      actorId,
    });
  }
}

/** The columns endorseApprovedRequest writes. */
export const endorsementColumns = (actorId: number, nowTimestamp: string): Pick<CharitableRequest, 'compliance_endorsed_by_member_id' | 'compliance_endorsed_at'> => ({
  compliance_endorsed_by_member_id: actorId,
  compliance_endorsed_at: nowTimestamp,
});

/**
 * payApprovedRequest since schema 96, after assertRequestPayable: CHARITY_ENDORSEMENT_REQUIRED until an FS or GK has
 * endorsed the request, and ENDORSER_PAYOUT_BLOCKED for the officer who endorsed it.
 */
export function assertRequestEndorsedForPayment(request: EndorsementFields, actorId: number): void {
  if (!isEndorsed(request)) {
    throw new BusinessRuleError(
      'CHARITY_ENDORSEMENT_REQUIRED',
      `Charitable request ${request.id} needs the Financial Secretary's or Grand Knight's compliance endorsement before a check can pay it.`,
      { requestId: request.id },
    );
  }
  if (request.compliance_endorsed_by_member_id === actorId) {
    throw new BusinessRuleError('ENDORSER_PAYOUT_BLOCKED', 'For accounting controls, the officer who endorsed a request cannot also issue the check that pays it.', {
      requestId: request.id,
      actorId,
    });
  }
}

// ---- where a request stands -------------------------------------------------------------------------------------------

export type CharityPipelineStage = 'request' | 'endorsement' | 'settlement' | 'paid' | 'closed';

/**
 * A request's place on the pipeline: 'request' while it is vetted or awaits the vote, 'endorsement' once the vote
 * approves it, 'settlement' once endorsed, 'paid' once a check paid it, and 'closed' when declined or voted down.
 */
export function charityPipelineStage(r: EndorsementFields): CharityPipelineStage {
  if (r.PaymentOrderId != null) return 'paid';
  if (r.RequestStatus === 'Declined' || r.VoteStatus === 'Rejected') return 'closed';
  if (r.VoteStatus !== 'Approved') return 'request';
  return isEndorsed(r) ? 'settlement' : 'endorsement';
}

/** The desks that carry the pipeline drawer. */
export type CharityPipelineDesk = 'financial-secretary' | 'treasurer' | 'grand-knight';

const OWN_STEPS: Record<CharityPipelineDesk, readonly CharityPipelineStage[]> = {
  'financial-secretary': ['endorsement'],
  'grand-knight': ['endorsement'],
  treasurer: ['settlement'],
};

type PipelineStepState = 'done' | 'current' | 'upcoming';

export interface CharityPipelineStep {
  key: 'request' | 'endorsement' | 'settlement';
  label: string;
  when: string;
  detail: string;
  state: PipelineStepState;
  count: number | null;
  yours: boolean;
}

/** The pipeline drawer for one desk over the council's requests (charities.listCharitableRequestsQueue; null while loading). */
export function buildCharityPipeline(
  desk: CharityPipelineDesk,
  requests: readonly Pick<CharitableRequestDetail, 'request'>[] | null,
): { steps: CharityPipelineStep[]; waiting: number | null; paid: number | null; headline: string } {
  const count = (stage: CharityPipelineStage) => (requests ? requests.filter((d) => charityPipelineStage(d.request) === stage).length : null);
  const own = OWN_STEPS[desk];
  const defs: { key: CharityPipelineStep['key']; label: string; when: string; detail: string }[] = [
    { key: 'request', label: CHARITY_REQUEST_STEP_LABEL, when: 'Knight Shepherd, vetters, council vote', detail: 'The request is filed, vetted and voted by the council.' },
    { key: 'endorsement', label: CHARITY_ENDORSEMENT_STEP_LABEL, when: 'Financial Secretary or Grand Knight', detail: 'An approved request is endorsed for payment.' },
    { key: 'settlement', label: CHARITY_SETTLEMENT_STEP_LABEL, when: 'Treasurer', detail: 'The endorsed request is paid by check from the console.' },
  ];
  const counts = defs.map((d) => count(d.key));
  const ownIndex = defs.findIndex((d, i) => own.includes(d.key) && (counts[i] ?? 0) > 0);
  const current = ownIndex >= 0 ? ownIndex : defs.findIndex((_, i) => (counts[i] ?? 0) > 0);
  const steps = defs.map(
    (d, i): CharityPipelineStep => ({
      ...d,
      count: counts[i],
      yours: own.includes(d.key),
      state: i === current ? 'current' : counts[i] === 0 ? 'done' : 'upcoming',
    }),
  );
  const waiting = requests ? own.reduce((sum, stage) => sum + (count(stage) ?? 0), 0) : null;
  const paid = count('paid');
  const ownLabel = own.includes('settlement') ? 'check' : 'endorsement';
  const workIn = own.includes('settlement') ? 'the Charitable Contribution Matches folder' : `the ${CHARITY_ENDORSEMENT_FOLDER_TITLE} folder`;
  const headline =
    requests === null
      ? 'Loading the council’s charity requests…'
      : waiting
        ? `${waiting} approved request${waiting === 1 ? '' : 's'} wait${waiting === 1 ? 's' : ''} for your ${ownLabel}. Work ${waiting === 1 ? 'it' : 'them'} in ${workIn}.`
        : current >= 0
          ? `Nothing waits on you. ${counts[current]} request${counts[current] === 1 ? '' : 's'} at ${steps[current].label}.`
          : 'No charity request is open. Every approved request is paid.';
  return { steps, waiting, paid, headline };
}

/**
 * The pipeline drawer's Alert Boundary Accent: on the FS and GK desks an approved request this reader may endorse now;
 * on the Treasurer Desk an endorsed request this reader may pay now (not its Shepherd, not its endorser).
 */
export function charityPipelineAlert(u: Actor, desk: CharityPipelineDesk, councilId: number, requests: readonly Pick<CharitableRequestDetail, 'request'>[]): boolean {
  if (desk === 'treasurer') {
    if (!canDisburseCharity(u, councilId)) return false;
    return requests.some((d) => charityPipelineStage(d.request) === 'settlement' && d.request.ShepherdMemberID !== u.memberId && d.request.compliance_endorsed_by_member_id !== u.memberId);
  }
  if (!canEndorseCharityRequest(u, councilId)) return false;
  return requests.some((d) => charityPipelineStage(d.request) === 'endorsement' && d.request.ShepherdMemberID !== u.memberId);
}
