'use client';
// Sprint 8Q: the Historian's monthly newsletters as readers see them.
//   BulletinBody       one bulletin's text laid out by its body format (recorder-historian.ts parseBulletinBlocks):
//                      STRUCTURED paragraphs with clean spacing, '## ' section headings and '- ' bullet lists, or PLAIN
//                      text with its line breaks kept.
//   LatestBulletinsFeed '[ 📰 Latest Council Newsletters & Bulletins ]' (BULLETIN_FEED_TITLE): the newest saved bulletins
//                      (history.listBulletinFeed, any member of the council), leading Home and the Member Actions page.
//                      The newest opens in full; the older ones open on a click. Nothing shows while there is none.
import { useState } from 'react';
import { BULLETIN_FEED_TITLE, bulletinTitle, parseBulletinBlocks, type CouncilHistorianBulletin } from '@kofc/shared';
import { cx, Notice } from '@/components/ui';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** One bulletin body, block by block. */
export function BulletinBody({ bulletin, className }: { bulletin: Pick<CouncilHistorianBulletin, 'body' | 'body_format'>; className?: string }) {
  const blocks = parseBulletinBlocks(bulletin.body, bulletin.body_format);
  if (blocks.length === 0) return <p className="text-sm text-muted">No text yet.</p>;
  return (
    <div className={cx('flex flex-col gap-3 text-base leading-relaxed', className)}>
      {blocks.map((block, i) =>
        block.kind === 'heading' ? (
          <h4 key={i} className="font-serif text-lg font-bold">
            {block.text}
          </h4>
        ) : block.kind === 'list' ? (
          <ul key={i} className="ml-5 list-disc space-y-1">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/** The Home and Member Actions feed of the council's newest bulletins. */
export function LatestBulletinsFeed({ memberId, councilId, className }: { memberId: number; councilId: number; className?: string }) {
  const feed = useLoad(() => db.history.listBulletinFeed(memberId, councilId), [memberId, councilId]);
  const [openId, setOpenId] = useState<number | null>(null);
  const rows = feed.data ?? [];
  if (feed.error) {
    return (
      <div className={className}>
        <Notice tone="error">{feed.error}</Notice>
      </div>
    );
  }
  if (rows.length === 0) return null;
  const shownId = openId ?? rows[0].id;
  return (
    <section aria-label="Latest Council Newsletters & Bulletins" className={cx('rounded border-4 border-gold bg-white', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-navy bg-navy px-4 py-2.5 text-white" data-surface="navy">
        <h2 className="font-serif text-lg font-bold">{BULLETIN_FEED_TITLE}</h2>
        <span className="text-sm">From the Council Historian</span>
      </header>
      <ul className="divide-y divide-line">
        {rows.map((b) => {
          const open = b.id === shownId;
          return (
            <li key={b.id} className="px-4 py-3">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? -1 : b.id)}
                className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left"
              >
                <span className="font-serif text-xl font-bold text-navy hover:underline">{bulletinTitle(b)}</span>
                <span className="text-sm text-muted">{monthLabel(b.bulletin_month)}</span>
              </button>
              {open ? <BulletinBody bulletin={b} className="mt-2 max-w-prose" /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
