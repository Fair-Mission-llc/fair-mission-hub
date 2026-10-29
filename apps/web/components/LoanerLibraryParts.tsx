'use client';
// The Shared Equipment Library (Sprint 8F, loaner-library.ts). LoanerLibraryDirectory is the shared directory every
// member reads at /inventory/loaner-library: the listed items of every council, available first, with who has each one
// and when it is due back. LoanerLibraryManager is the lending desk of one council - on the Grand Knight Desk (which
// the Deputy Grand Knight shares) and on the library page for those leaders: an "In the loaner library" switch per
// asset, Pause and Resume, a check-out form (borrower, council, expected return date) and a one-click "Log return".
// The commands are expenses.updateAssetLoan, gated by assertMayLendCouncilAssets.
//
// Sprints 8G/8H: the directory shows the member's own council's items and, from each ACTIVE affiliate, its items only
// while both councils have loaner library sharing on (visibleInLoanerLibrary). Own items carry a "Your council" badge.
import { useState } from 'react';
import {
  ASSET_LOAN_STATUS_LABELS,
  describeError,
  isLoanable,
  isLoanOverdue,
  loanStatusOf,
  toIsoDate,
  type AssetLoanChange,
  type CouncilAssetLoanStatus,
  type CouncilAssetsInventory,
  type SessionUser,
} from '@kofc/shared';
import { Button, cx, Empty, Field, Input, Notice, Panel, Pill, Switch, Table, Td } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function LoanStatusPill({ status, overdue }: { status: CouncilAssetLoanStatus; overdue: boolean }) {
  if (overdue) return <Pill tone="red">Overdue</Pill>;
  return <Pill tone={status === 'AVAILABLE' ? 'navy' : status === 'CHECKED_OUT' ? 'gold' : 'outline'}>{ASSET_LOAN_STATUS_LABELS[status]}</Pill>;
}

/** The shared directory: every council's listed items. */
export function LoanerLibraryDirectory({ user }: { user: SessionUser }) {
  const library = useLoad(() => db.expenses.listLoanerLibrary(user.memberId), [user.memberId]);
  const rows = library.data ?? [];
  const available = rows.filter((r) => r.loanStatus === 'AVAILABLE').length;
  return (
    <Panel title={`Shared inventory directory (${rows.length})`} actions={library.data ? <Pill tone="navy">{available} available</Pill> : null}>
      {library.error ? <Notice tone="error">{library.error}</Notice> : null}
      {library.data && rows.length === 0 ? <Empty>No item is listed yet by your council or a council it shares with.</Empty> : null}
      {rows.length > 0 ? (
        <Table caption="Items councils lend to each other" head={['Item', 'Owning council', 'Status', 'With', 'Due back']}>
          {rows.map((r) => (
            <tr key={r.assetId}>
              <Td className="font-bold">{r.assetName}</Td>
              <Td>
                {r.councilName}
                {r.councilNumber ? <span className="block text-xs text-muted">Council {r.councilNumber}</span> : null}
                {r.homeCouncil ? <Pill tone="outline">Your council</Pill> : null}
              </Td>
              <Td>
                <LoanStatusPill status={r.loanStatus} overdue={r.overdue} />
              </Td>
              <Td>
                {r.loanStatus === 'CHECKED_OUT' ? (
                  <>
                    {r.borrowerName}
                    <span className="block text-xs text-muted">{r.borrowerCouncil}</span>
                  </>
                ) : (
                  '–'
                )}
              </Td>
              <Td className={cx('whitespace-nowrap', r.overdue && 'font-bold text-brand-red')}>{r.expectedReturnDate ? formatFullDate(r.expectedReturnDate) : '–'}</Td>
            </tr>
          ))}
        </Table>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        To borrow an item, call the owning council&apos;s Grand Knight. Their Grand Knight or Deputy Grand Knight checks it out to you here. A brother
        council&apos;s items show only when your councils are affiliated and both have loaner library sharing on in Council Wide Settings.
      </p>
    </Panel>
  );
}

/** The check-out form under one asset. */
function CheckOutForm({ onSubmit, busy }: { onSubmit: (change: Extract<AssetLoanChange, { action: 'check-out' }>) => void; busy: boolean }) {
  const [name, setName] = useState('');
  const [council, setCouncil] = useState('');
  const [due, setDue] = useState('');
  return (
    <form
      className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ action: 'check-out', borrower_name: name, borrower_council: council, expected_return_date: due });
      }}
    >
      <Field label="Borrower">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
      <Field label="Borrowing council">{(id) => <Input id={id} value={council} onChange={(e) => setCouncil(e.target.value)} required />}</Field>
      <Field label="Expected return">{(id) => <Input id={id} type="date" value={due} min={toIsoDate(new Date())} onChange={(e) => setDue(e.target.value)} required />}</Field>
      <Button type="submit" size="sm" disabled={busy}>
        Check out
      </Button>
    </form>
  );
}

