'use client';
// Online Help Center: the troubleshooting workflows of docs/MEMBER_USER_GUIDE.md and docs/ADMIN_USER_GUIDE.md as a
// searchable question-and-answer accordion. Open to every signed-in member. Sprint 8O: the feedback and bug-report form and
// the Super Admin feedback inbox left this page for System Settings > Administrative Feedback Loops (Admins and higher)
// and the Super Admin Desk (components/FeedbackParts.tsx). The time windows and limits quoted
// come from the shared rule constants, so an answer cannot drift from what the drivers enforce. Sprint 7E: the logging
// window and the hours reminder cadence are the member's own council's settings (useCouncilTimings), read live.
import { useEffect, useState } from 'react';
import {
  ALERT_HISTORY_MONTHS,
  type CouncilWideSettings,
  FEED_HORIZON_MONTHS,
  MAX_HOURS_PER_ENTRY,
  MIN_PASSWORD_LENGTH,
  NO_SHOW_AUDIT_MONTHS,
  NO_SHOW_WINDOW_MONTHS,
  PRIORITY_WITHIN_DAYS,
} from '@kofc/shared';
import { useCouncilTimings } from '@/components/SettingsParts';
import { Empty, Field, Input, PageTitle, Pill } from '@/components/ui';

type Audience = 'Everyone' | 'Admins & officers';
interface Topic {
  q: string;
  a: string[];
}
interface Section {
  title: string;
  audience: Audience;
  topics: Topic[];
}

