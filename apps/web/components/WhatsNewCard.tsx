'use client';
// Sprint 11 Revision 22.0 (release-registry.ts): the What's New notice on Home. It shows the newest executed release when
// its version is newer than the version this viewer last dismissed, for WHATS_NEW_WINDOW_DAYS after the release. The
// dismissed version is kept in this browser only (WHATS_NEW_SEEN_KEY), a per-viewer convenience: without storage the
// notice shows until dismissed for the visit.
import { useState } from 'react';
import { shouldShowWhatsNew, WHATS_NEW_SEEN_KEY, WHATS_NEW_TITLE } from '@kofc/shared';
import { Button } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** How many change lines the card shows before 'Show all'. */
const PREVIEW_LINES = 6;

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(WHATS_NEW_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(version: string): void {
  try {
    window.localStorage.setItem(WHATS_NEW_SEEN_KEY, version);
  } catch {
    // Storage blocked: the dismissal lasts for this visit only.
  }
}

export function WhatsNewCard() {
  const user = useUser();
  const release = useLoad(() => db.advisory.getLatestRelease(user.memberId), [user.memberId]);
  const [dismissed, setDismissed] = useState(false);
  const [all, setAll] = useState(false);
  const r = release.data ?? null;
  if (dismissed || !r || !shouldShowWhatsNew(r, readSeen(), new Date())) return null;
  const lines = all ? r.change_list : r.change_list.slice(0, PREVIEW_LINES);
  return (
    <section aria-label={WHATS_NEW_TITLE} data-whats-new={r.target_version} className="mb-4 rounded border-2 border-l-8 border-navy border-l-gold bg-white p-4 text-navy">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl font-bold">
            {WHATS_NEW_TITLE}: {r.name} <span className="text-base">v{r.target_version}</span>
          </h2>
          <p className="text-xs text-muted">Released {formatFullDate((r.executed_at ?? r.scheduled_date).slice(0, 10))}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            writeSeen(r.target_version);
            setDismissed(true);
          }}
        >
          Got it
        </Button>
      </div>
      {lines.length ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm">Maintenance release.</p>
      )}
      {r.change_list.length > PREVIEW_LINES ? (
        <button type="button" className="mt-1 text-sm font-bold underline" onClick={() => setAll(!all)}>
          {all ? 'Show less' : `Show all ${r.change_list.length} changes`}
        </button>
      ) : null}
    </section>
  );
}
