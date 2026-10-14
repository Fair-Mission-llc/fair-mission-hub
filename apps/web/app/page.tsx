'use client';
import { redirect } from 'next/navigation';
import { landingRouteFor } from '@kofc/shared';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';

// Sprint 7J Extension 2: the root lands on the /dashboard cockpit as soon as a member is signed in (the frame renders
// pages only behind the sign-in gate). Members whose seat does not open the dashboard keep the member hub.
// Sprint 8A: officer seats and Admin keys win first (landingRouteFor), so leadership always lands on the Active Desks
// hub. Sprint 8R: every signed-in member - plain members included - lands on the universal Home tab of /dashboard; the
// Member Actions page is gone and its volunteer tools are a Home section. Sprint 8S Corrected: the route carries '#home'
// (HOME_LANDING_ROUTE), and the sign-in itself also lands there (lib/session.tsx), whatever tab this browser remembers.
export default function Home() {
  const user = useUser();
  const features = useFeatureFlags();
  const tenantType = useTenantType();
  redirect(landingRouteFor(user, features, tenantType));
}
