// Sprint 9 Revision 5.0: the GPS screens are switched off (GPS_UI_SUPPRESSED). Sprint 9 Revision 5.1: Quick Check-In
// is scrapped - members report their own hours after the event - and section 5.5 of the Member Guide shows the PIN pad.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as shared from '@kofc/shared';
import { GPS_UI_SUPPRESSED, HUB_ACTOR_FIRST_METHODS } from '@kofc/shared';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('GPS screens suppressed', () => {
  it('hides the GPS check-in on the phone and the meeting point fields on the web, but keeps the location math', () => {
    expect(GPS_UI_SUPPRESSED).toBe(true);
    const drawer = read('apps/mobile/components/GeofenceCheckIn.tsx');
    expect(drawer).toContain('useState(GPS_UI_SUPPRESSED)');
    expect(drawer).toContain('getCurrentPositionAsync');
    expect(read('apps/web/components/MeetingCheckInCard.tsx')).toContain('{GPS_UI_SUPPRESSED ? null : (');
    expect(read('packages/shared/src/geofence.ts')).toContain('export function distanceMeters');
  });

  it('shows the PIN pad, not a GPS picture, in Member Guide section 5.5', () => {
    const guide = read('docs/MEMBER_USER_GUIDE.md');
    const section = guide.slice(guide.indexOf('### 5.5 Check in to a live meeting'), guide.indexOf('### 5.6'));
    expect(section).toContain('../generated/mobile_app_catalog/meeting_check_in_pin_pad.png');
    expect(section).not.toMatch(/meeting_check_in_gps\.png|meeting_check_in_pin\.png|GPS|location/i);
    expect(existsSync(join(root, 'generated/mobile_app_catalog/meeting_check_in_pin_pad.png'))).toBe(true);
    expect(read('scripts/pin_pad_placeholder.py')).toContain('meeting_check_in_pin_pad.png');
  });
});

describe('Quick Check-In scrapped (Sprint 9 Revision 5.1)', () => {
  it('leaves no button, sheet or service method behind', () => {
    expect(existsSync(join(root, 'apps/mobile/components/QuickCheckIn.tsx'))).toBe(false);
    for (const path of ['apps/mobile/app/(app)/shifts.tsx', 'apps/mobile/app/(app)/donate.tsx', 'packages/shared/src/contract.ts']) {
      expect(read(path)).not.toMatch(/QuickCheckIn|quickCheckIn/);
    }
    expect('QUICK_CHECK_IN_LABEL' in shared).toBe(false);
    expect(HUB_ACTOR_FIRST_METHODS.has('events.quickCheckIn')).toBe(false);
  });

  it('keeps walk-in check-in out of the guides and the pilot kit', () => {
    for (const path of ['docs/MEMBER_USER_GUIDE.md', 'docs/ADMIN_USER_GUIDE.md', 'scripts/pilot_kit_pdf.py']) {
      expect(read(path)).not.toMatch(/Quick Check-In|Shift Captain|walk-in/i);
    }
  });
});
