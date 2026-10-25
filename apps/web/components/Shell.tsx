'use client';
// The portal frame: navy header (logo, the calling council's number and name, the Messaging menu and Help shortcut, the alert bell, and the member menu with
// the avatar that opens My Profile), the navy left Sidebar (Sidebar.tsx, Sprint 5Z-10) and a white content area. Nothing renders behind the sign-in gate.
// Sprint 7J Extension 2: under the header, the workspace tab row (WorkspaceTabs.tsx) of Home and the Officer Desks.
// Sprint 8P Stage 1: the header row carries the global search bar (GlobalSearch.tsx) between the council name and the
// Messaging menu, and the sign-in page's access request button became the understated '[ 🔑 Request Access ]' link.
// Sprint 8S Revision 8: the boot sequence shows the launch splash (LaunchSplash: the emblem and the official app name,
// held at least SPLASH_MIN_MS once per browser tab), and every sign-in view carries the About / Terms of Service /
// Privacy Policy footer (LegalFooter.tsx). The development login hint is gone from the sign-in card.
import { faceIdSupported, rememberedPasskey } from '@/lib/webauthn-client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ACCESS_REQUEST_LINK_LABEL, councilLabel, type LegalNoticeId, PLATFORM_APP_NAME, countUnreadMessages, describeError, isFraternalTenant, portalAreas, TENANT_VOCABULARY, whiteLabel } from '@kofc/shared';
import { AlertBell } from '@/components/AlertBell';
import { BackToDeskBlotterAnchor } from '@/components/DeskDrawers';
import { GlobalSearch } from '@/components/GlobalSearch';
import { LegalFooter, LegalNoticePanel } from '@/components/LegalFooter';
import { MemberAvatar } from '@/components/MemberAvatar';
import { AccessRequestForm, RemoteAssistButton, ViewAsBanner } from '@/components/PlatformAccessParts';
import { NAV, Sidebar } from '@/components/Sidebar';
import { Button, cx, Field, Input, Notice, PasswordInput } from '@/components/ui';
import { WorkspaceTabs } from '@/components/WorkspaceTabs';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import emblem from './kofc-logo.png';

/**
 * The council-supplied Knights of Columbus emblem; decorative, since the title beside it names the order.
 * The 737px source is served at 1x and 2x of `size` (next/image srcset) at quality 90, so it stays sharp on
 * high-density screens.
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  return <Image src={emblem} alt="" width={size} height={size} quality={90} preload className="shrink-0" />;
}

/** Question mark in a circle, drawn in currentColor so it follows the header's white text. */
function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** An envelope, drawn in currentColor so it follows the header's white text (Sprint 5Z-10.6, matching the phone app). */
function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

/** How often the envelope re-reads the member's threads, so messages sent from another session show up without a reload. */
const UNREAD_POLL_MS = 30_000;

/**
 * Phase 4.5: the number of unread messages addressed to the member, for the envelope's badge. It reloads on every
 * page change, whenever the Communications Hub reloads its conversations (messagesChanged), and every 30 seconds.
 */
