'use client';
// The portal's left sidebar (Sprint 6Z redesign): a navy column of the seven pillars from portalSidebar - Governance,
// Faith In Action, Finances, Performance, Resources, Answers and System Settings (named Setup before the Sprint 7C
// Extension) - every pillar always open, with no accordions. The Navigation Guide link is pinned above the pillars.
// Only the links the viewer may open are drawn: since the Sprint 6G Extension a desk the viewer's role cannot open is
// removed from the sidebar, never shown locked or greyed out. The current page carries a gold marker.
// Sprint 6A: a module the council's feature flags switch off is left out entirely too.
// Sprint 6Z-Dual-Gate-Model: a white-label tenant loses the fraternal areas the same way, and every label, tooltip and
// pillar name is drawn through whiteLabel in the tenant's vocabulary.
// Sprint 8C: the Leadership Auditing Queue link is gone (the page stays reachable from the Financial Secretary Desk), the
// member-center link is labelled Council Dashboard, and a click on Executive Dashboard always resets the Active Desks
// to the Home landing deck (EXECUTIVE_DASHBOARD_HOME_HREF), even on /dashboard itself.
// Sprint 8D/8E: Executive Dashboard is a plain link again, to the Executive Summary's own page (EXECUTIVE_DASHBOARD_HREF).
// Sprint 10 Revision 1.0: no Home link (the Home tab above every page opens it). The '📸 Media & Memory Center' node is
// pinned under the Navigation Guide with its two views, Browse Albums and Gallery Management Center (GALLERY_VIEWS). The
// sidebar collapses: the hamburger button at its top hides or shows the links, and this browser remembers the choice.
// Sprint 11 Revision 2.0: a text-only rail. Every link label is drawn through plainNavLabel, which strips icon glyphs
// ('📸 Media & Memory Center' reads 'Media & Memory Center'); external links lost their arrow and the collapsed legal
// button reads 'Legal'. The Admin Desk link heads the System Settings pillar for Admins and Super Admins.
// Sprint 11 Revision 2.1: no hamburger. An open rail shows a left arrow (◀, SIDEBAR_HIDE_GLYPH) at its top right that
// hides it; the hidden rail shrinks to a slim strip on the left edge whose right arrow (▶, SIDEBAR_SHOW_GLYPH) brings it back.
// The strip keeps the legal documents as vertical tabs (schema 103 pass).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ADMIN_DESK_HREF,
  ADMIN_DESK_TITLE,
  DISTRICT_DESK_HREF,
  DISTRICT_DESK_TITLE,
  REGIONAL_ASSIGNMENTS_TITLE,
  STATE_DESK_HREF,
  STATE_DESK_TITLE,
  canOpenArchiveVault,
  COUNCIL_PHOTO_GALLERY_TITLE,
  EXECUTIVE_DASHBOARD_HREF,
  GALLERY_VIEWS,
  galleryViewFromAnchor,
  portalAreas,
  portalSidebar,
  whiteLabel,
  type FeatureFlags,
  type PortalNavGroup,
  type PortalNavItem,
  type SessionUser,
  type TenantType,
  ADVISORY_PANEL_HREF,
  ADVISORY_PANEL_TITLE,
  LEGAL_NOTICES,
  LEGAL_DOCUMENT_ROUTE,
  isLegalDocumentId,
  plainNavLabel,
  type LegalNoticeId,
} from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { Markdown } from '@/components/Markdown';
import { cx } from '@/components/ui';

export interface NavEntry {
  href: string;
  label: string;
  hint: string;
  /** Who may open it (Sprint 5Z-10): kept for reference; the sidebar no longer draws desks the viewer may not open. */
  restrictedTo?: string;
}

/**
 * Every sidebar link's route, label and tooltip. 'profile' is reached from the header's member menu, and 'messages' and
 * 'distribution-lists' from the header's Messaging menu, not the sidebar. 'expenses/queue' left the sidebar in Sprint 8C
 * and keeps its entry for the pages that link to it.
 */
