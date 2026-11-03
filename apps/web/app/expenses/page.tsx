'use client';
// My Expense Reports: every signed-in member's self-service expense desk. A member drafts a sheet of receipts
// (vendor, date, amount, description and an attached receipt file), optionally naming the event or meeting it
// was spent on, saves it as a draft or submits it to the council's leadership, and follows it through Submitted,
// Approved and Reimbursed (with the check that paid it). A sheet leadership returned comes back as a draft with a
// red banner quoting their reason until it is resubmitted. The drivers show a member only their own sheets.
// Sprint 5Z-6: a sheet naming an event or meeting outside its submission window (from the day it starts through the council's
// er_submission_window_days, DEFAULT 30, after it ends; Sprint 7E) shows a padlock and its submit button is disabled; it can still be saved as a draft.
// Sprint 6H: a charity-request dropdown named the council's vetted charitable request the receipts were spent for
// (saved as ExpenseReport.charity_request_id); Sprint 11 Revision 17.0 removed the dropdown. The signature desks then
// pre-select that request's target budget line.
// Sprint 6S: a sheet holds several receipts (merchant, gross total, file), and each line item may be itemised from one
// of them; a line bought for personal use on a shared ticket is ticked 'Personal' and the council does not pay it. The
// Honorary Expense box covers a sheet with no receipt and asks why. With receipt reading connected on the Credentials
// Vault page, 'Read receipt' sends an attached file to Azure Document Intelligence and pre-fills the receipt and lines.
// Sprint 11 Revision 17.0: one row per receipt (Gross Total Amount and Reimbursement Requested, the latter following
// the gross until changed); the itemisation grid, the Personal checkboxes and the charity link are gone.
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  blankReceiptRow,
  canAttachAssetPhoto,
  describeError,
  EXPENSE_DESCRIPTION_MAX_LENGTH,
  expenseReferenceChoices,
  expenseReferenceKey,
  expenseReferenceLabel,
  expenseReferenceSpan,
  expenseWindowLockMessage,
  GROSS_TOTAL_LABEL,
  isLongTermAssetExpense,
  listExpenseReferences,
  MISSING_RECEIPT_REASON_MAX_LENGTH,
  parseExpenseReferenceKey,
  receiptRowsFromSheet,
  receiptRowsToSubmission,
  receiptRowTotals,
  RECEIPT_MERCHANT_MAX_LENGTH,
  REIMBURSEMENT_REQUESTED_LABEL,
  toIsoDate,
  withGrossTotal,
  withReimbursement,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
  type ReceiptRowDraft,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { ExpenseSheetItems, ExpenseStatusPill, HonoraryExpenseBadge, ReceiptLink } from '@/components/ExpenseParts';
import { useCouncilTimings } from '@/components/SettingsParts';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Select, Table, Td, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveToDriveVault, localFileLink } from '@/services/drive-vault-transport';
import { readReceipt, receiptOcrAvailable } from '@/services/receipt-ocr-transport';

type Message = { tone: 'error' | 'info'; text: string };
/** A receipt row on the form; `file` is the attached file while the page is open, for 'Read receipt'. */
type Row = ReceiptRowDraft & { key: number; file?: File };

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [], activities: [] };

// ---- the sheet editor ------------------------------------------------------------------

/**
 * A new sheet (no `detail`) or one of the member's drafts. Sprint 11 Revision 17.0: one row per receipt - date,
 * merchant, description, Gross Total Amount ($) and Reimbursement Requested ($), which follows the gross total until
 * the member types their own figure. No itemisation grid, no Personal checkboxes, no charity link.
 */
