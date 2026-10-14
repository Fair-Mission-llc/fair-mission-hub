'use client';
// Signed-in member and startup state for the admin portal.
// The memory driver lives in the browser tab (see services/db.ts), so a reload starts a fresh seeded
// database and asks for sign-in again. That is the mock; the remote driver will hold real sessions.
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ALL_FEATURES_ON,
  councilFeatureFlags,
  councilTenantType,
  DEFAULT_TENANT_TYPE,
  HOME_LANDING_ROUTE,
  impersonationCouncilContext,
  registerCouncilGates,
  type Council,
  type FeatureFlags,
  type SessionUser,
  type TenantType,
} from '@kofc/shared';
import { db, setViewAsMode } from '@/services/db';
import { closeServerSession, endServerImpersonation, openServerSession, startServerImpersonation } from '@/services/session-transport';

interface SessionValue {
  user: SessionUser | null;
  /** False until the in-memory database has been seeded. */
  ready: boolean;
  startupError: string | null;
  /** Resolves true when the credentials were accepted. */
  signIn(username: string, password: string): Promise<boolean>;
  signOut(): void;
  /**
   * Sprint 7F: the Super Admin behind a read-only view of the portal as `user`, or null on an ordinary session. While it
   * is set, every data-service write is refused (VIEW_AS_READ_ONLY).
   */
  impersonator: SessionUser | null;
  /**
   * Sprint 8B: the viewed member's council while `impersonator` is set ('Council 15295 - St. Mary's ...'), and whether it
   * is another council than the Super Admin's own; null on an ordinary session.
   */
  viewAsCouncil: { label: string; crossCouncil: boolean } | null;
  /** A Super Admin starts viewing as the member; rejects with the reason when the browser or the server refuses. */
  impersonate(memberId: number): Promise<void>;
  /** Returns to the Super Admin's own account. */
  stopImpersonating(): Promise<void>;
  /** Bumped by profileChanged(), so views of the member's own record (the header avatar) reload. */
  profileVersion: number;
  /** Call after saving the signed-in member's own profile photo or details. */
  profileChanged(): void;
  /** Bumped by alertsChanged(), so the header bell reloads its alert log. */
  alertsVersion: number;
  /** Call after sending or reading alerts, so the bell's unread count catches up at once. */
  alertsChanged(): void;
  /** Bumped by messagesChanged(), so the header envelope reloads its unread count (Phase 4.5). */
  messagesVersion: number;
  /** Call after sending or reading messages, so the envelope's unread badge catches up at once. */
  messagesChanged(): void;
  /**
   * The signed-in member's council feature flags (Sprint 6A); every module reads as on until the council has loaded.
   * `featuresLoaded` turns true once it has, so a page of a switched-off module never flashes into view.
   */
  features: FeatureFlags;
  featuresLoaded: boolean;
  /**
   * The signed-in member's council tenant type (Sprint 6Z-Dual-Gate-Model): 'KOFC' until the council has loaded, like
   * the flags. A white-label tenant hides the fraternal areas and relabels the portal (whiteLabel).
   */
  tenantType: TenantType;
  /** Call after a Super Admin changes feature flags, so the sidebar and pages catch up at once. */
  featuresChanged(): void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    db.init().then(
      () => live && setReady(true),
      (err: unknown) => live && setStartupError(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      live = false;
    };
  }, []);

  const router = useRouter();
  const signIn = useCallback(
    async (username: string, password: string) => {
      const found = await db.auth.signIn(username.trim(), password);
      // Sprint 6Z-Engine-Upgrade: the server checks the same credentials and sets its own session cookie, which its Drive
      // vault, Supreme and email routes require. A member it does not know (added in this tab) simply gets no cookie.
      if (found) await openServerSession(username.trim(), password);
      setUser(found);
      // Sprint 8S Corrected: every sign-in lands on the informational Home tab (/dashboard#home), never on the page or the
      // dashboard tab this browser had open before.
      if (found) router.replace(HOME_LANDING_ROUTE);
      return found !== null;
    },
    [router],
  );
  const [impersonator, setImpersonator] = useState<SessionUser | null>(null);
  const [viewAsCouncil, setViewAsCouncil] = useState<{ label: string; crossCouncil: boolean } | null>(null);
  const [loadedFeatures, setLoadedFeatures] = useState<{ councilId: number; flags: FeatureFlags; tenantType: TenantType } | null>(null);
  /**
   * Sprint 8B: switches the portal to `council` at once - its timing gates, feature flags and tenant type - so a view-as
   * session (or the return from one) never shows a page under the other council's settings while the effect below loads.
   */
  const adoptCouncil = useCallback((council: Council | null, councilId: number) => {
    if (!council) return;
    registerCouncilGates(council);
    setLoadedFeatures({ councilId, flags: councilFeatureFlags(council), tenantType: councilTenantType(council) });
  }, []);
  const signOut = useCallback(() => {
    setViewAsMode(false);
    setImpersonator(null);
    setViewAsCouncil(null);
    setUser(null);
    void endServerImpersonation().then(closeServerSession);
  }, []);
  const impersonate = useCallback(
    async (memberId: number) => {
      if (!user || impersonator) throw new Error('Return to your own account before viewing as someone else.');
      // The browser's copy checks the rules first (it knows members added in this tab); then the server swaps its cookie.
      const target = await db.auth.impersonate(user.memberId, memberId);
      const council = await db.councils.get(target.councilId).catch(() => null);
      await startServerImpersonation(memberId);
      setViewAsMode(true);
      // Sprint 8B: the member's own council - possibly not the Super Admin's - takes over before the first page renders.
      adoptCouncil(council, target.councilId);
      const context = council ? impersonationCouncilContext(council, user.councilId) : null;
      setViewAsCouncil(context ? { label: context.councilLabel, crossCouncil: context.crossCouncil } : null);
      setImpersonator(user);
      setUser(target);
    },
    [user, impersonator, adoptCouncil],
  );
  const stopImpersonating = useCallback(async () => {
    if (!impersonator) return;
    await endServerImpersonation();
    setViewAsMode(false);
    adoptCouncil(await db.councils.get(impersonator.councilId).catch(() => null), impersonator.councilId);
    setViewAsCouncil(null);
    setUser(impersonator);
    setImpersonator(null);
  }, [impersonator, adoptCouncil]);
  const [profileVersion, setProfileVersion] = useState(0);
  const profileChanged = useCallback(() => setProfileVersion((v) => v + 1), []);
  const [alertsVersion, setAlertsVersion] = useState(0);
  const alertsChanged = useCallback(() => setAlertsVersion((v) => v + 1), []);
  const [messagesVersion, setMessagesVersion] = useState(0);
  const messagesChanged = useCallback(() => setMessagesVersion((v) => v + 1), []);
  const [featuresVersion, setFeaturesVersion] = useState(0);
  const featuresChanged = useCallback(() => setFeaturesVersion((v) => v + 1), []);
  const councilId = user?.councilId;
  useEffect(() => {
    if (councilId === undefined) return;
    let live = true;
    db.councils.get(councilId).then(
      (council) => {
        if (!live) return;
        registerCouncilGates(council);
        setLoadedFeatures({ councilId, flags: councilFeatureFlags(council), tenantType: councilTenantType(council) });
      },
      // An unreadable council keeps every module on rather than locking the portal.
      () => live && setLoadedFeatures({ councilId, flags: ALL_FEATURES_ON, tenantType: DEFAULT_TENANT_TYPE }),
    );
    return () => {
      live = false;
    };
  }, [councilId, featuresVersion]);
  const featuresLoaded = loadedFeatures !== null && loadedFeatures.councilId === councilId;
  const features = featuresLoaded ? loadedFeatures.flags : ALL_FEATURES_ON;
  const tenantType = featuresLoaded ? loadedFeatures.tenantType : DEFAULT_TENANT_TYPE;

  const value = useMemo(
    () => ({
      user,
      ready,
      startupError,
      signIn,
      signOut,
      impersonator,
      viewAsCouncil,
      impersonate,
      stopImpersonating,
      profileVersion,
      profileChanged,
      alertsVersion,
      alertsChanged,
      messagesVersion,
      messagesChanged,
      features,
      featuresLoaded,
      tenantType,
      featuresChanged,
    }),
    [user, ready, startupError, signIn, signOut, impersonator, viewAsCouncil, impersonate, stopImpersonating, profileVersion, profileChanged, alertsVersion, alertsChanged, messagesVersion, messagesChanged, features, featuresLoaded, tenantType, featuresChanged],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** The signed-in member. Pages render only behind the shell's sign-in gate, so this is never null there. */
export function useUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error('useUser called with nobody signed in');
  return user;
}

/** The signed-in member's council feature flags (Sprint 6A). */
export function useFeatureFlags(): FeatureFlags {
  return useSession().features;
}

/** The signed-in member's council tenant type (Sprint 6Z-Dual-Gate-Model). */
export function useTenantType(): TenantType {
  return useSession().tenantType;
}
