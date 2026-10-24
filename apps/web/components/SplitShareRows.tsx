'use client';
// Sprint 9 Revision 6.2: the destination rows of a split - an account picker and a share (%) per row, Add destination,
// Remove, and the running total that must reach 100%. Used by the Treasurer's split profile editor
// (ChartOfAccountsSetup) and the batch coder's one-time Event Split Override (CashAuditParts). A row left with no
// account and no share is ignored on save (splitRowsToDestinations).
import { GL_SPLIT_MAX_DESTINATIONS, type GLAccount, type GLSplitDestination, type GLSplitProfile } from '@kofc/shared';
import { Button, Field, Input, Select } from '@/components/ui';

export interface SplitRow {
  key: number;
  accountId: number | null;
  percentage: string;
}

/** The sum of the typed shares, to the cent of a percent; NaN while a share is not a number. */
export const splitRowsTotal = (rows: readonly SplitRow[]) => rows.reduce((sum, r) => sum + Math.round(Number(r.percentage || 0) * 100), 0) / 100;

/** The rows a profile starts from: its destinations, or two empty rows. */
export function splitRowsOf(profile: Pick<GLSplitProfile, 'destinations'> | undefined): SplitRow[] {
  return profile && profile.destinations.length > 0
    ? profile.destinations.map((d, i) => ({ key: i, accountId: d.destinationAccountId, percentage: String(d.percentage) }))
    : [
        { key: 0, accountId: null, percentage: '' },
        { key: 1, accountId: null, percentage: '' },
      ];
}

/** The rows as the server takes them; completely blank rows are dropped (an empty result ends a split). */
export const splitRowsToDestinations = (rows: readonly SplitRow[]): GLSplitDestination[] =>
  rows
    .filter((r) => r.accountId !== null || r.percentage.trim() !== '')
    .map((r) => ({ destinationAccountId: r.accountId ?? 0, percentage: Number(r.percentage) }));

export function SplitShareRows({
  rows,
  onChange,
  choices,
  disabled,
  label = 'Destination',
}: {
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  /** The Revenue accounts a row may name. */
  choices: GLAccount[];
  disabled?: boolean;
  label?: string;
}) {
  const total = splitRowsTotal(rows);
  const change = (key: number, patch: Partial<SplitRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={r.key} className="flex flex-wrap items-end gap-3">
          <Field label={`${label} ${i + 1}`} className="min-w-56 flex-1">
            {(id) => (
              <Select id={id} value={r.accountId ?? ''} onChange={(e) => change(r.key, { accountId: e.target.value === '' ? null : Number(e.target.value) })} disabled={disabled}>
                <option value="">Choose a revenue account</option>
                {choices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.AccountName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Share (%)" className="w-28">
            {(id) => <Input id={id} inputMode="decimal" value={r.percentage} onChange={(e) => change(r.key, { percentage: e.target.value })} disabled={disabled} />}
          </Field>
          <Button variant="secondary" size="sm" onClick={() => onChange(rows.filter((x) => x.key !== r.key))} disabled={disabled}>
            Remove
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...rows, { key: Math.max(-1, ...rows.map((x) => x.key)) + 1, accountId: null, percentage: '' }])}
          disabled={disabled || rows.length >= GL_SPLIT_MAX_DESTINATIONS}
        >
          Add destination
        </Button>
        {rows.length > 0 ? (
          <span className={Number.isFinite(total) && total === 100 ? 'text-sm font-bold' : 'text-sm font-bold text-brand-red'}>
            Total: {Number.isFinite(total) ? `${total}%` : '–'} (must be 100%)
          </span>
        ) : null}
      </div>
    </div>
  );
}