export const NAV: Record<PortalNavItem | 'profile' | 'messages' | 'distribution-lists' | 'navigation-guide' | 'expenses/queue', NavEntry> = {
  home: { href: '/dashboard#home', label: 'Home', hint: 'Newsletters, feast days, reminders, the prayer list and the honor board' },
  'member-actions': { href: '/member-actions', label: 'Member Actions Hub', hint: 'My shifts, sign-ups, charity requests, sheets, roster and hours' },
  roster: { href: '/roster', label: 'Roster & Achievements', hint: 'Brother Knights of your council and sister councils, with phone and email' },
  messages: { href: '/messages', label: 'Council Messages & Alerts', hint: 'Message threads, trade-team messages and alerts' },
  calendar: { href: '/calendar', label: 'Visual Master Calendar', hint: 'Events, shifts and meetings by date' },
  'faith-center': { href: '/faith-center', label: 'Faith Center', hint: "Today's feast day, the daily Bible verse and the Council Prayer Intentions List" },
  activities: { href: '/activities', label: 'Standalone Activities', hint: 'Standing council activities' },
  events: { href: '/events', label: 'Event Planner', hint: 'Events, shifts and councils' },
  meetings: { href: '/meetings', label: 'Meeting Center', hint: 'Meetings, invitations, minutes' },
  'meetings/cadence': {
    href: '/meetings/cadence',
    label: 'Recurring Meetings',
    hint: 'Standing meeting patterns and the annual calendar',
    restrictedTo: 'the Grand Knight, the Deputy Grand Knight and Admins',
  },
  'meetings/live': {
    href: '/meetings/live',
    label: 'Live Meeting Console',
    hint: 'Run a meeting live: agenda, check-ins, secret ballots and the hand-vote recorder',
    restrictedTo: 'council officers and Admins',
  },
  elections: { href: '/elections', label: 'Council Election Center', hint: 'Election progress, nominations and the secret ballot at a live meeting' },
  gallery: { href: '/gallery', label: COUNCIL_PHOTO_GALLERY_TITLE, hint: 'Event photos, Smart Albums, slideshows and photo uploads' },
  ledger: { href: '/ledger', label: 'Post-event Ledger', hint: 'Spend, funds raised, hours, lessons' },
  'lessons-registry': { href: '/lessons-registry', label: 'Lessons Registry', hint: 'Lessons learned across councils' },
  'distribution-lists': { href: '/distribution-lists', label: 'My Distribution Lists', hint: 'Your private member segments and the council-wide lists' },
  dashboard: {
    href: EXECUTIVE_DASHBOARD_HREF,
    label: 'Executive Dashboard',
    hint: 'The Executive Summary: Faith-in-Action, monthly hours, members and funds, budget tracking, roadmap and audits',
  },
  'finance/dashboard': { href: '/finance/dashboard', label: 'Financial Dashboard', hint: 'Liquidity tanks, balance scale, transfers, bank audits' },
  'finance/ledger': { href: '/finance/ledger', label: 'Transaction Ledger', hint: 'Chart of accounts with every posting' },
  'finance/balance-sheet': { href: '/finance/balance-sheet', label: 'Balance Sheet', hint: 'Assets against liabilities and equity' },
  'finance/audit': { href: '/finance/audit', label: 'Financial Inspections', hint: 'Semiannual Form 1295 audit: verify ledger lines, sign and lock' },
  'finance/treasurer-desk': {
    href: '/finance/treasurer-desk',
    label: 'Treasurer Ledger Audit Desk',
    hint: 'Code ordered expense reports to a budget line and ledger account',
    restrictedTo: 'the Treasurer and Admins',
  },
  donations: { href: '/donations', label: 'Donations History', hint: 'Record and review council donations' },
  expenses: { href: '/expenses', label: 'My Expense Reports', hint: 'Receipts and reimbursement status' },
  'expenses/queue': { href: '/expenses/queue', label: 'Leadership Auditing Queue', hint: 'Track signatures and return reports' },
  'expenses/audit': {
    href: '/expenses/audit',
    label: 'FS Expense Audit',
    hint: 'Issue payment requests on submitted reports',
    restrictedTo: 'the Financial Secretary and Admins',
  },
  'expenses/authorize': {
    href: '/expenses/authorize',
    label: 'GK Expense Authorize',
    hint: 'Counter-sign ordered reports',
    restrictedTo: 'the Grand Knight, the Deputy Grand Knight and Admins',
  },
  'expenses/disbursements': { href: '/expenses/disbursements', label: 'Bulk Check Payments Made', hint: 'Pay dual-signed reports by check' },
  'charities/propose': { href: '/charities/propose', label: 'Propose Charity Grant', hint: "Shepherd an organization's request to the council and follow it" },
  'charities/registry': { href: '/charities/registry', label: 'Global Charities Registry', hint: 'Search, suggest and add charities' },
  'charities/queue': { href: '/charities/queue', label: 'Charity Payments Made Ledger', hint: 'Pay charity proposals by check' },
  'charities/vetting': {
    href: '/charities/vetting',
    label: 'Charity Vetting Queue',
    hint: 'Claim, audit and advance intake requests',
    restrictedTo: 'council officers, Trustees and Admins',
  },
  'financials/budget': { href: '/budget', label: 'Annual Budget Center', hint: 'Draft the council budget May 1 - June 30 and assign its Budget Director' },
  'council-lookups': { href: '/council-lookups', label: 'Council Lookup Tables', hint: 'Activities, donation types, methods' },
  'credentials-vault': {
    href: '/credentials-vault',
    label: 'Secure Access Vault',
    hint: 'Connect the council email account and Google Drive',
    restrictedTo: 'council officers, Admins and Super Admins',
  },
  'elections/appointments': { href: '/elections/appointments', label: 'Appointed Leadership Matrix', hint: "The Grand Knight's appointments and vacant seats" },
  'supreme-sync': { href: '/supreme-sync', label: 'Supreme Council Sync', hint: 'Audit and file Forms 1728 and 1295' },
  lookups: { href: '/lookups', label: 'Global Lookup Tables', hint: 'Maintain the global lookup tables' },
  'expenses/assets': { href: '/expenses/assets', label: '🛠️ Council Asset Management', hint: "The council's capital assets: serial numbers, locations and photos" },
  parishes: { href: '/parishes', label: 'Parish & Pastors Linkage', hint: 'Parishes and their pastors' },
  councils: { href: '/councils', label: 'Councils', hint: 'Add, edit and delete councils and their registration profiles' },
  'feature-flags': {
    href: '/feature-flags',
    label: 'Master Feature Deployment Grid',
    hint: "Switch each council's optional modules on and off",
    restrictedTo: 'Super Admins',
  },
  'system-settings/global-settings': {
    href: '/system-settings/global-settings',
    label: 'Global System Parameters',
    hint: "Each council's base dues rate and tenant type, and the recording and character limits every council shares",
    restrictedTo: 'Super Admins',
  },
  'system-settings/remote-assistance': {
    href: '/system-settings/remote-assistance',
    label: 'Remote Assistance Desk',
    hint: 'Watch the screens officers share when they ask for help',
    restrictedTo: 'Super Admins',
  },
  'system-settings/impersonate': {
    href: '/system-settings/impersonate',
    label: 'Impersonate Council Admin',
    hint: 'Find a council Admin and view the portal as them while you help',
    restrictedTo: 'Super Admins',
  },
  'system-settings/view-as-member': {
    href: '/system-settings/view-as-member',
    label: 'View As Member',
    hint: 'A read-only picture of what one member of your council sees',
    restrictedTo: 'council Admins and Super Admins',
  },
  'system-settings/regional-assignments': {
    href: '/system-settings/regional-assignments',
    label: REGIONAL_ASSIGNMENTS_TITLE,
    hint: 'Name District Deputies, State Officers and State Admins and bind their councils',
    restrictedTo: 'Super Admins and State Admins',
  },
  'district-desk': {
    href: DISTRICT_DESK_HREF,
    label: DISTRICT_DESK_TITLE,
    hint: "Hours, money, assets, calendar and leaders across your district's councils",
    restrictedTo: 'District Deputies and Super Admins',
  },
  'state-desk': {
    href: STATE_DESK_HREF,
    label: STATE_DESK_TITLE,
    hint: "Hours, money, assets, calendar and leaders across your state's councils",
    restrictedTo: 'State Officers, State Admins and Super Admins',
  },
  'admin-desk': {
    href: ADMIN_DESK_HREF,
    label: ADMIN_DESK_TITLE,
    hint: 'The Administration Manual, settings, lookups, vault, charities, assets and feedback in one desk of drawers',
    restrictedTo: 'council Admins and Super Admins',
  },
  'system-settings/feedback': {
    href: '/system-settings/feedback',
    label: 'Administrative Feedback Loops',
    hint: 'Send a note or bug report to the platform owner',
    restrictedTo: 'council Admins and Super Admins',
  },
  'navigation-guide': {
    href: '/navigation-guide',
    label: 'Navigation Guide',
    hint: 'What each link in your sidebar does, in plain English',
  },
  'system-settings/council-settings': {
    href: '/system-settings/council-settings',
    label: 'Council Wide Settings',
    hint: 'Daily activity and hour limits, shift padding and the inactive-member window',
    restrictedTo: 'council officers, Admins and Super Admins',
  },
  'system-settings/affiliations': {
    href: '/system-settings/affiliations',
    label: 'Connected Councils',
    hint: 'Invite nearby councils in your state to affiliate, and answer their invites',
    restrictedTo: 'council Admins, the Grand Knight, the Deputy Grand Knight and Super Admins',
  },
  'system-settings/knowledge-archive': {
    href: '/system-settings/knowledge-archive',
    label: 'Operations Knowledge Vault',
    hint: "Search past officers' signed operating notes by tag and year",
    restrictedTo: 'council officers, Admins and Super Admins',
  },
  help: { href: '/help', label: 'Online Help Center', hint: 'Searchable answers from the user manuals' },
  'governance/bylaws': { href: '/governance/bylaws', label: 'Constitutional Bylaws', hint: "The council's own bylaws, article by article" },
  'governance/advisor': {
    href: '/governance/advisor',
    label: 'Constitutional Advisor',
    hint: 'Ask a parliamentary question; answers cite the bylaws or the baseline rules',
    restrictedTo: 'council officers, Admins and Super Admins',
  },
  'answers/help': { href: '/answers/help', label: 'Interactive Help Desk', hint: 'Type what you need to do and see the steps from the member guide' },
  'answers/sop': { href: '/answers/sop', label: 'SOP Center', hint: 'Standard operating procedures, kept as markdown files' },
  'resources/bulletins': { href: '/resources/bulletins', label: 'Council Artifacts', hint: 'Google Drive files and the compliance reports the portal compiles' },
  'resources/marketing': {
    href: '/resources/marketing',
    label: 'Recruitment Factory',
    hint: 'Turn an event into a printable flyer with past photos, and file it in Google Drive',
  },
  'member-center': {
    href: '/member-center',
    label: 'Council Dashboard',
    hint: "The council's volunteers, hours, devotions and Top 5 leaderboard, and your own impact card",
  },
  'inventory/loaner-library': { href: '/inventory/loaner-library', label: 'Shared Equipment Library', hint: 'Equipment councils lend to each other' },
  'performance/charts': { href: '/performance/charts', label: 'Growth & Hours Charts', hint: 'Membership growth velocity and council hours by month' },
  history: { href: '/history', label: 'Historical Chronology', hint: "Each year's officer core, collective accomplishments and oral histories" },
  profile: { href: '/profile', label: 'My Profile', hint: 'Photo, biography, contact details, skills' },
};

