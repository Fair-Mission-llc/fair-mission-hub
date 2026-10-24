'use client';
// '🗓️ Sync with Your Phone Calendar' (Sprint 9 Revision 2.0): the member's own read-only calendar feed link on the
// Calendar page, in a copyable box with plain-English steps. The link comes from /api/calendar/link (calendar-transport.ts)
// and opens only the member's own shifts and meetings (/api/calendar/sync). Apple Calendar and Outlook users can tap
// Subscribe, which opens the webcal:// form of the same link.
import { useRef, useState } from 'react';
import { CALENDAR_SYNC_CARD_TITLE } from '@kofc/shared';
import { Button, Field, Input, Notice, Panel } from '@/components/ui';
import { useLoad } from '@/lib/use-load';
import { fetchCalendarLink } from '@/services/calendar-transport';

export function CalendarSyncCard() {
  const link = useLoad(() => fetchCalendarLink(), []);
  const box = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<'yes' | 'select' | null>(null);

  const copy = async () => {
    if (!link.data) return;
    try {
      await navigator.clipboard.writeText(link.data.url);
      setCopied('yes');
    } catch {
      // No clipboard permission (for example over plain http): select the text so the member can copy it themselves.
      box.current?.querySelector('input')?.select();
      setCopied('select');
    }
  };

  return (
    <Panel title={CALENDAR_SYNC_CARD_TITLE}>
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Put your own shifts and council meetings on your phone calendar. Copy your personal link and add it to Google Calendar, Apple Calendar or
          Outlook as a calendar subscription. Your calendar checks for changes by itself, about once an hour.
        </p>
        {link.error ? <Notice tone="error">{link.error}</Notice> : null}
        <Field label="Your personal calendar link" hint="Keep this link private: anyone who has it can read your schedule.">
          {(id) => (
            <div ref={box} className="flex flex-wrap gap-2">
              <Input
                id={id}
                readOnly
                value={link.data?.url ?? (link.loading ? 'Making your link…' : '')}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 text-xs"
              />
              <Button variant="gold" disabled={!link.data} onClick={() => void copy()}>
                {copied === 'yes' ? '✓ Copied' : 'Copy link'}
              </Button>
              {link.data ? (
                <a
                  href={link.data.webcalUrl}
                  className="rounded border-2 border-navy bg-white px-4 py-1.5 text-sm font-bold text-navy"
                  aria-label="Subscribe in Apple Calendar or Outlook"
                >
                  Subscribe
                </a>
              ) : null}
            </div>
          )}
        </Field>
        {copied === 'select' ? <p className="text-xs text-muted">The link is selected. Press Ctrl+C (or Cmd+C on a Mac) to copy it.</p> : null}
        <ul className="list-disc pl-5 text-sm">
          <li>
            <span className="font-bold">Google Calendar:</span> on a computer, open Google Calendar, select <span className="font-bold">+</span> next to{' '}
            <span className="font-bold">Other calendars</span>, select <span className="font-bold">From URL</span>, paste the link and select{' '}
            <span className="font-bold">Add calendar</span>.
          </li>
          <li>
            <span className="font-bold">iPhone or iPad:</span> open <span className="font-bold">Settings → Apps → Calendar → Calendar Accounts → Add Account →
            Other → Add Subscribed Calendar</span>, paste the link and tap <span className="font-bold">Next</span>. Or tap <span className="font-bold">Subscribe</span> above
            on the device.
          </li>
          <li>
            <span className="font-bold">Outlook:</span> select <span className="font-bold">Add calendar → Subscribe from web</span>, paste the link and select{' '}
            <span className="font-bold">Import</span>.
          </li>
        </ul>
        <p className="text-xs text-muted">The calendar is read-only. To sign up for a shift or answer an invitation, use the portal or the phone app.</p>
      </div>
    </Panel>
  );
}
