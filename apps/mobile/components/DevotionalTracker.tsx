// The phone's devotional tracker and merit tier badge (Sprint 7A; the badge replaced the canonization shield in Sprint 11
// Revision 6.0), a section of Home under the prayer intentions.
//
// The member types how many rosaries they said, hours of adoration they kept and confessions they made, and
// 'Log devotions' adds them to their running tally (devotionals.record). The tally is the member's own: nobody else
// reads it.
//
// The badge shows the member's merit tier this fraternal year (MeritTierBadge, merit-tiers.ts), from their hours,
// events, meeting check-ins and recruits against the council's milestones, and what the next tier still needs. Sprint 8S Revision 4: the section is the closed '[ 📖 Daily Devotional Drawer ]'
// (mobile-home.ts), and today's NABRE verse (dailyVerse) heads it, so the scripture shares the drawer with the tally. Like the rest of the Faith Center it is a Knights of Columbus extension: for a white-label
// tenant the section draws nothing.
import { useState } from 'react';
import { View } from 'react-native';
import {
  CHARTER_MEMBER_BADGE,
  DAILY_DEVOTIONAL_DRAWER_LABEL,
  dailyVerse,
  DEVOTIONAL_ENTRY_MAX,
  describeError,
  isFraternalTenant,
  NABRE_NOTICE,
  toIsoDate,
  MERIT_TIERS,
  meritBadgeText,
  type DevotionalEntry,
  type MeritStanding,
} from '@kofc/shared';
import { AppInput, AppText, Button, Card, Drawer, Field, Notice } from '@/components/ui';
import { useTenantType, useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { useTheme } from '@/lib/layout-mode';
import { db } from '@/services/db';

const plural = (n: number, word: string) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${word}${n === 1 ? '' : 's'}`;

/**
 * Sprint 11 Revision 6.0: the member's merit tier this fraternal year (merit-tiers.ts), in the old shield's navy crest
 * with a gold rim, with the Charter Member badge and what the next ladder tier still needs.
 */
export function MeritTierBadge({ rank }: { rank: MeritStanding }) {
  const { color, space, radius, border } = useTheme();
  const m = rank.metrics;
  const next = rank.next;
  return (
    <View
      accessible
      accessibilityLabel={`Merit tier: ${meritBadgeText(rank)}.${rank.charterMember ? ` ${CHARTER_MEMBER_BADGE}.` : ''}`}
      style={{
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: color.navy,
        borderColor: color.gold,
        borderWidth: border(4),
        borderTopLeftRadius: radius.md,
        borderTopRightRadius: radius.md,
        borderBottomLeftRadius: 80,
        borderBottomRightRadius: 80,
        paddingTop: space.md,
        paddingBottom: space.xl,
        paddingHorizontal: space.md,
      }}
    >
      <AppText variant="heading" tone="white" style={{ fontSize: 40, lineHeight: 48 }}>
        {rank.tier?.icon ?? '○'}
      </AppText>
      <AppText variant="heading" tone="white" style={{ color: color.gold, textAlign: 'center' }}>
        {rank.tier ? rank.tier.label : 'No tier yet'}
      </AppText>
      <AppText variant="small" tone="white" style={{ textAlign: 'center' }}>
        {rank.tier ? `Tier ${rank.tier.number} of 6 · ` : ''}fraternal year {rank.fraternalYear}
      </AppText>
      {rank.charterMember ? (
        <AppText variant="label" style={{ backgroundColor: color.gold, color: color.navy, paddingHorizontal: space.sm, textAlign: 'center' }}>
          {CHARTER_MEMBER_BADGE}
        </AppText>
      ) : null}
      <AppText variant="small" tone="white" style={{ textAlign: 'center' }}>
        This year: {plural(m.hours, 'hour')} · {plural(m.events, 'event')} · {plural(m.meetings, 'meeting')} · {plural(m.recruits, 'recruit')}
      </AppText>
      <AppText variant="small" tone="white" style={{ textAlign: 'center' }}>
        {next
          ? `Next: ${next.tier.label} - ${[
              next.hoursNeeded > 0 ? plural(next.hoursNeeded, 'hour') : null,
              next.eventsNeeded > 0 ? plural(next.eventsNeeded, 'event') : null,
              next.meetingsNeeded > 0 ? plural(next.meetingsNeeded, 'meeting') : null,
            ]
              .filter(Boolean)
              .join(', ')} to go`
          : 'Fraternal Champion milestones met. Thank you for your service!'}
      </AppText>
      <AppText variant="small" tone="white" style={{ textAlign: 'center' }}>
        {MERIT_TIERS.map((t) => t.label).join(' → ')} · counts reset July 1
      </AppText>
    </View>
  );
}

const FIELDS: { key: keyof DevotionalEntry; label: string }[] = [
  { key: 'rosaries', label: 'Rosaries said' },
  { key: 'adorations', label: 'Hours of adoration' },
  { key: 'confessions', label: 'Confessions' },
];

/** Home's devotional section. `version` changes on pull-to-refresh so the tally reloads with the screen. */
export function DevotionalTracker({ version }: { version: number }) {
  const { color, space } = useTheme();
  const user = useUser();
  const fraternal = isFraternalTenant(useTenantType());
  const progress = useLoad(async () => (fraternal ? db.devotionals.getProgress(user.memberId) : null), [user.memberId, fraternal, version]);
  const [draft, setDraft] = useState<Record<keyof DevotionalEntry, string>>({ rosaries: '', adorations: '', confessions: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  if (!fraternal) return null;

  const log = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // Blank boxes add nothing; anything else goes to the driver as typed, which refuses what is not a whole number.
      const entry: DevotionalEntry = {};
      for (const { key } of FIELDS) if (draft[key].trim() !== '') entry[key] = Number(draft[key].trim());
      await db.devotionals.record(user.memberId, entry);
      setDraft({ rosaries: '', adorations: '', confessions: '' });
      setMessage({ tone: 'info', text: 'Logged. God bless you!' });
      await progress.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const p = progress.data;
  const verse = dailyVerse(toIsoDate(new Date()));
  return (
    <Drawer label={DAILY_DEVOTIONAL_DRAWER_LABEL} summary={verse.reference}>
      <Card accent={color.gold}>
        <AppText variant="label" tone="muted">
          📖 TODAY&apos;S SCRIPTURE
        </AppText>
        <AppText variant="title">“{verse.text}”</AppText>
        <AppText variant="label">{verse.reference} (NABRE)</AppText>
        <AppText variant="small" tone="muted">
          {NABRE_NOTICE}
        </AppText>
      </Card>
      {progress.error ? <Notice tone="error" message={progress.error} /> : null}
      {p ? <MeritTierBadge rank={p.rank} /> : null}
      <Card>
        <View style={{ gap: space.sm }}>
          {p ? (
            <AppText variant="label" accessibilityLiveRegion="polite">
              So far: {p.tally.rosaries_said} rosaries · {p.tally.adorations_count} hours of adoration · {p.tally.confessions_count} confessions
            </AppText>
          ) : null}
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <AppInput
                value={draft[f.key]}
                onChangeText={(text) => setDraft((d) => ({ ...d, [f.key]: text }))}
                keyboardType="number-pad"
                placeholder="0"
                accessibilityLabel={f.label}
                maxLength={String(DEVOTIONAL_ENTRY_MAX).length}
                editable={!busy}
              />
            </Field>
          ))}
          <Button title="Log devotions" onPress={() => void log()} disabled={FIELDS.every((f) => draft[f.key].trim() === '')} busy={busy} />
          {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
          <AppText variant="small" tone="muted">
            Only you see your devotions. Your shield level comes from the service hours and events you log, measured against your council&apos;s
            thresholds.
          </AppText>
        </View>
      </Card>
    </Drawer>
  );
}
