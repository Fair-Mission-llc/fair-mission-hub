'use client';
// Sprint 7C: the number forms behind the Council Wide Settings page (/system-settings/council-settings) and the Super Admin's
// Platform Settings on Global System Parameters (/system-settings/global-settings; on /lookups until the Sprint 7C
// Extension). Each field shows its plain-English label, its range and what it does; saving sends only the fields that
// changed. The rules (labels, ranges, quarter-hour steps) come from council-settings.ts, which the
// data service applies again on save.
//
// Sprint 7E: the fields sit in high-contrast group cards (Financial Submissions, Volunteer & Meeting Operations, Reminder
// Cadences on the council page; Reminder Cadences, Sign-in & Records, Recording & Text Limits on the platform page), and
// every field has an (i) button that opens a popup saying where and how the setting changes the portal. A setting no
// feature reads yet carries a "Not used yet" tag.
import { useEffect, useRef, useState } from 'react';
import {
  BusinessRuleError,
  councilWideSettings,
  describeError,
  PLATFORM_SETTING_GROUP_ORDER,
  PLATFORM_SETTING_NAMES,
  PLATFORM_SETTING_RULES,
  SETTING_GROUPS,
  SETTING_NOT_IN_USE_TEXT,
  settingsInGroup,
  type CouncilWideSettings,
  type PlatformSettings,
  type SettingGroupId,
  type SettingRule,
} from '@kofc/shared';
import { Button, Input, Notice } from '@/components/ui';
import { parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export type NumberSettingRule = SettingRule;

/** The (i) popup: what the setting does, in plain English, black on white. Esc, the Close button or the backdrop close it. */
function SettingHelpDialog({ rule, onClose }: { rule: NumberSettingRule; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="setting-help-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="w-[min(36rem,calc(100vw-2rem))] rounded border-4 border-navy bg-white p-0 text-black shadow-xl backdrop:bg-navy/70"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 id="setting-help-title" className="font-serif text-xl font-bold text-navy">
          {rule.label}
        </h2>
        {rule.inUse ? null : <p className="rounded border-2 border-brand-red px-3 py-2 text-base font-bold text-brand-red">{SETTING_NOT_IN_USE_TEXT}</p>}
        <p className="text-base leading-relaxed">{rule.help}</p>
        <p className="text-sm">
          <strong>Allowed:</strong> {rule.min} to {rule.max.toLocaleString('en-US')} {rule.unit}
          {rule.quarterHours ? ', in quarter hours' : ''}.
        </p>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose} autoFocus>
            Close
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/** The round (i) button beside a field's label; it opens the field's help popup. */
export function SettingInfoButton({ rule }: { rule: NumberSettingRule }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`What "${rule.label}" does`}
        aria-haspopup="dialog"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-white font-serif text-sm font-bold italic text-navy hover:bg-navy hover:text-white focus-visible:bg-navy focus-visible:text-white"
      >
        i
      </button>
      {open ? <SettingHelpDialog rule={rule} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** A form of number settings; `onSave` receives only the changed values. Keyed by its owner so it resets on reload. */
export function NumberSettingsForm<K extends string>({
  names,
  rules,
  values,
  submitLabel,
  onSave,
}: {
  names: readonly K[];
  rules: Record<K, NumberSettingRule>;
  values: Record<K, number>;
  submitLabel: string;
  onSave: (changed: Partial<Record<K, number>>) => Promise<string>;
}) {
  const [text, setText] = useState<Record<K, string>>(() => Object.fromEntries(names.map((n) => [n, String(values[n])])) as Record<K, string>);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const changed: Partial<Record<K, number>> = {};
      for (const n of names) {
        const v = parseNumberField(text[n], rules[n].label);
        if (v === null) throw new BusinessRuleError('INVALID_INPUT', `Enter a value for "${rules[n].label}".`);
        if (v !== values[n]) changed[n] = v;
      }
      if (Object.keys(changed).length === 0) {
        setMessage({ tone: 'info', text: 'Nothing changed.' });
        return;
      }
      setMessage({ tone: 'info', text: await onSave(changed) });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {names.map((n) => {
          const r = rules[n];
          const id = `setting-${n}`;
          return (
            <div key={n} className="flex flex-col gap-1">
              <span className="flex items-start gap-2">
                <label htmlFor={id} className="text-sm font-bold">
                  {r.label}
                </label>
                <SettingInfoButton rule={r} />
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Input
                  id={id}
                  inputMode={r.quarterHours ? 'decimal' : 'numeric'}
                  type="number"
                  min={r.min}
                  max={r.max}
                  step={r.quarterHours ? 0.25 : 1}
                  className="w-32"
                  value={text[n]}
                  onChange={(e) => setText({ ...text, [n]: e.target.value })}
                />
                <span className="text-sm text-muted">{r.unit}</span>
                {r.inUse ? null : (
                  <span className="rounded border-2 border-brand-red px-1.5 text-xs font-bold uppercase tracking-wide text-brand-red">Not used yet</span>
                )}
              </span>
              <span className="text-sm font-normal">
                {r.hint} Allowed: {r.min} to {r.max.toLocaleString('en-US')}
                {r.quarterHours ? ', in quarter hours' : ''}.
              </span>
            </div>
          );
        })}
      </div>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" variant="gold" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * One high-contrast card per group (Sprint 7E), each with its own fields and save button, in `groups` order. `formKey`
 * resets the forms when the stored values change.
 */
export function GroupedSettingsCards<K extends string>({
  names,
  rules,
  values,
  groups,
  formKey,
  onSave,
}: {
  names: readonly K[];
  rules: Record<K, NumberSettingRule>;
  values: Record<K, number>;
  groups: readonly SettingGroupId[];
  formKey: string;
  onSave: (changed: Partial<Record<K, number>>) => Promise<string>;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const inGroup = settingsInGroup(names, rules, group);
        if (inGroup.length === 0) return null;
        const g = SETTING_GROUPS[group];
        return (
          <section key={group} aria-labelledby={`settings-group-${group}`} className="rounded border-2 border-navy bg-white text-black">
            <header className="border-b-2 border-navy bg-navy px-4 py-2 text-white" data-surface="navy">
              <h2 id={`settings-group-${group}`} className="font-serif text-xl font-bold">
                {g.title}
              </h2>
              <p className="text-sm">{g.description}</p>
            </header>
            <div className="p-4 sm:p-5">
              <NumberSettingsForm
                key={`${group}-${formKey}`}
                names={inGroup}
                rules={rules}
                values={values}
                submitLabel={`Save ${g.title}`}
                onSave={onSave}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** The universal limits every council shares, as the recorder and text boxes read them (defaults until loaded). */
export function usePlatformSettings(): PlatformSettings | undefined {
  return useLoad(() => db.councils.getPlatformSettings(), []).data;
}

/**
 * The signed-in member's council settings (Sprint 7E), so help text and panels show the council's own windows and
 * cadences instead of fixed numbers. The defaults until the council loads.
 */
export function useCouncilTimings(): CouncilWideSettings {
  const user = useUser();
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]).data;
  return councilWideSettings(council);
}

const PLATFORM_SETTINGS_ROUTE = '/api/platform-settings';

/**
 * Sprint 7E: the portal server reads the session length from its own copy of the data, so a changed session length is
 * posted there too. Resolves to an extra sentence for the save message.
 */
async function saveSessionLengthOnServer(hours: number): Promise<string> {
  try {
    const res = await fetch(PLATFORM_SETTINGS_ROUTE, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_session_expiry_hours: hours }),
    });
    if (res.ok) return ' The portal server uses the new sign-in length from the next sign-in.';
    const answer = (await res.json().catch(() => null)) as { message?: string } | null;
    return ` The portal server did not take the new sign-in length (${answer?.message ?? `HTTP ${res.status}`}). Sign out, sign in again and save it once more.`;
  } catch {
    return ' The portal server could not be reached, so it keeps the old sign-in length. Save it again later.';
  }
}

/**
 * Platform Settings on Global System Parameters (System Lookups until the Sprint 7C Extension): Super Admins only (the
 * page is theirs; the data service enforces the tier too). Sprint 7E: grouped cards with (i) help.
 */
export function PlatformSettingsCard() {
  const user = useUser();
  const settings = useLoad(() => db.councils.getPlatformSettings(), []);
  const data = settings.data;
  return (
    <section aria-labelledby="platform-limits" className="mb-6 rounded border-2 border-navy bg-white p-4 text-navy sm:p-6">
      <h2 id="platform-limits" className="font-serif text-2xl">
        Platform Settings
      </h2>
      <p className="mt-1 text-base">Super Admins only. These settings apply to every council at once. Click (i) beside a field to see what it does.</p>
      <div className="mt-4">
        {settings.error ? <Notice tone="error">{settings.error}</Notice> : null}
        {data ? (
          <GroupedSettingsCards
            formKey={JSON.stringify(data)}
            names={PLATFORM_SETTING_NAMES}
            rules={PLATFORM_SETTING_RULES}
            values={data}
            groups={PLATFORM_SETTING_GROUP_ORDER}
            onSave={async (changed) => {
              await db.councils.setPlatformSettings(user.memberId, changed);
              const server = changed.user_session_expiry_hours === undefined ? '' : await saveSessionLengthOnServer(changed.user_session_expiry_hours);
              await settings.reload();
              return `Platform settings saved. They apply to every council now.${server}`;
            }}
          />
        ) : (
          <p className="text-sm">Loading platform settings…</p>
        )}
      </div>
    </section>
  );
}
