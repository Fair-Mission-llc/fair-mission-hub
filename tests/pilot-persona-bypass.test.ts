// Sprint 8S Revision 10.3: the seven seeded @stmarys.org pilot personas skip the phone's setup-code screen and land on
// the plain email + password sign-in. Their password is still checked, and every other member still needs the code.
import { beforeEach, describe, expect, it } from 'vitest';
import type { DataService } from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { OnboardingController, PILOT_PERSONA_EMAILS, isPilotPersonaEmail } from '../apps/mobile/services/onboarding';
import { sessionStore } from '../apps/mobile/services/session';
import { _reset } from './shims/expo-secure-store';
import { openDatabases } from './shims/expo-sqlite';
import { drivers, NOW } from './helpers';

const PASSWORD = 'dev-pass-secure-9912';

beforeEach(() => _reset());

describe('pilot persona list', () => {
  it('names exactly the seven seeded personas and ignores case and spaces', () => {
    expect(PILOT_PERSONA_EMAILS).toHaveLength(7);
    expect(isPilotPersonaEmail('  Member_Beta@StMarys.org ')).toBe(true);
    expect(isPilotPersonaEmail('testnewmember@kofc.org')).toBe(false);
  });
});

describe.each(drivers)('$name driver: pilot personas bypass the setup code', (d) => {
  async function makePresentation(): Promise<DataService> {
    const now = () => new Date(NOW);
    if (d.name === 'memory') {
      const db = new MemoryDataService({ now, presentationData: true });
      await db.init();
      return db;
    }
    openDatabases.length = 0;
    const db = new SqliteDataService({ now, presentationData: true });
    await db.init();
    return db;
  }

  const controllerFor = (db: DataService) => new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295 });

  it('routes every persona from the email prompt straight to sign-in and signs it in with its password', async () => {
    const db = await makePresentation();
    for (const email of PILOT_PERSONA_EMAILS) {
      const c = controllerFor(db);
      await c.start();
      expect(await c.submitEmail(email.toUpperCase()), email).toEqual({ screen: 'signIn', email });
      expect(await c.submitPassword(PASSWORD), email).toMatchObject({ screen: 'signedIn' });
      await c.signOut();
    }
  });

  it('still refuses a persona with the wrong password', async () => {
    const c = controllerFor(await makePresentation());
    await c.start();
    await c.submitEmail('member_alpha@stmarys.org');
    expect(await c.submitPassword('not-the-password')).toMatchObject({ screen: 'signIn', error: expect.stringContaining('Incorrect') });
  });

  it('keeps the setup-code screen for everyone else', async () => {
    const c = controllerFor(await d.make());
    await c.start();
    expect(await c.submitEmail('testnewmember@kofc.org')).toMatchObject({ screen: 'createPassword' });
  });
});
