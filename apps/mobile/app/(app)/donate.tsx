// Donations, optimised for taking them at an event table:
//  1. "Start accepting donations" pins an event with a default amount, type and description. Every donation
//     after that is linked to the event until "Stop accepting" (DonationSessionController, kept per council
//     for the life of the app, so switching tabs never loses the pinned event). Without a session a
//     donation is standalone.
//  2. The method is one tap on a large tile. Venmo/Zelle/Zeffy/Parishsoft show the council's QR code for
//     the donor to scan; physical items ask for a description and estimated value, and may carry a
//     verification photo taken with the phone camera from the "Take Verification Photo" tile (stored in
//     DonationPhotoURL). Sprint 7F Extension 2: a Check tile asks for the check number (required, Donation.CheckNumber).
//  3. Sprint 8L: nothing is chosen for the member. The setup card starts with no event and no donation type picked and
//     the method is the tile the member taps. Sprint 8S Revision 10: the Amount box opens filled with the session's
//     standard rate (blank when the session has none), so the member records a standard gift with no typing.
// While a session is running, the event's donations from every phone are listed, newest first.
// Sprint 5Z-Mobile-Intake: tapping Venmo, ParishSoft, Zeffy or Zelle opens a full-screen pop-up with only that channel's
// code (components/CollectionQrModal.tsx): the council's uploaded code first, else the one bundled with the app
// (Sprint 5Z-WhiteLabel). A QR method the app carries no image for shows the council's code inline (DonationQr).
// Sprint 5Z-10 high-speed gate intake (the '🎬 Start Active Intake Session' switch and its full-screen one-tap overlay,
// components/GateIntake.tsx) left the Collect tab in Sprint 8S Revision 10.4: tapping Start unlocks the payment tiles
// grid at once, with no second switch. After each recorded donation the screen scrolls back to the top, so the
// confirmation and the tiles are in view for the next donor.
// Sprint 8L: the setup card ("Start accepting donations") is the member's on-device configuration drawer. The member
// picks the event and the donation type by hand and may type a standard rate (e.g. the $10.00 parking tier).
// Sprint 8M: the standard rate's placeholder suggests $25.00 (PHONE_STANDARD_RATE_HINT), still typed by hand, and the
// description box reads EVENT DESCRIPTION (OPTIONAL): the default description of every donation in the session. The
// Check tile stays for real-world gate work (Sprint 8M Extension restored it after 8M Core hid it).
// Sprint 5Z-Final-Polish: the start card is a single bold heading, and the event dropdown offers only events at the
// gate, under way or starting within the council's shift_signup_lock_hours (isEventAtGate; Sprint 7H, was a fixed 2 hours).
// Sprint 8N: the pinned-event card ends with '[ 🛑 Conclude Event Session & Lock Logs ]' (events.concludeCollectionSession).
// After the member drags Slide to Conclude & Lock (SwipeToConfirm, Sprint 8S Revision 4), the event's collection is CONCLUDED for every phone: the gate intake closes, no more
// donations are logged or changed for it, and the Treasurer's Cash Box Audit Closure Panel shows it ready for the count.
// The event dropdown leaves out concluded events.
// Sprint 9 Revision 3.0 (schema 98): the Check form carries '📸 Attach Deposit Photo' (DEPOSIT_PHOTO_TITLE; Revision 4.0
// took it off the Cash form, so cash box entries need no photo). The
// camera shot is saved compressed (DEPOSIT_PHOTO_QUALITY) into the app's media folder; once the donation is recorded,
// donations.attachDepositPhoto writes its TransactionAttachments row. Optional: a donation records without one.
// Sprint 9 Revision 5.0: a Shift Captain with a shift today sees '⏱️ Quick Check-In' under the heading (QuickCheckIn),
// to sign walk-in volunteers up from the gate table.
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  CONCLUDE_EVENT_SESSION_LABEL,
  councilWideSettings,
  DEPOSIT_PHOTO_QUALITY,
  DEPOSIT_PHOTO_TITLE,
  formatDate,
  isCollectionOpen,
  isEventAtGate,
  PHONE_STANDARD_RATE_HINT,
  takesDepositPhoto,
  SPACING,
  toIsoDate,
  type CouncilDonationOption,
  type DonationDefaults,
  type DonationType,
  type Event,
} from '@kofc/shared';
import { CollectionQrModal, collectionQrFor } from '@/components/CollectionQrModal';
import { DonationMethodGrid } from '@/components/DonationMethodGrid';
import { DonationQr } from '@/components/DonationQr';
import { Dropdown } from '@/components/Dropdown';
import { ReceiptScanTile, VERIFICATION_PHOTO_TITLE } from '@/components/ReceiptScanTile';
import { SwipeToConfirm } from '@/components/SwipeToConfirm';
import { AppInput, AppText, Button, Card, EmptyState, Field, Loading, Notice, Pill, Screen, Section } from '@/components/ui';
import { FeatureGate } from '@/components/FeatureGate';
import { QuickCheckIn } from '@/components/QuickCheckIn';
import { useUser } from '@/lib/app-context';
import { warmCollectionQrs } from '@/lib/qr-cache';
import { useTheme } from '@/lib/layout-mode';
import { describeError, useLoad } from '@/lib/use-async';
import { useDonationSession } from '@/lib/use-donation-session';
import { db } from '@/services/db';
import { storeDepositPhoto } from '@/services/hub-photos';