function ExpenseSheetForm({
  detail,
  refs,
  today,
  onSaved,
  onCancel,
}: {
  detail: ExpenseReportDetail | null;
  refs: ExpenseReferenceOptions;
  today: string;
  onSaved: (saved: ExpenseReportDetail) => Promise<void>;
  onCancel: () => void;
}) {
  const user = useUser();
  const nextKey = useRef(0);
  const keyed = (row: ReceiptRowDraft): Row => ({ ...row, key: nextKey.current++ });
  const [reference, setReference] = useState(() => (detail ? expenseReferenceKey(detail.report) : ''));
  const [longTermAsset, setLongTermAsset] = useState(() => isLongTermAssetExpense(detail?.report ?? {}));
  const [rows, setRows] = useState<Row[]>(() => {
    const loaded = detail ? receiptRowsFromSheet(detail.receipts, detail.lineItems, today) : [];
    return (loaded.length > 0 ? loaded : [blankReceiptRow(today)]).map(keyed);
  });
  const [honoraryExpense, setHonoraryExpense] = useState(() => Boolean(detail?.report.flag_missing_receipt));
  const [missingReason, setMissingReason] = useState(() => detail?.report.missing_receipt_reason ?? '');
  const ocr = useLoad(receiptOcrAvailable, []);
  const [reading, setReading] = useState<number | null>(null);
  const [busy, setBusy] = useState<'Draft' | 'Submitted' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const choices = useMemo(() => expenseReferenceChoices(refs), [refs]);
  const span = expenseReferenceSpan(reference, refs);
  const windowDays = useCouncilTimings().er_submission_window_days;
  const locked = span ? expenseWindowLockMessage(span, today, windowDays) : null;
  const totals = receiptRowTotals(rows);

  const update = (key: number, change: (row: Row) => Row) => setRows((now) => now.map((r) => (r.key === key ? change(r) : r)));
  /** Sprint 6D: an Admin's receipt goes to the Drive vault's Vouchers folder; otherwise it is a browser blob link. */
  const storeFile = async (file: File) => (await archiveToDriveVault(user, 'voucher', file)) ?? localFileLink(file);
  const attach = async (key: number, file: File | undefined) => {
    if (!file) return;
    try {
      const url = await storeFile(file);
      update(key, (r) => ({ ...r, receipt_file_url: url, file }));
    } catch (err) {
      setError(describeError(err));
    }
  };
  /** 'Read receipt': Azure's merchant, date and total fill the row. */
  const ocrReceipt = async (index: number, row: Row) => {
    if (!row.file) return;
    setReading(row.key);
    setError(null);
    setNotice(null);
    try {
      const result = await readReceipt(row.file);
      update(row.key, (r) => {
        const filled: Row = { ...r, Merchant: r.Merchant.trim() || result.merchantName || '' };
        if (result.transactionDate && result.transactionDate <= today) filled.DateOfExpense = result.transactionDate;
        return result.total !== null ? { ...withGrossTotal(filled, result.total.toFixed(2)), key: r.key, file: r.file } : filled;
      });
      setNotice(`Read receipt ${index + 1}${result.merchantName ? ` from ${result.merchantName}` : ''}. Check every figure before you submit.`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setReading(null);
    }
  };

  const save = async (status: 'Draft' | 'Submitted') => {
    setBusy(status);
    setError(null);
    try {
      const { receipts, items } = receiptRowsToSubmission(rows);
      const saved = await db.expenses.submitReport(
        user.memberId,
        {
          id: detail?.report.id ?? null,
          Status: status,
          ...parseExpenseReferenceKey(reference),
          is_long_term_asset: longTermAsset,
          // The charity link left the form; a draft that already carries one keeps it.
          charity_request_id: detail?.report.charity_request_id ?? null,
          receipts,
          flag_missing_receipt: honoraryExpense,
          missing_receipt_reason: honoraryExpense ? missingReason : null,
        },
        items,
      );
      await onSaved(saved);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked) void save('Submitted');
      }}
    >
      {detail?.report.RejectionReason ? (
        <Notice tone="error">
          <span className="font-bold">Returned by council leadership:</span> <span className="whitespace-pre-wrap">{detail.report.RejectionReason}</span>
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      <Field
        label="Spent for"
        hint="The event, meeting or ongoing activity (such as the Ultrasound Initiative) these receipts were for, if any."
        className="max-w-xl"
      >
        {(id) => (
          <Select id={id} value={reference} onChange={(e) => setReference(e.target.value)}>
            <option value="">General council expense (no event, meeting or activity)</option>
            {(['Events', 'Meetings', 'Activities'] as const).map((group) => {
              const options = choices.filter((c) => c.group === group);
              return options.length === 0 ? null : (
                <optgroup key={group} label={group}>
                  {options.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        )}
      </Field>

      <label className="flex max-w-xl items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4" checked={longTermAsset} onChange={(e) => setLongTermAsset(e.target.checked)} />
        <span>
          <span className="font-bold">This item is a long-term Council Asset</span>
          <span className="block text-xs text-muted">
            When the Grand Knight approves this report, the item is added to the council’s assets inventory at the report total.
          </span>
        </span>
      </label>

      {notice ? (
        <Notice tone="info" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      ) : null}

      <section aria-labelledby="receipts-heading" className="flex flex-col gap-2">
        <h3 id="receipts-heading" className="font-serif text-lg font-bold">
          Receipts
        </h3>
        <p className="text-sm text-muted">
          One row per receipt. {REIMBURSEMENT_REQUESTED_LABEL} matches the gross total unless you change it; the difference stays on record as personal.
        </p>
        <Table caption="Receipts on this report" head={['#', 'Date', 'Merchant', 'Description', GROSS_TOTAL_LABEL, REIMBURSEMENT_REQUESTED_LABEL, 'Receipt file', '']}>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <Td className="text-xs font-bold">{i + 1}</Td>
              <Td className="w-40">
                <Input
                  type="date"
                  aria-label={`Receipt ${i + 1} date`}
                  required
                  max={today}
                  value={r.DateOfExpense}
                  onChange={(e) => update(r.key, (x) => ({ ...x, DateOfExpense: e.target.value }))}
                />
              </Td>
              <Td className="min-w-36">
                <Input
                  aria-label={`Receipt ${i + 1} merchant`}
                  maxLength={RECEIPT_MERCHANT_MAX_LENGTH}
                  placeholder="e.g. Costco"
                  value={r.Merchant}
                  onChange={(e) => update(r.key, (x) => ({ ...x, Merchant: e.target.value }))}
                />
              </Td>
              <Td className="min-w-48">
                <Input
                  aria-label={`Receipt ${i + 1} description`}
                  maxLength={EXPENSE_DESCRIPTION_MAX_LENGTH}
                  placeholder="What was bought"
                  value={r.Description}
                  onChange={(e) => update(r.key, (x) => ({ ...x, Description: e.target.value }))}
                />
              </Td>
              <Td className="w-32">
                <Input
                  aria-label={`Receipt ${i + 1} gross total`}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-right"
                  value={r.GrossTotal}
                  onChange={(e) => update(r.key, (x) => ({ ...withGrossTotal(x, e.target.value), key: x.key, file: x.file }))}
                />
              </Td>
              <Td className="w-32">
                <Input
                  aria-label={`Receipt ${i + 1} reimbursement requested`}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-right"
                  value={r.Reimbursement}
                  onChange={(e) => update(r.key, (x) => ({ ...withReimbursement(x, e.target.value), key: x.key, file: x.file }))}
                />
              </Td>
              <Td className="min-w-48">
                {r.receipt_file_url ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <ReceiptLink url={r.receipt_file_url} />
                    {r.file && ocr.data ? (
                      <Button size="sm" disabled={reading !== null} onClick={() => void ocrReceipt(i, r)}>
                        {reading === r.key ? 'Reading…' : 'Read receipt'}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="secondary" onClick={() => update(r.key, (x) => ({ ...x, receipt_file_url: '', file: undefined }))}>
                      Remove file
                    </Button>
                  </span>
                ) : (
                  <label className="inline-block cursor-pointer rounded border-2 border-navy bg-white px-2 py-0.5 text-xs font-bold text-navy focus-within:outline-2">
                    Attach receipt…
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      aria-label={`Receipt ${i + 1} file`}
                      className="sr-only"
                      onChange={(e) => {
                        void attach(r.key, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </Td>
              <Td className="text-right">
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Remove receipt ${i + 1}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((now) => now.filter((x) => x.key !== r.key))}
                >
                  ×
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setRows((now) => [...now, keyed(blankReceiptRow(today))])}>
              + Add receipt
            </Button>
            {ocr.data ? <span className="text-xs text-muted">Attach a receipt photo, then choose Read receipt to fill it in.</span> : null}
          </span>
          <p className="text-sm">
            {totals.personal > 0 ? <span className="mr-4 text-muted">Personal, not reimbursed: {formatMoney(totals.personal)}</span> : null}
            <span className="text-xs font-bold uppercase tracking-wide">Council reimburses </span>
            <span className="text-lg font-bold">{formatMoney(totals.reimbursed)}</span>
          </p>
        </div>
      </section>

      <div className="flex max-w-xl flex-col gap-2 rounded border-2 border-navy p-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" checked={honoraryExpense} onChange={(e) => setHonoraryExpense(e.target.checked)} />
          <span>
            <span className="font-bold">I have no receipt (Honorary Expense)</span>
            <span className="block text-xs text-muted">The receipt was lost or never given. Leadership sees an Honorary Expense warning on this report.</span>
          </span>
        </label>
        {honoraryExpense ? (
          <Field label="Why is there no receipt? (required)" hint={`${missingReason.trim().length}/${MISSING_RECEIPT_REASON_MAX_LENGTH} characters.`}>
            {(id) => (
              <Textarea
                id={id}
                required
                maxLength={MISSING_RECEIPT_REASON_MAX_LENGTH}
                placeholder="e.g. Cash purchase at the farmers market; the stall gave no receipt."
                value={missingReason}
                onChange={(e) => setMissingReason(e.target.value)}
              />
            )}
          </Field>
        ) : null}
      </div>

      {locked ? (
        <p role="status" className="flex items-center gap-2 rounded border-2 border-navy px-3 py-2 text-sm font-bold">
          {locked}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button type="submit" disabled={busy !== null || locked !== null} title={locked ?? undefined}>
          {locked ? 'Submission locked' : busy === 'Submitted' ? 'Submitting…' : 'Submit for approval'}
        </Button>
        <Button variant="secondary" disabled={busy !== null} onClick={() => void save('Draft')}>
          {busy === 'Draft' ? 'Saving…' : 'Save draft'}
        </Button>
        <Button variant="secondary" disabled={busy !== null} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- a sheet that is no longer the member's to edit ------------------------------------

function ExpenseSheetView({ detail, refs }: { detail: ExpenseReportDetail; refs: ExpenseReferenceOptions }) {
  const { report, disbursement } = detail;
  const note: Record<typeof report.Status, string> = {
    Draft: '',
    Submitted: report.FinancialSecretaryMemberID != null
      ? 'The Financial Secretary issued the payment request; waiting for the Grand Knight’s counter-signature.'
      : 'Waiting for the Financial Secretary’s payment request.',
    Approved: 'Approved. The Financial Secretary or Treasurer will include it in the next check run.',
    Reimbursed: 'Paid.',
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <ExpenseStatusPill report={report} />
        <span>{expenseReferenceLabel(report, refs)}</span>
        {report.charity_request_id != null ? <span className="font-bold">Charitable request #{report.charity_request_id}</span> : null}
        {isLongTermAssetExpense(report) ? <span className="text-xs font-bold uppercase tracking-wide">Long-term Council Asset</span> : null}
        <span className="text-muted">{note[report.Status]}</span>
      </div>
      {disbursement ? (
        <Notice tone="info">
          Reimbursed by check <span className="font-bold">{disbursement.CheckNumber}</span> dated {formatFullDate(disbursement.PayoutDate)}.
        </Notice>
      ) : null}
      <HonoraryExpenseBadge detail={detail} withReason />
      <ExpenseSheetItems detail={detail} />
    </div>
  );
}

// ---- the page --------------------------------------------------------------------------

function MyExpenses() {
  const user = useUser();
  const today = toIsoDate(new Date());
  const reports = useLoad(() => db.expenses.listUserReports(user.memberId), [user.memberId]);
  const refsLoad = useLoad(() => listExpenseReferences(db, user.councilId), [user.councilId]);
  const refs = refsLoad.data ?? NO_REFS;
  const [openId, setOpenId] = useState<number | 'new' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const list = reports.data ?? [];
  const returned = list.filter((d) => d.report.Status === 'Draft' && d.report.RejectionReason);
  const selected = typeof openId === 'number' ? list.find((d) => d.report.id === openId) : undefined;
  const editing = openId === 'new' || selected?.report.Status === 'Draft';
  const open = (id: number | 'new' | null) => {
    setOpenId(id);
    setMessage(null);
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-center gap-4">
            {/* Sprint 7F Extension: the Deputy Grand Knight and Trustees reach the assets inventory from here to add photos. */}
            {canAttachAssetPhoto(user, user.councilId) ? (
              <Link href="/expenses/assets" className="text-sm font-bold underline">
                Council assets
              </Link>
            ) : null}
            <Button onClick={() => open('new')}>New expense report</Button>
          </div>
        }
      >
        My Expense Reports
      </PageTitle>
      {reports.error ?? refsLoad.error ? <Notice tone="error">{reports.error ?? refsLoad.error}</Notice> : null}

      {returned.map(({ report, total }) => (
        <section key={report.id} role="alert" aria-labelledby={`returned-${report.id}`} className="mb-4 overflow-hidden rounded border-4 border-brand-red bg-white">
          <header className="flex flex-wrap items-center justify-between gap-3 bg-brand-red px-4 py-2 text-white">
            <h2 id={`returned-${report.id}`} className="font-serif text-lg font-bold">
              Expense report #{report.id} ({formatMoney(total)}) was returned for changes
            </h2>
            <Button variant="secondary" size="sm" onClick={() => open(report.id)}>
              Fix and resubmit
            </Button>
          </header>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-red">Reason from council leadership</p>
            <p className="whitespace-pre-wrap text-base text-navy">{report.RejectionReason}</p>
          </div>
        </section>
      ))}

      {message ? (
        <div className="mb-4">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <Panel title={`My reports (${list.length})`}>
          {reports.loading && !reports.data ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : list.length === 0 ? (
            <Empty>You have not filed any expense reports. Choose “New expense report” to claim a reimbursement.</Empty>
          ) : (
            <Table caption="My expense reports, newest first" head={['Report', 'Spent for', 'Receipts', 'Total', 'Status', 'Paid by check', '']}>
              {list.map((d) => {
                const chosen = d.report.id === openId;
                return (
                  <tr key={d.report.id}>
                    <Td className="font-bold">#{d.report.id}</Td>
                    <Td>{expenseReferenceLabel(d.report, refs)}</Td>
                    <Td>{d.lineItems.length}</Td>
                    <Td className="whitespace-nowrap text-right font-bold">{formatMoney(d.total)}</Td>
                    <Td>
                      <ExpenseStatusPill report={d.report} />
                    </Td>
                    <Td className="text-xs">{d.disbursement ? `${d.disbursement.CheckNumber} · ${formatFullDate(d.disbursement.PayoutDate)}` : '–'}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant={chosen ? 'primary' : 'secondary'} aria-pressed={chosen} onClick={() => open(chosen ? null : d.report.id)}>
                        {d.report.Status === 'Draft' ? 'Edit' : 'View'}
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>

        {editing ? (
          <Panel title={openId === 'new' ? 'New expense report' : `Edit draft #${openId}`}>
            <ExpenseSheetForm
              key={String(openId)}
              detail={selected ?? null}
              refs={refs}
              today={today}
              onCancel={() => open(null)}
              onSaved={async (saved) => {
                await reports.reload();
                setOpenId(saved.report.Status === 'Draft' ? saved.report.id : null);
                setMessage({
                  tone: 'info',
                  text:
                    saved.report.Status === 'Draft'
                      ? `Saved draft #${saved.report.id} (${formatMoney(saved.total)}). Submit it when your receipts are complete.`
                      : `Submitted report #${saved.report.id} for ${formatMoney(saved.total)} to your council’s leadership.`,
                });
              }}
            />
          </Panel>
        ) : selected ? (
          <Panel title={`Expense report #${selected.report.id}`} actions={<Button size="sm" variant="secondary" onClick={() => open(null)}>Close</Button>}>
            <ExpenseSheetView detail={selected} refs={refs} />
          </Panel>
        ) : null}
      </div>
    </>
  );
}

export default function ExpensesPage() {
  return (
    <RequireArea area="expenses">
      <MyExpenses />
    </RequireArea>
  );
}