/**
 * Links outside the portal, drawn after a group's own entries and opened in a new tab (Sprint 5Z-Demo-Assets). A link with
 * `visible` shows only to the viewers it allows (Sprint 5Z-Demo-Final); the destination's own sharing settings still
 * decide who can open it.
 */
interface ExternalNavEntry {
  href: string;
  label: string;
  hint: string;
  visible?: (user: SessionUser) => boolean;
}

export const EXTERNAL_NAV: Partial<Record<PortalNavGroup['id'], ExternalNavEntry[]>> = {
  resources: [
    {
      href: 'https://drive.google.com/drive/u/3/folders/1ZGDjpkJG61hzWvDFRg4IZHI440ZYDjyH',
      label: '📂 Council Archive Vault',
      hint: "The council's shared Google Drive archive folder (opens in a new tab)",
      visible: canOpenArchiveVault,
    },
  ],
};

/** A sidebar link to a site outside the portal, opened in a new browser tab. */
function ExternalNavLink({ href, label, hint }: Omit<ExternalNavEntry, 'visible'>) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={hint}
        className="flex items-center gap-2 border-l-8 border-transparent py-1.5 pl-6 pr-3 text-sm hover:underline"
      >
        {plainNavLabel(label)}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}

/**
 * Whether a link is the open page. Sprint 8S: Home and the Member Actions link shared /dashboard, so a link with an anchor
 * is current only while the URL carries that anchor (Home also with no anchor at all).
 */