const money = (n: number) => `$${n.toFixed(2)}`;

/** What the donation form hands back; `photoPath` is the verification photo of a physical item, if one was taken. */
interface DonationValues {
  amount: number;
  typeId: number;
  donor: string;
  description: string;
  photoPath: string | null;
  /** Sprint 9 Revision 3.0: the Check deposit photo's stored path, or null. */
  depositPhotoPath: string | null;
  /** Sprint 7F Extension 2: required for a Check donation, null otherwise. */
  checkNumber: string | null;
}

/** Amount text to dollars; blank is null. Anything else non-numeric is an error naming the field. */
function parseAmount(text: string, label: string): { value: number | null } | { error: string } {
  const trimmed = text.trim().replace(/[$,\s]/g, '');
  if (trimmed === '') return { value: null };
  const value = Number(trimmed);
  return Number.isFinite(value) ? { value } : { error: `${label} must be a dollar amount such as 20 or 12.50; received "${text}".` };
}

/** A multi-line note box; AppInput lifts the height to the large text layout's touchTarget. */
const multiline = { minHeight: 72, textAlignVertical: 'top' as const, paddingTop: SPACING.md };

// ---- start a session -----------------------------------------------------------

function StartSessionForm({
  events,
  leadHours,
  types,
  onStart,
  onCancel,
}: {
  events: Event[];
  leadHours: number;
  types: DonationType[];
  onStart: (eventId: number, defaults: DonationDefaults) => Promise<void>;
  onCancel: () => void;
}) {
  const { color, space } = useTheme();
  // Sprint 8L: no event or type is picked for the member; each is chosen by hand before Start.
  const [eventId, setEventId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [typeId, setTypeId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (events.length === 0) {
    return (
      <EmptyState
        message={`No event of your council is under way or starting within ${leadHours} hours. Record a standalone donation instead.`}
      />
    );
  }

  const start = async () => {
    const parsed = parseAmount(amount, 'Default amount');
    if ('error' in parsed) return setError(parsed.error);
    if (eventId === null) return setError('Choose the event you are collecting for.');
    if (types.length > 0 && typeId === null) return setError('Choose the donation type.');
    setBusy(true);
    setError(null);
    try {
      await onStart(eventId, {
        amount: parsed.value ?? undefined,
        donationTypeId: typeId ?? undefined,
        description: description.trim() || undefined,
      });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card accent={color.gold}>
      <AppText variant="title">Start accepting donations</AppText>
      {error ? <Notice tone="error" message={error} /> : null}
      <Field label="EVENT">
        <Dropdown
          title="Event"
          value={eventId}
          placeholder="Choose the event"
          options={events.map((e) => ({ value: e.id, label: `${e.EventName} · ${formatDate(e.StartDate)}` }))}
          onChange={setEventId}
        />
      </Field>
      <Field label="STANDARD RATE (OPTIONAL)">
        <AppInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={`e.g. ${PHONE_STANDARD_RATE_HINT.toFixed(2)}`} />
      </Field>
      {types.length > 0 ? (
        <Field label="DONATION TYPE">
          <Dropdown
            title="Donation type"
            value={typeId}
            placeholder="Choose the donation type"
            options={types.map((t) => ({ value: t.id, label: t.DonationType }))}
            onChange={setTypeId}
          />
        </Field>
      ) : null}
      <Field label="EVENT DESCRIPTION (OPTIONAL)">
        <AppInput value={description} onChangeText={setDescription} maxLength={255} />
      </Field>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <Button title="Start" style={{ flex: 2 }} busy={busy} onPress={() => void start()} />
      </View>
    </Card>
  );
}

// ---- record one donation ---------------------------------------------------------

function DonationForm({
  option,
  types,
  defaults,
  onRecord,
  onCancel,
}: {
  option: CouncilDonationOption;
  types: DonationType[];
  defaults: DonationDefaults;
  onRecord: (values: DonationValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { color, space } = useTheme();
  const isItem = option.kind === 'item';
  // Sprint 7F Extension 2: a Check donation must carry the number printed on the check.
  const isCheck = option.kind === 'check';
  const [checkNumber, setCheckNumber] = useState('');
  // Sprint 9 Revision 3.0: a Check donation may carry a deposit photo (Revision 4.0: Check only, never Cash).
  const takesDeposit = takesDepositPhoto(option.kind);
  const [depositPhotoPath, setDepositPhotoPath] = useState<string | null>(null);
  // Sprint 8S Revision 10: the Amount box opens filled with the session's standard rate (e.g. $25.00 parking), so a
  // gate gift is recorded with no typing; the member may still change it. Item gifts start empty (Sprint 8L rule kept).
  const [amount, setAmount] = useState(isItem || defaults.amount == null ? '' : defaults.amount.toFixed(2));
  const [typeId, setTypeId] = useState<number | null>(defaults.donationTypeId ?? null);
  const [donor, setDonor] = useState('');
  const [description, setDescription] = useState(isItem ? '' : (defaults.description ?? ''));
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Venmo, ParishSoft, Zeffy and Zelle open their code full screen as soon as the tile is tapped.
  const bundledQr = option.kind === 'qr' ? collectionQrFor(option.method.DonationMethod) : null;
  const [qrOpen, setQrOpen] = useState(bundledQr !== null);

  const amountLabel = isItem ? 'Estimated value' : 'Amount';
  const record = async () => {
    const parsed = parseAmount(amount, amountLabel);
    if ('error' in parsed) return setError(parsed.error);
    if (parsed.value === null) return setError(`Enter the ${amountLabel.toLowerCase()}.`);
    if (isItem && description.trim() === '') return setError('Describe the donated items, e.g. "3 boxes of canned food".');
    if (isCheck && checkNumber.trim() === '') return setError('Enter the check number printed on the check.');
    if (typeId === null) return setError('Choose a donation type.');
    setBusy(true);
    setError(null);
    try {
      await onRecord({
        amount: parsed.value,
        typeId,
        donor: donor.trim(),
        description: description.trim(),
        photoPath: isItem ? photoPath : null,
        depositPhotoPath: takesDeposit ? depositPhotoPath : null,
        checkNumber: isCheck ? checkNumber.trim() : null,
      });
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      {bundledQr ? (
        <>
          <CollectionQrModal
            methodName={option.method.DonationMethod}
            uploadedUrl={option.qrCodeUrl}
            fallback={bundledQr}
            visible={qrOpen}
            onClose={() => setQrOpen(false)}
          />
          <Button title={`Show the ${option.method.DonationMethod} QR code`} variant="secondary" onPress={() => setQrOpen(true)} />
        </>
      ) : option.kind === 'qr' ? (
        <DonationQr url={option.qrCodeUrl} methodName={option.method.DonationMethod} />
      ) : null}
      <Card accent={color.navy}>
        <AppText variant="title">{isItem ? 'Physical item donation' : `${option.method.DonationMethod} donation`}</AppText>
        {error ? <Notice tone="error" message={error} /> : null}
        {isItem ? (
          <Field label="WHAT WAS DONATED">
            <AppInput value={description} onChangeText={setDescription} multiline style={multiline} maxLength={255} placeholder="e.g. 3 boxes of canned food" />
          </Field>
        ) : null}
        {isItem ? (
          <Field label="VERIFICATION PHOTO (OPTIONAL)">
            <ReceiptScanTile
              prefix="donation"
              title={VERIFICATION_PHOTO_TITLE}
              hint="Photograph the donated items or the donor's paper receipt."
              photoPath={photoPath}
              photoLabel="Photo of the donated items"
              onCaptured={setPhotoPath}
              onRemove={() => setPhotoPath(null)}
            />
          </Field>
        ) : null}
        <Field label={amountLabel.toUpperCase()}>
          <AppInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" style={{ fontSize: 22 }} />
        </Field>
        {!isItem && defaults.amount != null ? (
          <AppText variant="small" tone="muted">
            Standard rate for this session: {money(defaults.amount)}. Change the amount if the donor gave a different sum.
          </AppText>
        ) : null}
        {isCheck ? (
          <Field label="CHECK NUMBER (REQUIRED)">
            <AppInput
              value={checkNumber}
              onChangeText={setCheckNumber}
              maxLength={50}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="The number printed on the check"
              accessibilityLabel="Check number, required"
            />
          </Field>
        ) : null}
        {takesDeposit ? (
          <Field label="DEPOSIT PHOTO (OPTIONAL)">
            <ReceiptScanTile
              prefix="deposit"
              title={DEPOSIT_PHOTO_TITLE}
              hint="Photograph the front of the check before it goes in the deposit bag."
              photoPath={depositPhotoPath}
              photoLabel="Photo of the check"
              quality={DEPOSIT_PHOTO_QUALITY}
              onCaptured={setDepositPhotoPath}
              onRemove={() => setDepositPhotoPath(null)}
            />
          </Field>
        ) : null}
        {types.length > 0 ? (
          <Field label="DONATION TYPE">
            <Dropdown title="Donation type" value={typeId} placeholder="Choose the donation type" options={types.map((t) => ({ value: t.id, label: t.DonationType }))} onChange={setTypeId} />
          </Field>
        ) : (
          <Notice tone="error" message="Your council has no donation types yet, so donations cannot be recorded. A council admin adds them." />
        )}
        <Field label="DONOR NAME (OPTIONAL)">
          <AppInput value={donor} onChangeText={setDonor} maxLength={100} autoCapitalize="words" />
        </Field>
        {!isItem ? (
          <Field label="DESCRIPTION (OPTIONAL)">
            <AppInput value={description} onChangeText={setDescription} maxLength={255} />
          </Field>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
          <Button title="Record donation" style={{ flex: 2 }} busy={busy} disabled={types.length === 0} onPress={() => void record()} />
        </View>
      </Card>
    </View>
  );
}

// ---- the screen --------------------------------------------------------------------

function DonateScreenBody() {
  const { color, space } = useTheme();
  const user = useUser();
  const { controller, state: session } = useDonationSession(user.councilId, user.memberId);
  const [picked, setPicked] = useState<CouncilDonationOption | null>(null);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const pinnedEventId = session.active ? session.eventId : null;

  const setup = useLoad(async () => {
    const now = new Date();
    const [methods, types, events, council] = await Promise.all([
      db.donations.listMethods(user.councilId),
      db.donations.listTypes(user.councilId),
      db.events.listByCouncil(user.councilId),
      db.councils.get(user.councilId),
    ]);
    // Only events at the gate are offered: in progress, or starting within the council's shift_signup_lock_hours
    // (isEventAtGate). The date check, widened by that lead, keeps far-off and long-finished events from loading
    // their shifts at all.
    const leadHours = councilWideSettings(council).shift_signup_lock_hours;
    const ahead = 86_400_000 + leadHours * 3_600_000;
    const nearby = events.filter((e) => e.StartDate <= toIsoDate(new Date(now.getTime() + ahead)) && e.EndDate >= toIsoDate(new Date(now.getTime() - 86_400_000)));
    const shifts = await Promise.all(nearby.map((e) => db.events.listShifts(e.id)));
    // Sprint 8N: a concluded collection takes no more donations, so it is not offered.
    return { methods, types, leadHours, events: nearby.filter((e, i) => isCollectionOpen(e) && isEventAtGate(e, shifts[i], now, leadHours)) };
  }, [user.councilId]);

  const stream = useLoad(
    async () => (pinnedEventId === null ? [] : (await db.donations.list(user.councilId, { eventId: pinnedEventId })).slice(0, 10)),
    [user.councilId, pinnedEventId],
  );

  // Sprint 8S Revision 10.4: brought back to the top after each recorded donation.
  const scrollRef = useRef<ScrollView>(null);

  // Sprint 8N: the conclude button asks once more before it locks the logs for every phone.
  const [confirmConclude, setConfirmConclude] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const conclude = async () => {
    if (!session.active) return;
    const name = session.eventName;
    setConcluding(true);
    try {
      await db.events.concludeCollectionSession(user.memberId, session.eventId);
      controller.stop();
      setConfirmConclude(false);
      setMessage({ tone: 'info', text: `${name} is concluded and its logs are locked. The Treasurer can now count the cash box.` });
      await setup.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setConcluding(false);
    }
  };
  useEffect(() => setConfirmConclude(false), [pinnedEventId]);

  // Leaving a half-filled form when the session changes would record against the wrong event.
  useEffect(() => setPicked(null), [pinnedEventId]);

  const { data } = setup;
  // Sprint 6A: have every collection code resolved and cached before its tile is tapped.
  useEffect(() => {
    if (!data) return;
    warmCollectionQrs(
      data.methods
        .filter((o) => o.kind === 'qr')
        .map((o) => ({ uploadedUrl: o.qrCodeUrl, fallback: collectionQrFor(o.method.DonationMethod) })),
    );
  }, [data]);
  const methodName = new Map((data?.methods ?? []).map((o) => [o.method.id, o.method.DonationMethod]));
  const typeName = new Map((data?.types ?? []).map((t) => [t.id, t.DonationType]));

  const record = async (option: CouncilDonationOption, v: DonationValues) => {
    const saved = await controller.record({
      DonationMethodID: option.method.id,
      DonationAmount: v.amount,
      DonationTypeID: v.typeId,
      Donor: v.donor || null,
      DonationDesciption: v.description || null,
      DonationPhotoURL: v.photoPath,
      CheckNumber: v.checkNumber,
    });
    const where = session.active ? ` for ${session.eventName}` : ' as a standalone donation';
    const recorded = `Recorded ${money(saved.DonationAmount)} by ${option.method.DonationMethod}${where}.`;
    // Sprint 9 Revision 3.0: the deposit photo is bound once the donation exists. A failure here leaves the donation recorded.
    let photoNote = '';
    if (v.depositPhotoPath) {
      try {
        // Sprint 9 Revision 4.0: in hub mode the photo is uploaded to the hub laptop first, which keeps it for every session.
        await db.donations.attachDepositPhoto(user.memberId, saved.id, await storeDepositPhoto(v.depositPhotoPath));
        photoNote = ' Deposit photo attached.';
      } catch (err) {
        setMessage({ tone: 'error', text: `${recorded} The deposit photo was not attached: ${describeError(err)}` });
        setPicked(null);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        await stream.reload();
        return;
      }
    }
    setMessage({ tone: 'info', text: `${recorded}${photoNote} Thank the donor!` });
    setPicked(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    await stream.reload();
  };

  return (
    <Screen scrollRef={scrollRef} refreshing={setup.refreshing || stream.refreshing} onRefresh={() => void Promise.all([setup.reload(), stream.reload()])}>
      <AppText variant="heading" accessibilityRole="header">
        Donations
      </AppText>
      <QuickCheckIn />

      {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
      {setup.error ? <Notice tone="error" message={setup.error} /> : null}
      {!data && setup.loading ? <Loading /> : null}

      {data ? (
        <>
          {session.active ? (
            <Card accent={color.gold}>
              <Pill label="ACCEPTING DONATIONS" tone="gold" />
              <AppText variant="title">{session.eventName}</AppText>
              <AppText>
                This phone: {session.recordedCount} donation{session.recordedCount === 1 ? '' : 's'}, {money(session.recordedTotal)}
              </AppText>
              {session.defaults.amount != null || session.defaults.description ? (
                <AppText variant="small" tone="muted">
                  Session setup: {[session.defaults.amount != null ? money(session.defaults.amount) : null, session.defaults.donationTypeId ? typeName.get(session.defaults.donationTypeId) : null, session.defaults.description]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              ) : null}
              <Button
                title="Stop accepting – the event is over"
                variant="secondary"
                onPress={() => {
                  controller.stop();
                  setMessage({ tone: 'info', text: `Stopped accepting donations for ${session.eventName}. New donations are standalone.` });
                }}
              />
              {confirmConclude ? (
                <Card accent={color.red}>
                  <AppText variant="title">Conclude {session.eventName}?</AppText>
                  <AppText>
                    This locks the donation logs for every phone. Nobody can add or change a donation for this event after this. The Treasurer counts the cash box
                    next.
                  </AppText>
                  {/* Sprint 8S Revision 4: a swipe, not a second tap, so a pocket brush cannot lock the logs. */}
                  <SwipeToConfirm title="Slide to Conclude & Lock" disabled={concluding} onConfirm={() => void conclude()} />
                  <Button title="Cancel" variant="secondary" disabled={concluding} onPress={() => setConfirmConclude(false)} />
                </Card>
              ) : (
                <Button title={CONCLUDE_EVENT_SESSION_LABEL} variant="danger" onPress={() => setConfirmConclude(true)} />
              )}
            </Card>
          ) : starting ? (
            <StartSessionForm
              events={data.events}
              leadHours={data.leadHours}
              types={data.types}
              onCancel={() => setStarting(false)}
              onStart={async (eventId, defaults) => {
                await controller.start(eventId, defaults);
                setStarting(false);
                setMessage(null);
              }}
            />
          ) : (
            <Card accent={color.navy}>
              <AppText variant="title" accessibilityRole="header">
                Active Multi-Donation Event Intake
              </AppText>
              <Button title="Start collecting for event" onPress={() => setStarting(true)} />
            </Card>
          )}

          {picked ? (
            <DonationForm
              key={`${picked.method.id}-${pinnedEventId ?? 'none'}`}
              option={picked}
              types={data.types}
              defaults={session.active ? session.defaults : {}}
              onRecord={(v) => record(picked, v)}
              onCancel={() => setPicked(null)}
            />
          ) : (
            <Section title="How is the donor giving?">
              {data.methods.length === 0 ? (
                <EmptyState message="Your council has not enabled any donation methods yet. A council admin turns them on." />
              ) : (
                <DonationMethodGrid options={data.methods} onPick={(o) => { setPicked(o); setMessage(null); }} />
              )}
            </Section>
          )}

          {session.active ? (
            <Section title="Recorded for this event">
              {stream.error ? <Notice tone="error" message={stream.error} /> : null}
              {!stream.data && stream.loading ? <Loading label="Loading donations…" /> : null}
              {stream.data?.length === 0 ? <EmptyState message="No donations recorded for this event yet, from any phone." /> : null}
              {(stream.data ?? []).map((d) => (
                <Card key={d.id} accent={color.line}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                    <AppText variant="title">{money(d.DonationAmount)}</AppText>
                    <AppText variant="small" tone="muted">
                      {methodName.get(d.DonationMethodID) ?? 'Method'} · {formatDate(d.DonationDate)}
                    </AppText>
                  </View>
                  {d.Donor || d.DonationDesciption ? (
                    <AppText variant="small" tone="muted" numberOfLines={2}>
                      {[d.Donor, d.DonationDesciption].filter(Boolean).join(' · ')}
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

export default function DonateScreen() {
  return (
    <FeatureGate flag="flag_fundraising_inflow">
      <DonateScreenBody />
    </FeatureGate>
  );
}
