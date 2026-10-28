// Sprint 11 Revision 7.0: the server side of the Master Feature Deployment Grid. A route that belongs to a premium module
// answers 403 while the council's switch for it is off, so hiding the button is not the only gate.
import { NextResponse } from 'next/server';
import { councilFeatureFlags, FEATURE_FLAG_LABELS, type FeatureFlagName } from '@kofc/shared';
import { memberDirectory } from '@/services/server/session';

/** null when the module is on for the council (or the council is unknown); otherwise the 403 answer to send. */
export async function featureSwitchedOff(councilId: number, flag: FeatureFlagName): Promise<NextResponse | null> {
  const council = await (await memberDirectory()).councils.get(councilId);
  if (!council || councilFeatureFlags(council)[flag]) return null;
  return NextResponse.json(
    { message: `${FEATURE_FLAG_LABELS[flag].label} is switched off for this council. A Super Admin turns it on in the Master Feature Deployment Grid.` },
    { status: 403 },
  );
}
