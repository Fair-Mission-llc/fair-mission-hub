// Sprint 8S Revision 8 (schema version 97, no table change): the Grand Knight Desk's Council Goals & Targets folder, the
// launch splash, the sign-in footer's About / Terms of Service / Privacy Policy notices and the development login hint's
// removal. The web-only 6:15 PM pilot kit is covered in pilot-kit.test.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canReadCouncilGoals,
  COUNCIL_GOALS_FOLDER_TITLE,
  DESK_DRAWERS,
  deskDrawersFor,
  LEGAL_NOTICES,
  PLATFORM_APP_NAME,
  PLATFORM_ENGINEERED_BY,
  STAR_COUNCIL_OBJECTIVES,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const seat = (roles: string[], memberType: 'Member' | 'Admin' | 'Super Admin' = 'Member') => ({
  memberId: 7,
  councilId: OWN,
  memberType,
  isOfficer: roles.length > 0,
  roles,
});
const gkIds = (u: ReturnType<typeof seat>, councilId = OWN) => deskDrawersFor(u, 'grand-knight', councilId).map((d) => d.id);

describe('the Council Goals & Targets folder', () => {
  it('files a flat folder on the Grand Knight Desk spine', () => {
    expect(COUNCIL_GOALS_FOLDER_TITLE).toBe('[ 📈 Council Goals & Targets ]');
    const spec = DESK_DRAWERS.find((d) => d.id === 'council-goals');
    expect(spec).toMatchObject({ desk: 'grand-knight', title: COUNCIL_GOALS_FOLDER_TITLE, gate: 'council-goals' });
    expect(spec?.cabinet).toBeUndefined();
  });

  it('tracks the three Star Council objectives from the council goals', () => {
    expect(STAR_COUNCIL_OBJECTIVES.map((o) => o.label)).toEqual(['Membership Intake', 'Charitable Dollars', 'Volunteer Hours']);
    expect(STAR_COUNCIL_OBJECTIVES.map((o) => o.key)).toEqual(['new_members_target', 'fundraising_target', 'hours_target']);
  });

  it('shows the folder to the goal readers only', () => {
    const gk = seat(['Grand Knight']);
    expect(gkIds(gk)).toContain('council-goals');
    expect(gkIds(seat(['Deputy Grand Knight']))).toContain('council-goals');
    expect(gkIds(seat([]))).not.toContain('council-goals');
    expect(canReadCouncilGoals(gk, 2)).toBe(false);
    expect(gkIds(gk, 2)).not.toContain('council-goals');
  });

  it('renders the objectives in the Grand Knight Desk', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain("case 'council-goals':");
    expect(desks).toContain('<CouncilGoalsDrawer user={user} councilId={councilId} />');
    expect(desks).toContain('db.reports.getCouncilGoals(user.memberId, councilId, year)');
  });
});

describe('the launch splash and the sign-in footer', () => {
  const shell = read('apps/web/components/Shell.tsx');

  it('boots behind a splash with the emblem and the official app name', () => {
    // Sprint 11 Revision 1.0: the name carries its trademark sign.
    expect(PLATFORM_APP_NAME).toBe('Fraternal Council Archives™');
    expect(shell).toContain('function LaunchSplash()');
    expect(shell).toContain('<BrandMark size={128} />');
    expect(shell).toContain('{PLATFORM_APP_NAME}');
    expect(shell).toContain('if (!ready || !splashDone) return <LaunchSplash />;');
  });

  it('puts About, Terms of Service and Privacy Policy under every sign-in view', () => {
    expect(LEGAL_NOTICES.map((n) => n.title)).toEqual(['About', 'Terms of Service', 'Privacy Policy']);
    const about = LEGAL_NOTICES.find((n) => n.id === 'about')!;
    expect(about.paragraphs.join(' ')).toMatch(/bylaws/);
    expect(about.signature).toBe(PLATFORM_ENGINEERED_BY);
    expect(PLATFORM_ENGINEERED_BY).toBe('Engineered by Fair Mission, LLC');
    expect(shell).toContain('<LegalFooter onOpen={setNotice} />');
    // Sprint 11 Revision 12.0: the sign-in code card is a fifth view, with the same footer.
    expect(shell.match(/return page\(/g)).toHaveLength(5);
  });

  it('no longer prints the development logins on the sign-in card', () => {
    expect(shell).not.toMatch(/Development data|dev-pass-secure|devHint/);
  });
});