const isCurrent = (pathname: string, item: PortalNavItem | 'navigation-guide', hash = ''): boolean => {
  const [path, anchor] = NAV[item].href.split('#');
  if (pathname !== path) return false;
  if (!anchor) return true;
  const open = hash.replace(/^#/, '');
  return open === anchor || (anchor === 'home' && open === '');
};

/** The URL anchor, kept current as the dashboard tabs change it. */
function useHash(): string {
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return hash;
}

const navLinkClass = (current: boolean) =>
  cx('flex items-center gap-2 border-l-8 py-1.5 pl-6 pr-3 text-sm', current ? 'border-gold bg-white font-bold text-navy' : 'border-transparent hover:underline');

/** One dense sidebar link: the label only, with its description as the tooltip; gold marker when current. */
function NavLink({ item, current, tenant }: { item: PortalNavItem | 'navigation-guide'; current: boolean; tenant: TenantType }) {
  const { href, label, hint } = NAV[item];
  return (
    <li>
      <Link href={href} title={whiteLabel(hint, tenant)} aria-current={current ? 'page' : undefined} className={navLinkClass(current)}>
        {plainNavLabel(whiteLabel(label, tenant))}
      </Link>
    </li>
  );
}

/** Sprint 10 Revision 1.0: where this browser keeps the sidebar's collapsed state. */
const SIDEBAR_COLLAPSED_KEY = 'kofc.sidebarCollapsed';

/** Sprint 11 Revision 2.1: the arrow that hides the open rail, and the one on the left edge that brings it back. */
const SIDEBAR_HIDE_GLYPH = '◀';
const SIDEBAR_SHOW_GLYPH = '▶';

/** The sidebar's collapsed state, remembered in this browser (storage may be blocked; the sidebar then starts open). */
function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // Storage blocked: stay open.
    }
  }, []);
  const toggle = () =>
    setCollapsed((now) => {
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, now ? '0' : '1');
      } catch {
        // Storage blocked: the choice lasts for this page only.
      }
      return !now;
    });
  return [collapsed, toggle];
}

