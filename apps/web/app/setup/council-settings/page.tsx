import { redirect } from 'next/navigation';

// Sprint 8A: Council Wide Settings moved under System Settings. Old bookmarks of /setup/council-settings land there.
export default function OldCouncilSettingsPage() {
  redirect('/system-settings/council-settings');
}
