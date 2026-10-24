// =========================================================================
// THE PILOT HUB (Sprint 9 Revision 4.0)
// One laptop holds the council's data for a room pilot in one SQLite file on its disk,
// packages/backend/data/central-hub-vault.db, which is never wiped: it keeps every record from every session. Every
// other laptop and phone on the room Wi-Fi works on that one file live, through POST /api/sync/replicate, instead of on
// its own copy. A record saved on one device is there for every device at once, so there are no copies to merge, no
// record numbers to clash, and every business rule runs in one place, on the hub.
//
// The wire format: the device sends { method: '<namespace>.<method>', args: [...] } - any DataService method - and the
// hub answers { ok: true, result } or { ok: false, error } (the BusinessRuleError, rebuilt on the device by
// decodeHubError). createHubDataService turns that into an ordinary DataService, so screens do not change.
//
// Who may call what (assertHubCallAllowed, on the hub):
//   - before sign-in, only HUB_PUBLIC_METHODS (sign-in, setup-code sign-up, password reset, the access request form);
//   - after sign-in, any method, but a method that names its caller - its first argument is actorId
//     (HUB_ACTOR_FIRST_METHODS, every such method in contract.ts) or one of HUB_SELF_ARGUMENTS - must name the signed-in
//     member (HUB_IDENTITY_MISMATCH);
//   - while a Super Admin views the portal as another member, reads only (isViewAsReadMethod; VIEW_AS_READ_ONLY).
// A method that takes another member's id for a read (e.g. events.listMemberShifts) is trusted as the device's own
// copy always was: its rules run inside the data service, by the ids it is given.
// =========================================================================
import { BusinessRuleError, SecurityPrivilegeError, type BusinessRuleCode } from './rules';
import { isViewAsReadMethod } from './platform-access';
import type { DataService } from './contract';

/** The hub's call route and its photo route. */
export const HUB_SYNC_ROUTE = '/api/sync/replicate';
export const HUB_PHOTO_ROUTE = '/api/sync/photo';
/** The vault file's path from the repository root. */
export const HUB_VAULT_RELATIVE_PATH = 'packages/backend/data/central-hub-vault.db';
/** The data driver name that turns hub mode on (NEXT_PUBLIC_DATA_DRIVER / EXPO_PUBLIC_DATA_DRIVER). */
export const HUB_DATA_DRIVER = 'hub';

/** One call from a device. */
export interface HubCall {
  method: string;
  args: unknown[];
}