function AssetLoanRow({ asset, onChange, busy }: { asset: CouncilAssetsInventory; onChange: (change: AssetLoanChange) => void; busy: boolean }) {
  const [checkingOut, setCheckingOut] = useState(false);
  const listed = isLoanable(asset);
  const status = loanStatusOf(asset);
  const overdue = isLoanOverdue(asset, toIsoDate(new Date()));
  return (
    <li className="rounded border-2 border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{asset.asset_name}</p>
          {status === 'CHECKED_OUT' ? (
            <p className={cx('text-xs', overdue ? 'font-bold text-brand-red' : 'text-muted')}>
              With {asset.borrower_name} ({asset.borrower_council}) · due back {formatFullDate(asset.expected_return_date ?? null)}
            </p>
          ) : null}
        </div>
        {listed ? <LoanStatusPill status={status} overdue={overdue} /> : <Pill tone="outline">Not lent</Pill>}
      </div>
      <div className="mt-2">
        <Switch
          checked={listed}
          disabled={busy || (listed && status === 'CHECKED_OUT')}
          label="In the loaner library"
          description={listed && status === 'CHECKED_OUT' ? 'Log the return before taking it out of the library.' : 'Brother councils can see and borrow it.'}
          onChange={(next) => onChange({ action: next ? 'list' : 'unlist' })}
        />
      </div>
      {listed ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {status === 'AVAILABLE' ? (
            <>
              <Button size="sm" onClick={() => setCheckingOut((v) => !v)} disabled={busy}>
                {checkingOut ? 'Cancel check-out' : 'Check out'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onChange({ action: 'pause' })} disabled={busy}>
                Pause (hold out of the pool)
              </Button>
            </>
          ) : null}
          {status === 'UNAVAILABLE' ? (
            <Button size="sm" variant="secondary" onClick={() => onChange({ action: 'resume' })} disabled={busy}>
              Resume lending
            </Button>
          ) : null}
          {status === 'CHECKED_OUT' ? (
            <Button size="sm" variant="gold" onClick={() => onChange({ action: 'return' })} disabled={busy}>
              Log return
            </Button>
          ) : null}
        </div>
      ) : null}
      {listed && status === 'AVAILABLE' && checkingOut ? (
        <CheckOutForm
          busy={busy}
          onSubmit={(change) => {
            onChange(change);
            setCheckingOut(false);
          }}
        />
      ) : null}
    </li>
  );
}

/** One council's lending desk: its ACTIVE assets with the loan controls. */
export function LoanerLibraryManager({ user, councilId, onChanged }: { user: SessionUser; councilId: number; onChanged?: () => void }) {
  const inventory = useLoad(() => db.expenses.listAssetsInventory(user.memberId, councilId), [user.memberId, councilId]);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const rows = (inventory.data ?? []).filter((a) => a.current_status === 'ACTIVE');

  const change = async (asset: CouncilAssetsInventory, loan: AssetLoanChange) => {
    setBusy(asset.id);
    setMessage(null);
    try {
      await db.expenses.updateAssetLoan(user.memberId, asset.id, loan);
      await inventory.reload();
      onChanged?.();
      setMessage({ tone: 'info', text: `${asset.asset_name}: saved.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title={`Loaner library: our items (${rows.filter(isLoanable).length} listed)`}>
      {inventory.error ? <Notice tone="error">{inventory.error}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {inventory.data && rows.length === 0 ? <Empty>The council has no active assets yet. Approved long-term asset expenses add them.</Empty> : null}
      {rows.length > 0 ? (
        <ul className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1" aria-label="Council assets and their loan controls">
          {rows.map((a) => (
            <AssetLoanRow key={a.id} asset={a} busy={busy === a.id} onChange={(loan) => void change(a, loan)} />
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
