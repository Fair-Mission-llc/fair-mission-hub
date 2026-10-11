// Sprint 7E: the signed-in member's council settings on the phone (council-settings.ts), so a screen quotes and applies
// the council's own expense window and logging window instead of fixed numbers. The defaults until the council loads.
import { councilWideSettings, type CouncilWideSettings } from '@kofc/shared';
import { useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

export function useCouncilTimings(): CouncilWideSettings {
  const user = useUser();
  return councilWideSettings(useLoad(() => db.councils.get(user.councilId), [user.councilId]).data);
}