/**
 * The top-level '📸 Media & Memory Center' node (Sprint 10 Revision 1.0): the gallery link and its two views. On the
 * gallery page a view link changes only the anchor, which the page hears as a hashchange.
 */
function GalleryNode({ pathname, hash, tenant }: { pathname: string; hash: string; tenant: TenantType }) {
  const onGallery = pathname === NAV.gallery.href;
  const open = galleryViewFromAnchor(hash);
  return (
    <ul aria-label="Media & Memory Center" className="flex flex-col border-t border-t-gold pb-2 pt-1">
      <NavLink item="gallery" current={onGallery && hash === ''} tenant={tenant} />
      {GALLERY_VIEWS.map((v) => {
        const current = onGallery && hash !== '' && open === v.id;
        return (
          <li key={v.id}>
            <Link
              href={`${NAV.gallery.href}#${v.id}`}
              title={whiteLabel(v.hint, tenant)}
              aria-current={current ? 'page' : undefined}
              onClick={(e) => {
                if (!onGallery) return;
                e.preventDefault();
                window.location.hash = v.id;
              }}
              className={cx(navLinkClass(current), 'pl-10 text-xs')}
            >
              {plainNavLabel(whiteLabel(v.label, tenant))}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Sprint 10 Revision 3.1: the notices the sidebar footer links to. */
const SIDEBAR_LEGAL_NOTICES: readonly LegalNoticeId[] = ['terms', 'privacy'];

/**
 * The sidebar's persistent legal footer (Sprint 10 Revision 3.1): Terms of Service and Privacy Policy, always at the foot of
 * the rail - as text links while the sidebar is open, as one ⚖ button while it is collapsed. Each opens its notice
 * (legal-notices.ts) in a drawer over the page.
 *
 * Sprint 11 Revision 1.0: the drawer reads the October 26, 2026 Terms of Service and Privacy Policy files (docs/legal/,
 * LEGAL_DOCUMENT_ROUTE) and draws them with the markdown renderer; the built-in paragraphs show only if a file cannot be read.
 */
function useLegalDocument(id: LegalNoticeId | null): { markdown: string | null; loading: boolean } {
  const [docs, setDocs] = useState<Partial<Record<LegalNoticeId, string | null>>>({});
  useEffect(() => {
    if (!isLegalDocumentId(id) || id in docs) return;
    let current = true;
    void fetch(`${LEGAL_DOCUMENT_ROUTE}?notice=${id}`, { cache: 'no-store' })
      .then(async (res) => (res.ok ? ((await res.json()) as { markdown?: string }).markdown ?? null : null))
      .catch(() => null)
      .then((markdown) => {
        if (current) setDocs((d) => ({ ...d, [id]: markdown }));
      });
    return () => {
      current = false;
    };
  }, [id, docs]);
  if (!isLegalDocumentId(id)) return { markdown: null, loading: false };
  return { markdown: docs[id] ?? null, loading: !(id in docs) };
}

function SidebarLegalFooter({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState<LegalNoticeId | null>(null);
  const notice = LEGAL_NOTICES.find((n) => n.id === open);
  const items = LEGAL_NOTICES.filter((n) => SIDEBAR_LEGAL_NOTICES.includes(n.id));
  const legalFile = useLegalDocument(open);
  return (
    <footer aria-label="Legal" className={cx('mt-auto border-t border-t-gold pt-2 text-xs', collapsed ? 'px-1' : 'px-3')}>
      {collapsed ? (
        // Sprint 11 Revision 2.1: the slim strip keeps one vertical tab per legal document.
        <ul aria-label="Legal documents" className="flex flex-col items-center gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setOpen(n.id)}
                title={n.title}
                className="rounded border border-gold/60 px-0.5 py-2 text-[0.625rem] font-bold uppercase [writing-mode:vertical-rl] hover:text-gold"
              >
                {n.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => setOpen(n.id)} className="text-left underline-offset-2 hover:text-gold hover:underline">
                {n.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice && typeof document !== 'undefined'
        ? createPortal(
        <Drawer title={notice.title} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-navy">
            {legalFile.markdown ? (
              <Markdown source={legalFile.markdown} idPrefix={`legal-${notice.id}`} />
            ) : legalFile.loading ? (
              <p className="text-muted">Loading…</p>
            ) : (
              <>
                {notice.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                {notice.signature ? <p className="font-bold">{notice.signature}</p> : null}
              </>
            )}
            <div className="flex flex-wrap gap-4 border-t border-line pt-3">
              {items
                .filter((n) => n.id !== notice.id)
                .map((n) => (
                  <button key={n.id} type="button" onClick={() => setOpen(n.id)} className="font-bold underline">
                    {n.title}
                  </button>
                ))}
            </div>
          </div>
        </Drawer>,
            document.body,
          )
        : null}
    </footer>
  );
}

export function Sidebar({ user, pathname, features, tenant }: { user: SessionUser; pathname: string; features: FeatureFlags; tenant: TenantType }) {
  const groups = portalSidebar(user, features, tenant);
  const hash = useHash();
  const [collapsed, toggle] = useCollapsed();
  const areas = portalAreas(user, features, tenant);
  const hasGallery = areas.includes('gallery');
  const hasAdvisoryPanel = areas.includes('advisory-panel');
  return (
    <nav
      data-surface="navy"
      aria-label="Portal sections"
      className={cx('flex shrink-0 flex-col overflow-hidden bg-navy py-3 text-white motion-safe:transition-[width] motion-safe:duration-200', collapsed ? 'w-12' : 'w-64')}
    >
      {/* Sprint 11 Revision 2.1: ◀ at the open rail's top right hides it; ▶ on the slim strip's left edge brings it back. */}
      <div className={cx('flex pb-2', collapsed ? 'justify-start pl-1' : 'justify-end px-3')}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="portal-sidebar-links"
          aria-label={collapsed ? 'Show the sidebar' : 'Hide the sidebar'}
          title={collapsed ? 'Show the sidebar' : 'Hide the sidebar'}
          className="flex h-9 w-9 items-center justify-center rounded border-2 border-gold text-base leading-none hover:bg-white/10"
        >
          <span aria-hidden="true">{collapsed ? SIDEBAR_SHOW_GLYPH : SIDEBAR_HIDE_GLYPH}</span>
        </button>
      </div>
      <div id="portal-sidebar-links" hidden={collapsed} className="w-64">
        {/* Sprint 7C Extension: every member's Navigation Guide, pinned above the pillars. */}
        <ul aria-label="Navigation help" className="flex flex-col pb-2">
          <NavLink item="navigation-guide" current={isCurrent(pathname, 'navigation-guide')} tenant={tenant} />
          {/* Sprint 10 Revision 3.1: the Application Advisory Panel, a top-level workspace for panelists and Super Admins. */}
          {hasAdvisoryPanel ? (
            <li>
              <Link
                href={ADVISORY_PANEL_HREF}
                title="Roadmap, future releases, panel meeting dates and consultation feedback"
                aria-current={pathname === ADVISORY_PANEL_HREF ? 'page' : undefined}
                className={navLinkClass(pathname === ADVISORY_PANEL_HREF)}
              >
                {plainNavLabel(ADVISORY_PANEL_TITLE)}
              </Link>
            </li>
          ) : null}
        </ul>
        {hasGallery ? <GalleryNode pathname={pathname} hash={hash} tenant={tenant} /> : null}
        {groups.map((group) => {
          const headingId = `nav-group-${group.id}`;
          return (
            <div key={group.id} className="border-t border-t-gold pb-2 pt-1 first:border-t-0 first:pt-0">
              <h2 id={headingId} className="px-4 py-2 text-xs font-bold uppercase tracking-wide">
                {plainNavLabel(whiteLabel(group.label, tenant))}
              </h2>
              <ul aria-labelledby={headingId} className="flex flex-col">
                {group.entries.map(({ item }) => (
                  <NavLink key={item} item={item} current={isCurrent(pathname, item, hash)} tenant={tenant} />
                ))}
                {(EXTERNAL_NAV[group.id] ?? [])
                  .filter((link) => !link.visible || link.visible(user))
                  .map(({ href, label, hint }) => (
                    <ExternalNavLink key={href} href={href} label={whiteLabel(label, tenant)} hint={whiteLabel(hint, tenant)} />
                  ))}
              </ul>
            </div>
          );
        })}
      </div>
      <SidebarLegalFooter collapsed={collapsed} />
    </nav>
  );
}
