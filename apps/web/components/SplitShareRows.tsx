'use client';
// Sprint 9 Revision 6.2: the destination rows of a split - an account picker and a share (%) per row, Add destination,
// Remove, and the running total that must reach 100%. Used by the Treasurer's split profile editor
// (ChartOfAccountsSetup) and the batch coder's one-time Event Split Override (CashAuditParts). A row left with no
// account and no share is ignored on save (splitRowsToDestinations).
// Sprint 11 Revision 2.1: the profile editor also offers the council's ACTIVE affiliates ('sisters'). A row naming one
// is sent as { affiliatedCouncilId }; the driver posts that share to the council's own 'Due to Sister Council' clearing
// account, so nothing is written to the other council.
import { GL_SPLIT_MAX_DESTINATIONS, type GLAccount, type GLSplitDestination, type GLSplitProfile, type SplitSisterCouncil } from '@kofc/shared';
import { Button, Field, Input, Select } from '@/components/ui';

export interface SplitRow {
  key: number;
  accountId: number | null;
  /** Sprint 11 Revision 2.1: an affiliated council in place of an account. */
  sisterCouncilId?: number | null;
  percentage: string;
}

/** The sum of the typed shares, to the cent of a percent; NaN while a share is not a number. */
export const splitRowsTotal = (rows: readonly SplitRow[]) => rows.reduce((sum, r) => sum + Math.round(Number(r.percentage || 0) * 100), 0) / 100;

/** The rows a profile starts from: its destinations (a sister council's clearing account shows as that council), or two empty rows. */
export function splitRowsOf(profile: Pick<GLSplitProfile, 'destinations'> | undefined, sisters: readonly SplitSisterCouncil[] = []): SplitRow[] {
  const sisterOf = new Map(sisters.filter((c) => c.clearingAccountId !== null).map((c) => [c.clearingAccountId, c.councilId]));
  return profile && profile.destinations.length > 0
    ? profile.destinations.map((d, i) => {
        const sister = sisterOf.get(d.destinationAccountId);
        return sister === undefined
          ? { key: i, accountId: d.destinationAccountId, percentage: String(d.percentage) }
          : { key: i, accountId: null, sisterCouncilId: sister, percentage: String(d.percentage) };
      })
    : [
        { key: 0, accountId: null, percentage: '' },
        { key: 1, accountId: null, percentage: '' },
      ];
}

/** The rows as the server takes them; completely blank rows are dropped (an empty result ends a split). */
export const splitRowsToDestinations = (rows: readonly SplitRow[]): GLSplitDestination[] =>
  rows
    .filter((r) => r.accountId !== null || r.sisterCouncilId != null || r.percentage.trim() !== '')
    .map((r) =>
      r.sisterCouncilId != null
        ? { destinationAccountId: 0, affiliatedCouncilId: r.sisterCouncilId, percentage: Number(r.percentage) }
        : { destinationAccountId: r.accountId ?? 0, percentage: Number(r.percentage) },
    );

/** The picker's value for a row: 'a<id>' for an account, 's<id>' for a sister council, '' for none. */
const rowValue = (r: SplitRow) => (r.sisterCouncilId != null ? `s${r.sisterCouncilId}` : r.accountId !== null ? `a${r.accountId}` : '');

export function SplitShareRows({
  rows,
  onChange,
  choices,
  sisters = [],
  disabled,
  label = 'Destination',
}: {
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  /** The Revenue accounts a row may name. */
  choices: GLAccount[];
  /** Sprint 11 Revision 2.1: the council's ACTIVE affiliates a row may name (the profile editor only). */
  sisters?: readonly SplitSisterCouncil[];
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
              <Select
                id={id}
                value={rowValue(r)}
                onChange={(e) => {
                  const v = e.target.value;
                  change(r.key, v.startsWith('s') ? { accountId: null, sisterCouncilId: Number(v.slice(1)) } : { accountId: v === '' ? null : Number(v.slice(1)), sisterCouncilId: null });
                }}
                disabled={disabled}
              >
                <option value="">{sisters.length > 0 ? 'Choose an account or a sister council' : 'Choose a revenue account'}</option>
                <optgroup label="This council's revenue accounts">
                  {choices.map((a) => (
                    <option key={a.id} value={`a${a.id}`}>
                      {a.AccountName}
                    </option>
                  ))}
                </optgroup>
                {sisters.length > 0 ? (
                  <optgroup label="Affiliated councils (Due to Sister Council)">
                    {sisters.map((c) => (
                      <option key={c.councilId} value={`s${c.councilId}`}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
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