/** The help topics, quoting the council's own timing settings `t` (Sprint 7E). */
const helpSections = (t: CouncilWideSettings): Section[] => [
  {
    title: 'Signing in and your password',
    audience: 'Everyone',
    topics: [
      {
        q: 'How do I set up my account for the first time?',
        a: [
          'Open the phone app and enter the email address your council has on file, then tap Continue.',
          `If you are on the roster you are asked to choose a password of at least ${MIN_PASSWORD_LENGTH} characters and type it twice. Tap Create password and you are signed in; the phone remembers you until you sign out.`,
          'The same email and password sign you in to this desktop portal.',
        ],
      },
      {
        q: 'The app says it could not find my email in the member roster.',
        a: [
          'Members cannot register themselves: a council Admin adds you first. Check the address for typos and tap Try a different email.',
          'If it is correct, contact the admin shown on the Contact your council admin card (the council office phone is listed too) and ask to be added.',
        ],
      },
      {
        q: 'My password is refused or I see “Incorrect password”.',
        a: [
          `New passwords need at least ${MIN_PASSWORD_LENGTH} characters, and both entries must match.`,
          'At sign-in, check the email and password. If you have never created a password, do the phone onboarding first. If you have forgotten it, ask your council Admin for help.',
        ],
      },
      {
        q: 'How do I sign out?',
        a: ['In the portal, select Sign out under your name in the navy header. On the phone, tap Sign out in the header; this also forgets the remembered session.'],
      },
    ],
  },
  {
    title: 'Shifts and registration',
    audience: 'Everyone',
    topics: [
      {
        q: 'Where do I find shifts to volunteer for?',
        a: [
          `Member Actions → Registration desk (or the Shifts tab on the phone) lists shifts over the next ${FEED_HORIZON_MONTHS} months for your council and its sister councils that still need volunteers.`,
          'Filter by Council, then select Register (or tap Sign up on the phone).',
        ],
      },
      {
        q: 'Why is there no Register or Sign up button on a shift?',
        a: [
          'The shift is Full: once its sign-ups reach the minimum volunteers it locks automatically, so it cannot be over-booked. If two members take the last place at once, only one succeeds.',
          'On the phone, full shifts are hidden unless you switch on Show full shifts.',
        ],
      },
      {
        q: 'What do the red, gold and Full tags mean?',
        a: [
          'Red (Within 48 hours / WITHIN 2 DAYS): the shift starts within two days.',
          `Gold (Priority): still short of volunteers and either nobody has signed up or it starts within ${PRIORITY_WITHIN_DAYS} days.`,
          'Full: the minimum number of volunteers has been reached.',
        ],
      },
      {
        q: 'What is the red no-show badge on my phone?',
        a: [
          `It counts shifts you were marked absent for in the past ${NO_SHOW_WINDOW_MONTHS} months, including absences you reported yourself. Each one drops off after a year.`,
        ],
      },
      {
        q: 'I cannot make a shift I signed up for. What do I do?',
        a: [
          'On the phone, open Home → My shifts and tap Report absence / no-show on the shift. Choose a reason and tap Confirm absence.',
          'Please also tell the event owner so they can find a replacement. Only an Admin can remove a no-show once it is recorded, so contact your Admin if you reported one by mistake.',
        ],
      },
    ],
  },
  {
    title: 'Reporting hours',
    audience: 'Everyone',
    topics: [
      {
        q: 'How do I log the time I worked?',
        a: [
          'Member Actions → Hour ledger (or the Log time tab on the phone). Choose the shift or council activity, pick hours and minutes, add optional notes and save.',
          'Logging a shift again replaces the earlier hours, which is how you correct a mistake.',
        ],
      },
      {
        q: 'Why are my hours refused? (the 15-minute rule)',
        a: [
          'Time is kept in 15-minute chunks, so minutes can only be :00, :15, :30 or :45. For example, 1 h 15 min saves as 1.25 hours.',
          `An entry must be more than 0 and at most ${MAX_HOURS_PER_ENTRY} hours. You may report more than the shift's planned length.`,
        ],
      },
      {
        q: 'How far back can I log time?',
        a: [
          `Shifts and council activities: up to ${t.volunteer_logging_window_days} days back. Your council sets this number on Council Wide Settings.`,
          'After that the entry is frozen to protect the council’s records, and the shift shows Closed in your history.',
        ],
      },
      {
        q: 'Why did I get a text reminder about hours?',
        a: [
          `You signed up for a shift but have not logged hours. The first reminder goes out ${t.reminder_delay_days} days after the shift, then one every ${t.reminder_cadence_days} days, and reminders stop once the ${t.volunteer_logging_window_days}-day window closes.`,
        ],
      },
    ],
  },
  {
    title: 'Donations and QR codes',
    audience: 'Everyone',
    topics: [
      {
        q: 'How do I take donations at an event?',
        a: [
          'On the phone, open Collect → Start collecting for event, choose the event and any default amount, type or description, and tap Start.',
          'For each donor, tap the method tile (Cash, Credit Card, a QR method or Physical items), fill in the form and tap Record donation. Tap Stop accepting when the event is over.',
        ],
      },
      {
        q: 'How does a QR donation work?',
        a: [
          'Tap the Venmo, Zelle, Zeffy or ParishSoft tile and turn the phone toward the donor so they can scan the code.',
          'When they show you the payment confirmation, check the amount, then enter it with the donation type and tap Record donation.',
        ],
      },
      {
        q: 'The QR code does not appear.',
        a: [
          '“Your council has not uploaded this QR code yet” means no image link is on file: an Admin, Treasurer or Financial Secretary adds it under Council Lookup Tables → Enabled donation methods.',
          '“The QR code could not be loaded” usually means the phone is offline or the link is broken. Take the donation another way and tell your Admin.',
        ],
      },
      {
        q: 'Why can I not pick an upcoming event for donations?',
        a: ['Event donations are taken during or after an event, so only events that have already started are offered. Anything else is recorded as standalone.'],
      },
    ],
  },
  {
    title: 'Messages, roster and profile',
    audience: 'Everyone',
    topics: [
      {
        q: 'How do I reach another Brother Knight?',
        a: ['Sidebar → Faith In Action → Member Roster lists active members of your council and its sister councils with phone and email. The same list is on the Member Desk and the Member Actions Hub Fraternal roster tab. You can also message them through the Communications Hub.'],
      },
      {
        q: 'What is the bell next to my name?',
        a: [
          `It holds the alerts your council leadership sent you in the last ${ALERT_HISTORY_MONTHS} months. The red number counts the ones you have not opened yet.`,
          'Select the bell to open your notification log, newest first. Unread alerts sit on a gold background; open one to mark it read and the count drops.',
        ],
      },
      {
        q: 'How do I get alerts on my phone?',
        a: [
          'Sign in to the phone app and choose Allow when it asks to send notifications. Your phone is then linked to your record and urgent alerts arrive as push notifications.',
          'If you chose Don’t Allow, turn notifications on for KofC Tracker in your phone’s settings and sign in again. Alerts still reach your bell either way.',
        ],
      },
      {
        q: 'How do I update my phone, email or skills?',
        a: [
          'Open My Profile from the member menu (your name and photo, top right). Save contact details to update phone, email and address; changing the email changes your sign-in too.',
          'Record your trade skills and training so Admins can find you for projects. Name, member number, degree and type are kept by your council’s Admins.',
        ],
      },
    ],
  },
  {
    title: 'Events, shifts and twins',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I build a multi-day event?',
        a: [
          'Event planner → New event. Enter name, description, Starts and Ends dates, location, category, owner, and tick every council sharing the event. Save.',
          'In the Shifts panel add one row per day and time slot with its volunteers needed. Each shift date must fall inside the event.',
        ],
      },
      {
        q: 'What does Copy as a twin copy?',
        a: [
          'Details, councils and every shift, moved by the same number of days to the New first day you choose.',
          'Sign-ups, logged hours, post-event results and lessons are not copied.',
        ],
      },
      {
        q: 'Why can I not delete a shift, member or lookup value?',
        a: [
          'Nothing cascades: a record that others still point to (sign-ups, logged hours, donations, messages) is refused as in use, so history is never lost. Remove or reassign the dependants first, or keep the record.',
        ],
      },
    ],
  },
  {
    title: 'Roster and trade skills',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I find members with a particular trade?',
        a: [
          'Member Roster → Skills opens the Council skills drawer with every skill and how many members hold it. Choose one to see the holders.',
          'Write a note and select Send to message all of them at once. Only active members receive it, never you, and replies arrive in the Communications Hub.',
        ],
      },
      {
        q: 'How do I add a new member?',
        a: [
          'Member Roster → Add Member (council Admins and Super Admins). The email you enter is the member’s login; they then create their password on the phone.',
          'Admins may grant Admin or Member; only a Super Admin may grant Super Admin.',
        ],
      },
    ],
  },
  {
    title: 'Audits and the post-event ledger',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I review no-shows?',
        a: [
          `Executive Dashboard Summaries → Executive audits → No-show audit lists every no-show in the last ${NO_SHOW_AUDIT_MONTHS} months with its reason code, newest first.`,
          'Rows with a red “No reason provided” pill need follow-up; the header counts them. The audits are for Admins and Super Admins only.',
        ],
      },
      {
        q: 'What is the Shifts awaiting hours list?',
        a: [
          'Volunteers who worked a past shift (not no-shows) and have not logged hours, with their phone number.',
          `From day ${t.reminder_delay_days} the row turns red as ⚠ Overdue and shows the log-by date. Rows past ${t.volunteer_logging_window_days} days show Closed because the hours can no longer be recorded.`,
        ],
      },
      {
        q: 'Why are the cash and electronic fields locked on the ledger?',
        a: [
          'Once cash or electronic donations are recorded for an event, the ledger shows “Synced from donations” and those totals follow the donations. Correct the donations instead. Physical items never count toward the funds.',
        ],
      },
      {
        q: 'How do I mark a volunteer as a no-show?',
        a: [
          'Post-event ledger → choose the event → Fraternal Volunteer Turnout Summary. Select Mark no-show on the volunteer’s row, choose the reason and select Confirm. Clear removes a no-show recorded in error.',
          'Admins mark and clear no-shows on events linked to their own council; Super Admins on any event. A volunteer who has logged hours on the shift cannot be marked absent.',
        ],
      },
      {
        q: 'Who can record an event’s results?',
        a: ['Admins of any council linked to the event, any Super Admin, and the event’s owner. Choose the event in the Active queue, save the results, and add lessons learned.'],
      },
    ],
  },
  {
    title: 'Council lookup tables, donations and summaries',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I set up donation types and methods?',
        a: [
          'Council Lookup Tables → Donation types and Enabled donation methods. Paste the council’s QR image link for Venmo, Zelle, Zeffy or ParishSoft.',
          'Changes are saved together: if one row is refused, none are written. Fix the named row and save again.',
          'Admins, Super Admins, Treasurers and Financial Secretaries maintain the donation lookups; only Admins and Super Admins maintain Activities.',
        ],
      },
      {
        q: 'Who can correct or delete a donation?',
        a: ['The member who recorded it, the event’s owner, the council’s Treasurer, Financial Secretary and Admins, and any Super Admin. A donation’s council and recorder never change.'],
      },
      {
        q: 'How do I read the monthly executive scorecard?',
        a: [
          'Total labor hours: shift plus activity hours logged in the month. Unique Knights participating: distinct members who logged any time.',
          'Net balance: cash plus electronic funds raised minus spend for the month’s events. Community outreach: actual attendees at those events.',
          `Figures grow as members log hours, which may be up to ${t.volunteer_logging_window_days} days after a shift, so re-check a recent month later.`,
        ],
      },
      {
        q: 'A Treasurer lost access to Donations after a role was renamed.',
        a: ['Finance access follows the role names “Treasurer” and “Financial Secretary”. A Super Admin should restore the exact name under Global Lookup Tables → Role.'],
      },
    ],
  },
  {
    title: 'Emergency alerts and Supreme reporting',
    audience: 'Admins & officers',
    topics: [
      {
        q: 'How do I send an urgent alert to volunteers?',
        a: [
          'Communications Hub → Open emergency dispatch. Enter a title and message, choose a priority, then tick trade skill networks, upcoming shift rosters, or both.',
          'Skill networks reach your own council’s active members. A shift roster reaches everyone signed up for it, including volunteers from sister councils sharing the event.',
          'Every recipient sees the alert in their bell; members who allowed notifications on their phone also get a push. Admins, the Financial Secretary, the Treasurer and Super Admins can dispatch.',
        ],
      },
      {
        q: 'How do I file Form 1728 or Form 1295?',
        a: [
          'Administrative Lookups → Supreme Council Sync. Choose the form and a completed reporting period: a calendar year for Form 1728, a half-year for Form 1295.',
          'Check the Simulate and Audit Compliance Report figures against your books, enter the Alchemer survey id Supreme gave you, and select Transmit Report to Supreme via Alchemer API.',
          'Every attempt appears on the Sync history timeline: a gold dot for success, a red one for a failure with its reason. Periods that have not ended cannot be filed.',
        ],
      },
    ],
  },
];