function useUnreadMessages(pathname: string): number {
  const { user, messagesVersion } = useSession();
  const threads = useLoad(() => (user ? db.messages.listThreads(user.memberId) : Promise.resolve([])), [user?.memberId, pathname, messagesVersion]);
  const reload = threads.reload;
  useEffect(() => {
    const timer = setInterval(() => void reload(), UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);
  return countUnreadMessages(threads.data ?? []);
}

/**
 * The envelope's unread count: a bright red bubble with bold white numerals ringed in navy (about 5.9:1), matching the
 * alert bell. Hidden at zero; 99+ beyond 99.
 */
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="unread-messages-badge"
      className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-navy bg-brand-red px-1 text-center text-xs font-bold leading-4 text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** The links of the header's Messaging menu (Sprint 5Z-10.8), open to every signed-in member. */
const MESSAGING_MENU = ['messages', 'distribution-lists'] as const;

/**
 * The header's Messaging menu, just left of the Help shortcut: the envelope opens a dropdown with Council Messages & Alerts
 * (/messages) and My Distribution Lists (/distribution-lists), both open to every signed-in member (Sprint 5Z-10.8;
 * a single shortcut since Sprint 5X). Escape, a click elsewhere or following a link closes it.
 */
function MessagingMenu({ pathname }: { pathname: string }) {
  const { tenantType } = useSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = MESSAGING_MENU.some((item) => NAV[item].href === pathname);
  const unread = useUnreadMessages(pathname);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="messaging-menu"
        aria-label={unread > 0 ? `Messaging: ${unread} unread` : 'Messaging'}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex items-center gap-1.5 rounded px-2 py-2 text-sm font-bold text-white hover:bg-white/10',
          current && 'bg-white/10 underline decoration-gold decoration-2 underline-offset-4',
        )}
      >
        <span className="relative inline-flex">
          <EnvelopeIcon />
          <UnreadBadge count={unread} />
        </span>
        Messaging
        <span aria-hidden="true" className="text-gold">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <div
          id="messaging-menu"
          role="menu"
          aria-label="Messaging"
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded border-2 border-navy border-t-4 border-t-gold bg-white text-navy shadow-xl"
        >
          {MESSAGING_MENU.map((item, i) => {
            const { href, label, hint } = NAV[item];
            const here = pathname === href;
            return (
              <Link
                key={item}
                role="menuitem"
                href={href}
                aria-current={here ? 'page' : undefined}
                className={cx('block border-l-8 px-4 py-2 hover:underline', i > 0 && 'border-t border-t-line', here ? 'border-l-gold' : 'border-l-transparent')}
              >
                <span className="block text-sm font-bold">{whiteLabel(label, tenantType)}</span>
                <span className="block text-xs text-muted">{whiteLabel(hint, tenantType)}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** The header's Help shortcut to the searchable help center, just left of the alert bell (Sprint 5W). */
function HelpLink({ current }: { current: boolean }) {
  return (
    <Link
      href="/help"
      title="Online Help Center: answers from the user manuals"
      aria-current={current ? 'page' : undefined}
      className={cx(
        'flex items-center gap-1.5 rounded px-2 py-2 text-sm font-bold text-white hover:bg-white/10',
        current && 'bg-white/10 underline decoration-gold decoration-2 underline-offset-4',
      )}
    >
      <HelpIcon />
      Help
    </Link>
  );
}

/**
 * The member token in the header: avatar, name and title. It opens a small menu with My Profile and Sign out;
 * Escape, a click elsewhere or following a link closes it.
 */
function MemberMenu() {
  const { user, signOut, profileVersion } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const member = useLoad(() => (user ? db.members.get(user.memberId) : Promise.resolve(null)), [user?.memberId, profileVersion]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  if (!user) return null;
  const title = `${user.memberType}${user.isOfficer ? ' · Officer' : ''}`;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="member-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded px-2 py-1 text-right hover:underline"
      >
        <span className="text-sm">
          <span className="block font-bold">
            {user.firstName} {user.lastName}
          </span>
          <span className="block text-xs">{title}</span>
        </span>
        <MemberAvatar photoUrl={member.data?.ProfilePhotoURL} firstName={user.firstName} lastName={user.lastName} size={40} />
        <span aria-hidden="true" className="text-gold">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <div id="member-menu" role="menu" aria-label="Member menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded border-2 border-navy border-t-4 border-t-gold bg-white text-navy shadow-xl">
          <Link role="menuitem" href={NAV.profile.href} className="block px-4 py-2 hover:underline">
            <span className="block text-sm font-bold">{NAV.profile.label}</span>
            <span className="block text-xs text-muted">{NAV.profile.hint}</span>
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className="block w-full border-t border-line px-4 py-2 text-left text-sm font-bold hover:underline">
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sprint 6B Security: the self-service password reset, in place of the sign-in form. The email step always moves on,
 * so the form never tells whether an email belongs to a member; the 6-digit code (15 minutes, 5 tries) unlocks the
 * new-password step, which saves through auth.resetPassword and then signs the member in.
 */
function PasswordReset({ initialEmail, onDone, onCancel }: { initialEmail: string; onDone: (email: string, password: string) => Promise<void>; onCancel: () => void }) {
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 'email') {
      void run(async () => {
        await db.auth.requestPasswordReset(email.trim());
        setStep('code');
      });
    } else if (step === 'code') {
      void run(async () => {
        await db.auth.verifyPasswordResetCode(email.trim(), code);
        setStep('password');
      });
    } else if (password !== confirmation) {
      setError('The two passwords do not match.');
    } else {
      void run(async () => {
        await db.auth.resetPassword(email.trim(), code, password);
        await onDone(email.trim(), password);
      });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="font-serif text-lg font-bold">Reset your password</h2>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {step === 'email' ? (
        <>
          <p className="text-sm text-muted">Enter the email you sign in with. If it belongs to a registered member, a 6-digit reset code is emailed to it.</p>
          <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
          <Button type="submit" disabled={busy || email.trim() === ''}>
            {busy ? 'Sending…' : 'Email me a reset code'}
          </Button>
        </>
      ) : step === 'code' ? (
        <>
          <p className="text-sm text-muted">If {email.trim()} belongs to a registered member, a 6-digit code is on its way. It expires in 15 minutes.</p>
          <Field label="6-digit reset code">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em]"
                required
              />
            )}
          </Field>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Continue'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Choose a new password of at least 8 characters.</p>
          <Field label="New password">
            {(id) => <PasswordInput id={id} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
          </Field>
          <Field label="Confirm new password">
            {(id) => <PasswordInput id={id} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />}
          </Field>
          <Button type="submit" disabled={busy || password === ''}>
            {busy ? 'Saving…' : 'Save new password and sign in'}
          </Button>
        </>
      )}
      <button type="button" onClick={onCancel} className="self-center text-sm font-bold underline">
        Back to sign in
      </button>
    </form>
  );
}

/**
 * Sprint 10 Revision 5.0: the 'Sign in with FaceID' row on the sign-in card, like the phone's welcome screen. It shows
 * when the browser can use WebAuthn; the device's face or fingerprint check signs in a member who set FaceID up on
 * My Profile (lib/webauthn-client.ts, verified by the server).
 */
function FaceIdSignIn({ onError }: { onError: (message: string) => void }) {
  const { signInWithFaceId } = useSession();
  const [available, setAvailable] = useState(false);
  const [remembered, setRemembered] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAvailable(faceIdSupported());
    setRemembered(rememberedPasskey()?.username ?? null);
  }, []);
  if (!available) return null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="gold"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          signInWithFaceId()
            .catch((err: unknown) => onError(err instanceof Error ? err.message : String(err)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Waiting for FaceID…' : '🔐 Sign in with FaceID'}
      </Button>
      <p className="text-center text-xs text-muted">{remembered ? `Set up on this computer for ${remembered}.` : 'Set FaceID up on My Profile after you sign in.'}</p>
      <div className="flex items-center gap-2 text-xs text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

function SignIn() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Sprint 7F: the Register Your Council form replaces the sign-in card while it is open.
  const [registering, setRegistering] = useState(false);
  // Sprint 8S Revision 8: the footer's About, Terms of Service or Privacy Policy notice, shown in the card's place.
  const [notice, setNotice] = useState<LegalNoticeId | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!(await signIn(username, password))) setError('That email and password do not match a registered member. Check both and try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const brand = (
    <div className="flex items-center gap-3">
      <BrandMark size={52} />
      <div>
        <h1 className="font-serif text-xl font-bold leading-tight">Knights of Columbus</h1>
        <p className="text-sm text-muted">Council administration portal</p>
      </div>
    </div>
  );

  // The navy page every sign-in view shares, with the About / Terms of Service / Privacy Policy footer under the card.
  const page = (card: ReactNode) => (
    <div data-surface="navy" className="flex min-h-screen flex-col items-center justify-center bg-navy p-6">
      {card}
      <LegalFooter onOpen={setNotice} />
    </div>
  );

  if (notice) {
    return page(
      <div className="flex w-full max-w-md flex-col gap-4 rounded border-t-8 border-gold bg-white p-6">
        {brand}
        <LegalNoticePanel id={notice} onClose={() => setNotice(null)} />
      </div>,
    );
  }

  if (registering) {
    return page(
      <div className="flex w-full max-w-sm flex-col gap-4 rounded border-t-8 border-gold bg-white p-6">
        {brand}
        <AccessRequestForm onCancel={() => setRegistering(false)} />
      </div>,
    );
  }

  if (resetting) {
    return page(
      <div className="flex w-full max-w-sm flex-col gap-4 rounded border-t-8 border-gold bg-white p-6">
        {brand}
        <PasswordReset
          initialEmail={username}
          onCancel={() => setResetting(false)}
          onDone={async (email, newPassword) => {
            if (!(await signIn(email, newPassword))) throw new Error('Your password was changed, but signing in failed. Sign in with the new password.');
          }}
        />
      </div>,
    );
  }

  return page(
    <form onSubmit={(e) => void submit(e)} className="flex w-full max-w-sm flex-col gap-4 rounded border-t-8 border-gold bg-white p-6">
      {brand}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <FaceIdSignIn onError={setError} />
      <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />}</Field>
      <Field label="Password">
        {(id) => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setResetting(true);
        }}
        className="self-center text-sm font-bold underline"
      >
        Forgot Password?
      </button>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setRegistering(true);
        }}
        className="self-center text-xs text-muted hover:text-navy hover:underline"
      >
        {ACCESS_REQUEST_LINK_LABEL}
      </button>
    </form>,
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { user, impersonator, features, featuresLoaded, tenantType } = useSession();
  const pathname = usePathname();
  const council = useLoad(() => (user ? db.councils.get(user.councilId) : Promise.resolve(null)), [user?.councilId]);
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header data-surface="navy" className="flex items-center gap-4 border-b-4 border-gold bg-navy px-6 py-3 text-white">
        {/* Sprint 6Z-Dual-Gate-Model: the order's emblem and name belong to Knights of Columbus councils only. */}
        {isFraternalTenant(tenantType) ? <BrandMark /> : null}
        <div className="shrink-0">
          <p className="font-serif text-xl font-bold leading-tight">{TENANT_VOCABULARY[tenantType].organizationName}</p>
          <p className="text-sm">{council.data ? councilLabel(council.data) : ' '}</p>
        </div>
        {/* Sprint 8P Stage 1: the global search bar - the reader's pages, events, members and both help archives. */}
        <div className="flex min-w-0 flex-1 justify-center">
          <GlobalSearch />
        </div>
        {/* Sprint 7F: officers and Admins may share their screen with the Super Admins; not inside a view-as session. */}
        {!impersonator && user.memberType !== 'Super Admin' && (user.isOfficer || user.memberType === 'Admin') ? <RemoteAssistButton /> : null}
        <MessagingMenu pathname={pathname} />
        <HelpLink current={pathname === '/help'} />
        <AlertBell />
        <MemberMenu />
      </header>
      {/* Sprint 7J Extension 2: Home and the reader's Officer Desks, on every page. Sprint 8R: every member opens Home. */}
      {featuresLoaded && portalAreas(user, features, tenantType).includes('home') ? <WorkspaceTabs user={user} /> : null}
      <ViewAsBanner />
      {/* Sprint 8P Stage 2: the way back after a desk drawer had to open another page. */}
      <BackToDeskBlotterAnchor />
      <div className="flex flex-1">
        <Sidebar user={user} pathname={pathname} features={features} tenant={tenantType} />
        {/* Sprint 6A: pages wait for the council's feature flags, so a switched-off module never flashes into view. */}
        <main className="min-w-0 flex-1 bg-white p-6">{featuresLoaded ? children : null}</main>
      </div>
    </div>
  );
}

