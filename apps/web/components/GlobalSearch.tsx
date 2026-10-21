'use client';
// Sprint 8P Stage 1: the global search bar in the header row (global-search.ts searchGlobal). It finds the reader's own
// pages (the role-filtered sidebar of navigationGuide), the council's events, the council's members for readers who may
// open the Affiliated Roster, and always offers the Online Help Center and the Interactive Help Desk with the words
// carried over. Events and members load once, the first time the input gets focus, so pages that never search pay
// nothing.
// Sprint 8S Revision 7: every query passes the reader's clearance mask (portalAreas), so restricted finance, payables and
// configuration pages never show to a seat that does not clear them.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  GLOBAL_SEARCH_LABEL,
  GLOBAL_SEARCH_MIN_CHARS,
  GLOBAL_SEARCH_PLACEHOLDER,
  navigationGuide,
  portalAreas,
  searchGlobal,
  type GlobalSearchEvent,
  type GlobalSearchMember,
  type GlobalSearchPage,
} from '@kofc/shared';
import { NAV } from '@/components/Sidebar';
import { cx } from '@/components/ui';
import { useSession } from '@/lib/session';
import { db } from '@/services/db';

interface LoadedData {
  events: GlobalSearchEvent[];
  members: GlobalSearchMember[];
}

export function GlobalSearch() {
  const { user, features, tenantType } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [data, setData] = useState<LoadedData | null>(null);
  const loading = useRef(false);

  const areas = useMemo(() => (user ? new Set<string>(portalAreas(user, features, tenantType)) : new Set<string>()), [user, features, tenantType]);
  const pages = useMemo<GlobalSearchPage[]>(() => {
    if (!user) return [];
    const guide = navigationGuide(user, features, tenantType);
    const items = [...guide.groups.flatMap((g) => g.entries.map((e) => e.item)), ...guide.topBar.map((t) => t.item)];
    return items.map((item) => NAV[item]).filter(Boolean).map((n) => ({ label: n.label, hint: n.hint, href: n.href }));
  }, [user, features, tenantType]);

  const load = () => {
    if (!user || loading.current) return;
    loading.current = true;
    const mayReadRoster = areas.has('members');
    void Promise.all([
      db.events.listByCouncil(user.councilId).catch(() => []),
      mayReadRoster ? db.members.listByCouncil(user.councilId, { activeOnly: true }).catch(() => []) : Promise.resolve([]),
    ]).then(([events, members]) =>
      setData({
        events: events.map((e) => ({ id: e.id, name: e.EventName, date: e.StartDate, location: e.Location ?? '' })),
        members: members.map((m) => ({ id: m.id, firstName: m.MemberFirstName, lastName: m.MemberLastName, memberNumber: m.MemberNumber })),
      }),
    );
  };

  const hits = useMemo(
    () =>
      searchGlobal(query, {
        pages,
        events: data?.events,
        members: data?.members,
        eventHref: areas.has('events') ? '/events' : '/calendar',
        memberHref: areas.has('members') ? '/members' : undefined,
        areas,
      }),
    [query, pages, data, areas],
  );
  const shown = open && query.trim().length >= GLOBAL_SEARCH_MIN_CHARS;

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      go(hits[active].href);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (!user) return null;
  return (
    <div className="relative min-w-0 max-w-xl flex-1" role="search">
      <input
        type="search"
        aria-label={GLOBAL_SEARCH_LABEL}
        aria-expanded={shown}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        role="combobox"
        placeholder={GLOBAL_SEARCH_PLACEHOLDER}
        value={query}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded border-2 border-gold bg-white px-3 py-1.5 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold"
      />
      {shown ? (
        <ul
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 z-30 mt-1 max-h-[70vh] overflow-y-auto rounded border-2 border-navy border-t-4 border-t-gold bg-white text-navy shadow-xl"
        >
          {hits.map((hit, i) => (
            <li key={`${hit.kind}-${hit.href}-${hit.label}`} role="option" aria-selected={i === active}>
              <Link
                href={hit.href}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  go(hit.href);
                }}
                onMouseEnter={() => setActive(i)}
                className={cx('flex items-baseline gap-2 px-3 py-2 text-sm', i === active ? 'bg-gold' : 'hover:bg-gold/40')}
              >
                <span className="w-16 shrink-0 text-xs font-bold uppercase">{hit.kind}</span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{hit.label}</span>
                  <span className="block truncate text-xs">{hit.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
