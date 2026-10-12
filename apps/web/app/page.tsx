'use client';
import { redirect } from 'next/navigation';
import { landingRouteFor } from '@kofc/shared';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';

// Sprint 7J Extension 2: the root lands on the /dashboard cockpit as soon as a member is signed in (the frame renders
// pages only behind the sign-in gate). Members whose seat does not open the dashboard keep the member hub.
// Sprint 8A: officer seats and Admin keys win first (landingRouteFor), so leadership always lands on the Active Desks
// hub; plain members stay on /member-actions.
export default function Home() {
  const user = useUser();
  const features = useFeatureFlags();
  const tenantType = useTenantType();
  redirect(landingRouteFor(user, features, tenantType));
}