/** How long the launch splash stays up on a tab's first load, even when the session is ready sooner. */
const SPLASH_MIN_MS = 1200;
const SPLASH_SEEN_KEY = 'kofc.splashSeen';

/** Sprint 8S Revision 8: the launch splash of the boot sequence - the emblem and the official app name on navy. */
function LaunchSplash() {
  return (
    <div data-surface="navy" role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy p-6 text-center text-white">
      <BrandMark size={128} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-gold">Knights of Columbus</p>
        <h1 className="font-serif text-4xl font-bold leading-tight">{PLATFORM_APP_NAME}</h1>
      </div>
      <div className="h-1 w-48 overflow-hidden rounded bg-white/20" aria-hidden="true">
        <div className="h-full w-full bg-gold motion-safe:animate-pulse" />
      </div>
      <p className="text-sm text-white/80">Opening your council&apos;s records…</p>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, ready, startupError } = useSession();
  // The splash holds for SPLASH_MIN_MS on the tab's first load only; a reload in the same tab skips the wait.
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SPLASH_SEEN_KEY) === '1';
      sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
    } catch {
      // Storage blocked: hold the splash every time.
    }
    if (seen) {
      setSplashDone(true);
      return;
    }
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);
  if (startupError) {
    return (
      <div className="p-6">
        <Notice tone="error">The in-memory database could not be seeded, so the portal cannot start: {startupError}</Notice>
      </div>
    );
  }
  if (!ready || !splashDone) return <LaunchSplash />;
  return user ? <Frame>{children}</Frame> : <SignIn />;
}
