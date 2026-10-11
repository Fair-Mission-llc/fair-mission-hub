// Sprint 7I Extension: paying a charitable request the council voted to fund (charities.payApprovedRequest), the step
// that had no writer: the check in the charitable disbursement ledger, the charity linked (or registered from the
// request), and the request's PaymentOrderId, which closes its Disbursement step.
import { describe, expect, it } from 'vitest';
import {
  assertRequestPayable,
  charitableTrackingPosition,
  charityFromRequest,
  cleanRequestCheck,
  type CharitableRequest,
  type DataService,
  type NewCharitableRequest,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const OWN = 1;
const CADENCE = 1;
const PAYOUT = '2026-09-21';

const form = (over: Partial<NewCharitableRequest> = {}): NewCharitableRequest => ({
  OrganizationName: 'Cathedral Neighbors Food Bank',
  AmountRequested: 350,
  RelationshipTypeID: 1,
  Is501c3: true,
  OrgMission: 'Weekly groceries for families near the cathedral',
  ...over,
});

/** Filed by `shepherdId`, vetted by the Financial Secretary (Admin 2), put on the agenda and voted `result`. */
async function votedRequest(db: DataService, result: 'Passed' | 'Failed', shepherdId: number = MEMBER.member, over: Partial<NewCharitableRequest> = {}): Promise<number> {
  const { request } = await db.charities.submitCharitableRequest(shepherdId, form(over));
  const vetter = shepherdId === MEMBER.admin ? MEMBER.superAdmin : MEMBER.admin;
  await db.charities.triageRequestStatus(vetter, request.id, { action: 'claim' });
  await db.charities.triageRequestStatus(vetter, request.id, { action: 'advance' });
  await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
  const { motion } = await db.charities.routeRequestToNextEligibleAgenda(MEMBER.superAdmin, request.id);
  await db.meetings.finalizeProposedMotionVote(MEMBER.superAdmin, motion.id, result);
  return request.id;
}

const request = (over: Partial<CharitableRequest> = {}): CharitableRequest => ({
  id: 5,
  CouncilID: OWN,
  OrganizationName: 'Cathedral Neighbors Food Bank',
  AmountRequested: 350,
  RequestStatus: 'Advanced',
  SubmittedAt: '2026-09-01 12:00:00',
  ShepherdMemberID: 3,
  Is501c3: 1,
  IsRecurring: 0,
  RequestTier: 1,
  VoteStatus: 'Approved',
  AmountApproved: 350,
  ...over,
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return null;
};

describe('payment rules (pure)', () => {
  it('pays only an approved, unpaid request, and never by its own Shepherd', () => {
    expect(code(() => assertRequestPayable(request(), 2))).toBeNull();
    expect(code(() => assertRequestPayable(request({ VoteStatus: 'Pending' }), 2))).toBe('REQUEST_STATUS_CONFLICT');
    expect(code(() => assertRequestPayable(request({ VoteStatus: 'Rejected' }), 2))).toBe('REQUEST_STATUS_CONFLICT');
    expect(code(() => assertRequestPayable(request({ PaymentOrderId: 9 }), 2))).toBe('REQUEST_STATUS_CONFLICT');
    expect(code(() => assertRequestPayable(request(), 3))).toBe('SELF_PAYOUT_BLOCKED');
  });

  it('registers the organization from the request, and asks for its type', () => {
    expect(charityFromRequest(request({ OrgMission: '  Groceries  ', EIN: '12-3456789' }), 'OR', 'Food Security')).toMatchObject({
      Name: 'Cathedral Neighbors Food Bank',
      Description: 'Groceries',
      EIN: '12-3456789',
      State: 'OR',
      CharityType: 'Food Security',
    });
    expect(charityFromRequest(request(), 'OR', 'Parish').Description).toBe('Charitable request 5');
    expect(code(() => charityFromRequest(request(), 'OR', null))).toBe('INVALID_INPUT');
    expect(cleanRequestCheck({ CheckNumber: ' 1301 ', PayoutDate: PAYOUT, CharityType: 'food security' })).toMatchObject({ CheckNumber: '1301', CharityType: 'Food Security', CharityID: null });
    expect(code(() => cleanRequestCheck({ CheckNumber: '1301', PayoutDate: PAYOUT, CharityType: 'Bake sale' }))).toBe('INVALID_INPUT');
  });
});

describe.each(drivers)('$name driver: paying an approved charitable request', (d) => {
  it('writes the check for the approved amount, registers the charity and closes the Disbursement step', async () => {
    const db = await d.make();
    const id = await votedRequest(db, 'Passed');
    expect((await db.charities.listApprovedFundingQueue(MEMBER.admin, OWN)).map((r) => r.id)).toEqual([id]);
    const registryBefore = d.count(db, 'GlobalCharityRegistry');

    const paid = await db.charities.payApprovedRequest(MEMBER.admin, id, { CheckNumber: '1301', PayoutDate: PAYOUT, Notes: 'Pilot grant', CharityType: 'Food Security' });
    expect(paid.charityRegistered).toBe(true);
    expect(paid.charity).toMatchObject({ Name: 'Cathedral Neighbors Food Bank', State: 'OR', CharityType: 'Food Security' });
    expect(paid.disbursement).toMatchObject({ CouncilID: OWN, Amount: 350, CheckNumber: '1301', DisbursedByID: MEMBER.admin, PayoutDate: PAYOUT, ProposalID: null });
    expect(paid.request.PaymentOrderId).toBe(paid.disbursement.id);
    expect(charitableTrackingPosition(paid.request)).toEqual({ stepIndex: 3, stopped: false });
    expect(d.count(db, 'GlobalCharityRegistry')).toBe(registryBefore + 1);

    expect(await db.charities.listApprovedFundingQueue(MEMBER.admin, OWN)).toEqual([]);
    const ledger = await db.charities.listCouncilLedger(MEMBER.admin, OWN);
    expect(ledger.find((e) => e.charity.id === paid.charity.id)?.totalGiven).toBe(350);

    await expectRule(db.charities.payApprovedRequest(MEMBER.admin, id, { CheckNumber: '1302', PayoutDate: PAYOUT, CharityType: 'Food Security' }), 'REQUEST_STATUS_CONFLICT');
  });

  it('reuses a registered charity of the same name and state, or the one named', async () => {
    const db = await d.make();
    const first = await votedRequest(db, 'Passed');
    const one = await db.charities.payApprovedRequest(MEMBER.admin, first, { CheckNumber: '1301', PayoutDate: PAYOUT, CharityType: 'Food Security' });
    const second = await votedRequest(db, 'Passed');
    const two = await db.charities.payApprovedRequest(MEMBER.admin, second, { CheckNumber: '1302', PayoutDate: PAYOUT });
    expect(two).toMatchObject({ charityRegistered: false, charity: { id: one.charity.id } });

    const third = await votedRequest(db, 'Passed', MEMBER.member, { OrganizationName: 'Another Pantry' });
    const three = await db.charities.payApprovedRequest(MEMBER.admin, third, { CheckNumber: '1303', PayoutDate: PAYOUT, CharityID: one.charity.id });
    expect(three.charity.id).toBe(one.charity.id);
  });

  it('refuses a request the vote did not approve, the Shepherd, members, a used check number and an unknown request', async () => {
    const db = await d.make();
    const failed = await votedRequest(db, 'Failed');
    await expectRule(db.charities.payApprovedRequest(MEMBER.admin, failed, { CheckNumber: '1301', PayoutDate: PAYOUT, CharityType: 'Parish' }), 'REQUEST_STATUS_CONFLICT');

    const own = await votedRequest(db, 'Passed', MEMBER.admin);
    await expectRule(db.charities.payApprovedRequest(MEMBER.admin, own, { CheckNumber: '1301', PayoutDate: PAYOUT, CharityType: 'Parish' }), 'SELF_PAYOUT_BLOCKED');

    const id = await votedRequest(db, 'Passed');
    await expectRule(db.charities.payApprovedRequest(MEMBER.member, id, { CheckNumber: '1301', PayoutDate: PAYOUT, CharityType: 'Parish' }), 'FINANCE_OFFICER_REQUIRED');
    await expectRule(db.charities.payApprovedRequest(MEMBER.admin, id, { CheckNumber: '1301', PayoutDate: PAYOUT }), 'INVALID_INPUT'); // not registered, no type
    await db.charities.payApprovedRequest(MEMBER.admin, id, { CheckNumber: '1301', PayoutDate: PAYOUT, CharityType: 'Parish' });
    const another = await votedRequest(db, 'Passed', MEMBER.member, { OrganizationName: 'Second Charity' });
    await expectRule(db.charities.payApprovedRequest(MEMBER.admin, another, { CheckNumber: '1301', PayoutDate: PAYOUT, CharityType: 'Parish' }), 'INVALID_INPUT');
    await expectRule(db.charities.payApprovedRequest(MEMBER.admin, 9999, { CheckNumber: '1309', PayoutDate: PAYOUT }), 'RECORD_NOT_FOUND');
    // Nothing was written by the refused calls.
    expect(d.count(db, 'CharitableDisbursementLedger')).toBe(1);
  });
});