const slug = (title: string) => `help-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const matches = (topic: Topic, words: string[]) => {
  const text = `${topic.q} ${topic.a.join(' ')}`.toLowerCase();
  return words.every((w) => text.includes(w));
};

export default function HelpPage() {
  const timings = useCouncilTimings();
  const [query, setQuery] = useState('');
  // Sprint 8P Stage 1: the header's global search opens this page with ?q= - start with those words.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, []);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const shown = helpSections(timings).map((s) => ({ ...s, topics: s.topics.filter((t) => matches(t, words)) })).filter((s) => s.topics.length > 0);
  const count = shown.reduce((n, s) => n + s.topics.length, 0);

  return (
    <>
      <PageTitle>Online Help Center</PageTitle>
      <div className="flex max-w-4xl flex-col gap-4">
        <p className="text-sm">
          Quick answers drawn from the Member User Guide and the Administrator Operations Manual. Select a question to open its answer. Still stuck? Message your
          council&apos;s Admin through the Communications Hub.
        </p>
        <Field label="Search help" hint={searching ? `${count} answer${count === 1 ? '' : 's'} match; matching questions open automatically.` : undefined} className="max-w-md">
          {(id) => <Input id={id} type="search" value={query} placeholder="e.g. QR code, 15 minutes, no-show" onChange={(e) => setQuery(e.target.value)} />}
        </Field>
        {shown.length === 0 ? <Empty>No answer matches “{query}”. Try fewer or different words.</Empty> : null}
        {shown.map((section) => (
          <section key={section.title} aria-labelledby={slug(section.title)} className="rounded border border-line bg-white">
            <header className="flex items-center justify-between gap-3 border-b-4 border-gold bg-white px-4 py-2">
              <h2 id={slug(section.title)} className="font-serif text-lg font-bold text-navy">
                {section.title}
              </h2>
              <Pill tone={section.audience === 'Everyone' ? 'outline' : 'navy'}>{section.audience}</Pill>
            </header>
            <div className="divide-y divide-line">
              {section.topics.map((topic) => (
                // Remounting on search changes lets matches open while still letting the reader close them.
                <details key={`${topic.q}-${searching}`} open={searching} className="group px-4">
                  <summary className="flex cursor-pointer list-none items-start gap-2 py-2 text-sm font-bold text-navy">
                    <span aria-hidden="true" className="w-3 shrink-0 transition-transform group-open:rotate-90">
                      ›
                    </span>
                    <span className="group-hover:underline">{topic.q}</span>
                  </summary>
                  <div className="flex flex-col gap-2 pb-3 pl-5 text-sm leading-relaxed">
                    {topic.a.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
