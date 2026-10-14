// =====================================================================================================================
// SPRINT 8S REVISION 4 - THE COMPRESSED PHONE HOME
// =====================================================================================================================
// The phone's Home feed (apps/mobile/app/(app)/index.tsx), top to bottom. My Active Shifts sits first so a volunteer
// sees where to be the moment the app opens. The Faith Center pieces fold into two closed drawers (ui.tsx Drawer):
//   - '[ 📿 Active Spiritual Intentions Drawer ]' holds the Council Prayer Intentions list (PrayerIntentions.tsx);
//   - '[ 📖 Daily Devotional Drawer ]' holds today's NABRE verse and the member's devotional tally and shield
//     (DevotionalTracker.tsx).
// Both drawers start closed and follow feature_faith_center like the sections they replace.

export const MY_ACTIVE_SHIFTS_TITLE = 'My Active Shifts';
export const SPIRITUAL_INTENTIONS_DRAWER_LABEL = '[ 📿 Active Spiritual Intentions Drawer ]';
export const DAILY_DEVOTIONAL_DRAWER_LABEL = '[ 📖 Daily Devotional Drawer ]';

export type MobileHomeSection = 'my-active-shifts' | 'liturgical-banner' | 'greeting' | 'spiritual-intentions' | 'daily-devotional' | 'council-dashboard' | 'expense-reports';

/** The order the phone Home draws its sections in. */
export const MOBILE_HOME_SECTIONS: readonly MobileHomeSection[] = [
  'my-active-shifts',
  'liturgical-banner',
  'greeting',
  'spiritual-intentions',
  'daily-devotional',
  'council-dashboard',
  'expense-reports',
];