/** A BusinessRuleError as it travels. */
export interface HubError {
  name: string;
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export type HubReply = { ok: true; result: unknown } | { ok: false; error: HubError };

/** Methods a device may call before it signs in. */
export const HUB_PUBLIC_METHODS: ReadonlySet<string> = new Set([
  'init',
  'auth.signIn',
  'auth.signUp',
  'auth.requestPasswordReset',
  'auth.verifyPasswordResetCode',
  'auth.resetPassword',
  'accessRequests.submit',
]);

/** Every DataService method whose first argument is actorId (contract.ts; tests/hub-sync.test.ts keeps the list current). */
export const HUB_ACTOR_FIRST_METHODS: ReadonlySet<string> = new Set([
  'accessRequests.list', 'accessRequests.setStatus', 'activities.create', 'activities.remove', 'activities.update',
  'auth.impersonate', 'budget.addCustomBudgetLine', 'budget.approveAndFinalizeEntireBudget',
  'budget.getBudgetAnalysis', 'budget.getBudgetProgress', 'budget.getConcludedPerformance',
  'budget.getHistoricalKPIs', 'budget.getPriorYearBaselines', 'budget.listAnnualForecast', 'budget.listLineVersions',
  'budget.markBudgetYearReviewed', 'budget.prePopulateNextYear', 'budget.setTargetSpendingCeiling',
  'charities.addGlobalCharity', 'charities.connectCouncilToCharity', 'charities.endorseApprovedRequest',
  'charities.listApprovedFundingQueue', 'charities.listCharitableRequestsQueue', 'charities.listCouncilLedger',
  'charities.listCouncilProposals', 'charities.listLinkableCharitableRequests', 'charities.listMyCharitableRequests',
  'charities.listMyProposals', 'charities.listRequestThreads', 'charities.listSuggestedLocal',
  'charities.openRequestThread', 'charities.payApprovedRequest', 'charities.postRequestThreadMessage',
  'charities.proposeDonation', 'charities.rejectProposal', 'charities.routeRequestToNextEligibleAgenda',
  'charities.searchGlobalRegistry', 'charities.submitCharitableRequest', 'charities.triageRequestStatus',
  'councils.create', 'councils.getMeetingGeofence', 'councils.listAffiliationDirectory', 'councils.remove',
  'councils.requestAffiliation', 'councils.respondToAffiliation', 'councils.setBiometricLoginEnabled',
  'councils.setBylaws', 'councils.setCouncilWideSettings', 'councils.setDuesRate', 'councils.setEmailGateway',
  'councils.setFeatureFlags', 'councils.setGlobalParameters', 'councils.setLoanerLibraryEnabled',
  'councils.setMeetingGeofence', 'councils.setParishSplitSettings', 'councils.setPlatformSettings',
  'councils.setRankThresholds', 'councils.update', 'devotionals.getProgress', 'devotionals.record',
  'distributionLists.create', 'distributionLists.listForMember', 'distributionLists.remove',
  'distributionLists.update', 'donations.attachDepositPhoto', 'donations.listAttachments', 'donations.record',
  'donations.remove', 'donations.update', 'elections.assignAppointedRole', 'elections.concludeFraternalYear',
  'elections.dispatchRoadmapAlerts', 'elections.getFraternalRoadmap', 'elections.recordOfficerAbdication',
  'elections.submitNomination', 'elections.toggleRoleBallotStatus', 'events.concludeCollectionSession',
  'events.deletePlanningTime', 'events.getQuickCheckInBoard', 'events.logPlanningTime', 'events.quickCheckIn', 'events.setFlyerFile', 'events.setIntakeSessionStatus',
  'events.setNoShow', 'events.uploadPhotos', 'expenses.financialSecretaryAuditOrder', 'expenses.getAssetRecord',
  'expenses.getAssetRecordForExpense', 'expenses.grandKnightAuthorizeOrder', 'expenses.listAssetsInventory',
  'expenses.listAuthorizationQueue', 'expenses.listCouncilQueue', 'expenses.listLoanerLibrary',
  'expenses.listTreasurerQueue', 'expenses.listUserReports', 'expenses.rejectReport', 'expenses.setAssetPhoto',
  'expenses.submitReport', 'expenses.treasurerLedgerAudit', 'expenses.updateAssetLoan', 'expenses.updateAssetRecord',
  'feedback.listInbox', 'finance.batchCodeDonations', 'finance.closeCashAudit', 'finance.getAccountLedger',
  'finance.getBatchCodingQueue', 'finance.getCashAuditBoard', 'finance.getCouncilNetWorth',
  'finance.getLatestBalanceSheet', 'finance.getParishSplitConsole', 'finance.getTrusteeAudit',
  'finance.issueChurchDisbursementRequest', 'finance.listChartOfAccounts', 'finance.listLedgerTransactions',
  'finance.listTrusteeAudits', 'finance.logConcludedRevenue', 'finance.logDoubleEntryTransaction',
  'finance.recordChurchDisbursementPayment', 'finance.signTrusteeAudit', 'history.addDiaryEntry',
  'history.addOperationsKnowledge', 'history.compileInMemoriam', 'history.getInMemoriamRoll',
  'history.getLegacyMatrix', 'history.listBulletinFeed', 'history.listHistorianBulletins',
  'history.listLeadershipSnapshots', 'history.listOperationsKnowledge', 'history.saveHistorianBulletin',
  'history.saveInMemoriamEntry', 'history.saveYearAnnals', 'lessonsLearned.add', 'lessonsLearned.listGlobalRegistry',
  'lessonsLearned.remove', 'lookups.remove', 'lookups.removeCouncilSpecific', 'media.deleteSmartAlbum',
  'media.getLibrary', 'media.listSmartAlbums', 'media.saveSmartAlbum', 'media.uploadToVault',
  'meetings.addAgendaLine', 'meetings.applyAgendaBlueprint', 'meetings.castAnonymousMobileVote',
  'meetings.closeLiveAssemblyConsole', 'meetings.editAgendaLine', 'meetings.finalizeProposedMotionVote',
  'meetings.geofencedCheckIn', 'meetings.getLiveAssemblyState', 'meetings.getMeetingAgenda',
  'meetings.launchLiveMeeting', 'meetings.launchSecretSmartphoneBallot', 'meetings.linkGoogleDrive',
  'meetings.linkHandTallyTransaction', 'meetings.logLiveAttendanceOverride', 'meetings.populateAnnualCadence',
  'meetings.removeCadenceConfig', 'meetings.rsvpToInvite', 'meetings.saveAgendaTemplate',
  'meetings.saveCadenceConfig', 'meetings.saveMeetingMinutes', 'meetings.setCheckInPhoto',
  'meetings.setMeetingPhoto', 'meetings.startLiveAssemblyConsole', 'members.create', 'members.listAffiliations',
  'members.resendWelcome', 'members.sweepInactive', 'members.update', 'notifications.dispatchHighPriorityAlert',
  'notifications.listMemberAlerts', 'notifications.markAsRead', 'notifications.registerDeviceToken',
  'parishes.create', 'parishes.remove', 'parishes.update', 'pastors.create', 'pastors.remove', 'pastors.update',
  'prayers.addIntention', 'prayers.closeIntention', 'prayers.getBoard', 'prayers.pray', 'reports.councilEngagement',
  'reports.getCouncilGoals', 'reports.markCouncilGoalsReviewed', 'reports.memberCenter',
  'reports.missionAreaFootprint', 'reports.setCouncilGoals', 'reports.yearOverYearTrends', 'supreme.listSyncHistory',
  'supreme.previewReport', 'supreme.syncSupremeRoster', 'volunteerQuarantine.clear',
  'volunteerQuarantine.listPending', 'volunteerQuarantine.listReturned', 'volunteerQuarantine.reject',
  'volunteerQuarantine.resubmit',
]);

/**
 * Methods that act as one member through another argument: the index of the member id, or 'senderId' for a message
 * input object.
 */
export const HUB_SELF_ARGUMENTS: Readonly<Record<string, number | 'senderId'>> = {
  'events.signupForShift': 0,
  'eventTime.logHours': 0,
  'activityTime.logHours': 0,
  'activityTime.addQuarterHour': 0,
  'feedback.submit': 0,
  'messages.listThreads': 0,
  'messages.deleteDraft': 1,
  'messages.setRead': 1,
  'messages.send': 'senderId',
  'messages.saveDraft': 'senderId',
};

/** '<namespace>.<method>' with plain names only, so nothing but the service's own methods can be reached. */
const METHOD_NAME = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/** Whether a call's method name has the form the hub accepts. */
export const isHubMethodName = (method: string): boolean => method === 'init' || METHOD_NAME.test(method);

/** The signed-in caller as the hub's session cookie vouches for them. */
export interface HubCaller {
  memberId: number;
  /** Set while a Super Admin views the portal as this member. */
  impersonatorId?: number;
}

/** The member id a call names as its caller, or undefined when it names none. */
export function hubCallerArgument(call: HubCall): unknown {
  if (HUB_ACTOR_FIRST_METHODS.has(call.method)) return call.args[0];
  const self = HUB_SELF_ARGUMENTS[call.method];
  if (self === undefined) return undefined;
  if (self === 'senderId') {
    const input = call.args[0];
    return typeof input === 'object' && input !== null ? (input as Record<string, unknown>).senderId : null;
  }
  return call.args[self];
}

/**
 * Rejects a call the caller may not make: INVALID_INPUT for a malformed method name, HUB_SESSION_REQUIRED without a
 * session for anything but HUB_PUBLIC_METHODS, VIEW_AS_READ_ONLY for a write in a view-as session, and
 * HUB_IDENTITY_MISMATCH when the call names someone other than the signed-in member as its caller.
 */
export function assertHubCallAllowed(call: HubCall, caller: HubCaller | null): void {
  if (typeof call.method !== 'string' || !isHubMethodName(call.method) || !Array.isArray(call.args)) {
    throw new BusinessRuleError('INVALID_INPUT', 'A hub call needs a method named "namespace.method" and an argument list.', {});
  }
  if (HUB_PUBLIC_METHODS.has(call.method)) return;
  if (!caller) throw new BusinessRuleError('HUB_SESSION_REQUIRED', 'Sign in again: the hub has no session for this device.', { method: call.method });
  const name = call.method.split('.')[1] ?? '';
  if (caller.impersonatorId !== undefined && !isViewAsReadMethod(name)) {
    throw new BusinessRuleError('VIEW_AS_READ_ONLY', 'You are viewing the portal as another member, so nothing can be saved. Return to your own account first.', {
      method: call.method,
    });
  }
  const named = hubCallerArgument(call);
  if (named !== undefined && named !== caller.memberId) {
    throw new BusinessRuleError('HUB_IDENTITY_MISMATCH', `This device is signed in as member ${caller.memberId}, so it cannot act as member ${String(named)}.`, {
      method: call.method,
      memberId: caller.memberId,
    });
  }
}

/** A thrown value as it travels back to the device. */
export function encodeHubError(err: unknown): HubError {
  if (err instanceof BusinessRuleError) return { name: err.name, code: err.code, message: err.message, details: err.details };
  return { name: 'Error', code: 'HUB_ERROR', message: err instanceof Error ? err.message : String(err), details: {} };
}

/** The error a hub answer carries, rebuilt so describeError and expectRule treat it like a local one. */
export function decodeHubError(error: HubError): Error {
  if (error.name === 'SecurityPrivilegeError') {
    return new SecurityPrivilegeError(error.code as ConstructorParameters<typeof SecurityPrivilegeError>[0], error.message, error.details);
  }
  if (error.name === 'BusinessRuleError') return new BusinessRuleError(error.code as BusinessRuleCode, error.message, error.details);
  return new Error(error.message);
}

/** Sends one call to the hub and resolves to its answer. */
export type HubTransport = (call: HubCall) => Promise<HubReply>;

/**
 * A DataService whose every method is a call to the hub. `init` asks the hub to open the vault. Unknown namespaces
 * resolve to objects whose methods still go to the hub, which refuses names it does not have.
 */
export function createHubDataService(transport: HubTransport): DataService {
  const call = async (method: string, args: unknown[]): Promise<unknown> => {
    const reply = await transport({ method, args });
    if (reply.ok) return reply.result;
    throw decodeHubError(reply.error);
  };
  const namespaces = new Map<string, object>();
  const namespace = (ns: string) =>
    new Proxy(
      {},
      {
        get: (_t, method) => (typeof method === 'string' ? (...args: unknown[]) => call(`${ns}.${method}`, args) : undefined),
      },
    );
  return new Proxy({} as DataService, {
    get: (_t, prop) => {
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      if (prop === 'init') return () => call('init', []).then(() => undefined);
      if (!namespaces.has(prop)) namespaces.set(prop, namespace(prop));
      return namespaces.get(prop);
    },
  });
}

/** A transport over fetch to `baseUrl` + HUB_SYNC_ROUTE ('' for the same origin). The session cookie rides along. */
export function fetchHubTransport(baseUrl = '', fetchImpl: typeof fetch = fetch): HubTransport {
  return async (call) => {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${HUB_SYNC_ROUTE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(call),
      });
    } catch {
      return { ok: false, error: { name: 'BusinessRuleError', code: 'HUB_UNREACHABLE', message: 'The pilot hub laptop cannot be reached. Check that this device is on the room Wi-Fi.', details: {} } };
    }
    const body = (await res.json().catch(() => null)) as HubReply | null;
    if (body && typeof body === 'object' && 'ok' in body) return body;
    return { ok: false, error: { name: 'Error', code: 'HUB_ERROR', message: `The hub answered ${res.status} without a result.`, details: {} } };
  };
}
