#!/usr/bin/env python3
"""Compiles the user manuals into their print-ready PDF editions (Sprint 7G), then the pilot kit (Phase 7I).

    py scripts/compile_all_manuals.py            docs/ADMIN_USER_GUIDE.md  -> docs/ADMIN_USER_GUIDE.pdf
                                                 docs/MEMBER_USER_GUIDE.md -> docs/MEMBER_USER_GUIDE.pdf
                                                 docs/TREASURER_MANUAL.md  -> docs/TREASURER_MANUAL.pdf
                                                 docs/FINANCIAL_SECRETARY_MANUAL.md -> docs/FINANCIAL_SECRETARY_MANUAL.pdf
                                                 docs/EXECUTIVE_GOVERNANCE_MANUAL.md -> docs/EXECUTIVE_GOVERNANCE_MANUAL.pdf
                                                 docs/QUICK_START_INTAKE_GUIDE.md -> docs/QUICK_START_INTAKE_GUIDE.pdf
    py scripts/compile_all_manuals.py --only treasurer   (or financial-secretary, executive)
    py scripts/compile_all_manuals.py --check    run each guide's wording check only; write nothing
    py scripts/compile_all_manuals.py --only member
    py scripts/compile_all_manuals.py --only admin --input custom.md --output custom.pdf --base docs
                                      --prepared-for "St. Mary's Cathedral Council 15295"
                                                 one council's custom copy (Sprint 7H; /api/council/compile-manual)
    py scripts/compile_all_manuals.py --only executive --input custom.md --output custom.pdf --base docs
                                      --disabled-modules feature_photo_gallery,feature_loaner_library
                                                 Sprint 11 Revision 8.0: a council copy marks the sections of each
                                                 switched-off premium module with a 'disabled' banner
    py scripts/compile_all_manuals.py --only pilot-kit
                                                 the Conference Room Pilot scripts and 11x17 posters only
                                                 (scripts/pilot_kit_pdf.py; a full run compiles them after the guides)

Sprint 9 Master Hardening Pass: the old master Administrator guide is split. The Administrator guide keeps system
maintenance only (settings, connections, the hub laptop, database resets, network ports, firewall clearance and the
SBOM); the officer workflows moved to three role manuals - Treasurer, Financial Secretary, and the Executive Governance
Manual shared by the Grand Knight and the Deputy Grand Knight. The four share one section numbering, and each officer
desk links its own PDF (packages/shared/src/role-manuals.ts).

Every guide goes through the same ReportLab layout as the Administrator guide (scripts/admin_guide_pdf.py): a title
page, the guide's own sections with clickable contents links and PDF bookmarks, its tables and screen captures, a
page footer and a closing disclaimer. The text is the Markdown text, word for word.

Each guide has its own title, its own closing disclaimer and its own wording check: the Administrator guide must name
the renamed screens ('Council Artifacts', 'Donations History', 'Credentials Vault'); both guides must avoid the retired
screen names and corporate jargon. A failed check prints each offending line and exits with status 2 before any PDF
is written. An image the guide names but the disk does not have is left out with a warning, as before.

Sprint 11 Revision 8.0: the generic guides in docs/ always describe every module. A council's custom copy names the
council's switched-off modules (--disabled-modules, the feature flag names of packages/shared/src/features.ts), and
every section whose heading matches one of them gets a '⚠️ This premium module is currently disabled' banner right
under its heading (disabled_module_banners). The text of the section itself is left as it is.
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import admin_guide_pdf as layout  # noqa: E402  (the shared ReportLab layout)
import pilot_kit_pdf  # noqa: E402  (Phase 7I: the pilot scripts and posters)

ROOT = Path(__file__).resolve().parent.parent

MEMBER_DISCLAIMER = (
    'Informational notice. This guide describes the Fraternal Council Archives™ for the Brother Knights who '
    'use it. It is provided for information only. It is not an official publication of the Knights of Columbus Supreme '
    "Council, and it does not replace the Charter, Constitution and Laws of the Order or the council's bylaws. Screens, "
    'roles and rules can change between releases. Where this guide and the portal differ, the portal and the governing '
    'documents of the Order prevail. Ask your Grand Knight or a council Admin when a screen does not match this guide.'
)


@dataclass(frozen=True)
class Manual:
    key: str
    source: str
    output: str
    title: str
    disclaimer: str
    required_screen_names: tuple[str, ...]


MANUALS = (
    Manual(
        key='admin',
        source='docs/ADMIN_USER_GUIDE.md',
        output='docs/ADMIN_USER_GUIDE.pdf',
        title='Administrator User Guide',
        disclaimer=layout.DISCLAIMER,
        # Sprint 9 Master Hardening Pass: 'Council Artifacts' moved to the Executive Governance Manual with chapter 8.
        required_screen_names=('Donations History', 'Credentials Vault'),
    ),
    Manual(
        key='member',
        source='docs/MEMBER_USER_GUIDE.md',
        output='docs/MEMBER_USER_GUIDE.pdf',
        title='Member User Guide',
        disclaimer=MEMBER_DISCLAIMER,
        required_screen_names=(),
    ),
    # Sprint 9 Master Hardening Pass: the three role manuals split out of the master Administrator guide.
    Manual(
        key='treasurer',
        source='docs/TREASURER_MANUAL.md',
        output='docs/TREASURER_MANUAL.pdf',
        title='Treasurer Manual',
        disclaimer=layout.DISCLAIMER,
        required_screen_names=(),
    ),
    Manual(
        key='financial-secretary',
        source='docs/FINANCIAL_SECRETARY_MANUAL.md',
        output='docs/FINANCIAL_SECRETARY_MANUAL.pdf',
        title='Financial Secretary Manual',
        disclaimer=layout.DISCLAIMER,
        required_screen_names=('Donations History',),
    ),
    Manual(
        key='executive',
        source='docs/EXECUTIVE_GOVERNANCE_MANUAL.md',
        output='docs/EXECUTIVE_GOVERNANCE_MANUAL.pdf',
        title='Executive Governance Manual',
        disclaimer=layout.DISCLAIMER,
        required_screen_names=layout.REQUIRED_SCREEN_NAMES,
    ),
    # Sprint 11 Revision 4.1: the short leaflet the Admin Desk Setup Wizard's last step hands out.
    Manual(
        key='quickstart',
        source='docs/QUICK_START_INTAKE_GUIDE.md',
        output='docs/QUICK_START_INTAKE_GUIDE.pdf',
        title='Quick-Start Intake Guide',
        disclaimer=layout.DISCLAIMER,
        required_screen_names=('Credentials Vault',),
    ),
)


# Sprint 11 Revision 8.0: each switchable module's name and the headings of its sections. The keys are the flag names
# of packages/shared/src/features.ts (FEATURE_FLAG_NAMES) and the names its FEATURE_FLAG_LABELS; a test keeps them equal.
MODULE_SECTIONS: dict[str, tuple[str, str]] = {
    'flag_mobile_elections': ('Officer elections', r'election|nomination|appointment|ballot'),
    'flag_fundraising_inflow': ('Fundraising inflow', r'\bdonations?\b(?! workflow)'),
    'flag_charity_proposals': ('Charity proposals', r'charity grant|charity request|propose a charity'),
    'flag_meeting_management': ('Meeting management', r'meeting|cadence|agenda'),
    'feature_expense_reporting': ('Expense reporting', r'expense'),
    'feature_faith_center': ('Faith Center', r'faith center|prayer|devotion'),
    'feature_constitutional_advisor': ('Constitutional Advisor', r'constitutional advisor'),
    'feature_council_bylaws': ('Council bylaws', r'bylaws'),
    'feature_council_history': ('Council History & Archive Vault', r'annals|diary|oral histor|in memoriam|team legacy|council history'),
    'feature_live_meeting_console': ('Live meeting console', r'live meeting|secret ballot|hand tall'),
    'feature_capital_assets': ('Capital asset tracking', r'\basset'),
    'feature_charity_registry': ('Global charity registry', r'verified charit|charities registry|global charit'),
    'feature_document_compilation': ('Document compilation pipelines', r'custom guide'),
    'feature_photo_gallery': ('Photo Gallery & Media Center', r'gallery|share photos|meeting photo|photo from the meeting'),
    'feature_lessons_registry': ('Lessons & Knowledge Registries', r'lessons registry|knowledge archive'),
    'feature_marketing_factory': ('Marketing Factory', r'marketing|flyer'),
    'feature_loaner_library': ('Cross-Council Loaner Library', r'loaner'),
    'feature_advanced_audits': ('Advanced Financial Audits', r'1295|semiannual audit|trustee audit'),
}

DISABLED_BANNER = '⚠️ This premium module is currently disabled'

HEADING = re.compile(r'^(#{2,4})\s+(.*\S)\s*$')


def parse_disabled_modules(value: str) -> list[str]:
    """The comma-separated flag names of --disabled-modules, each one a known module; an unknown name is an error."""
    names = [n.strip() for n in value.split(',') if n.strip()]
    unknown = [n for n in names if n not in MODULE_SECTIONS]
    if unknown:
        raise argparse.ArgumentTypeError(f'unknown module(s): {", ".join(unknown)}; the modules are {", ".join(MODULE_SECTIONS)}')
    return names


def disabled_module_banners(markdown: str, disabled: list[str]) -> str:
    """Puts the disabled banner under every heading (levels 2-4) that matches a switched-off module, once per module.

    With no module switched off the guide comes back unchanged, so a generic guide always shows everything.
    """
    if not disabled:
        return markdown
    rules = [(MODULE_SECTIONS[n][0], re.compile(MODULE_SECTIONS[n][1], re.IGNORECASE)) for n in disabled]
    out: list[str] = []
    in_code = False
    for line in markdown.split('\n'):
        out.append(line)
        if line.lstrip().startswith('```'):
            in_code = not in_code
        match = None if in_code else HEADING.match(line)
        if not match:
            continue
        labels = [label for label, rule in rules if rule.search(match.group(2))]
        if labels:
            out.append('')
            out.append(f'> {DISABLED_BANNER} for this council: **{", ".join(labels)}**. '
                       'A Super Admin can switch it on in the Master Feature Deployment Grid.')
    return '\n'.join(out)


def use(manual: Manual) -> None:
    """Points the shared layout at one manual: its title page, PDF metadata, wording check and disclaimer."""
    layout.DOCUMENT_TITLE = manual.title
    layout.SOURCE_LABEL = manual.source
    layout.DISCLAIMER = manual.disclaimer
    layout.REQUIRED_SCREEN_NAMES = manual.required_screen_names


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--check', action='store_true', help="run each guide's wording check only; write nothing")
    parser.add_argument('--only', choices=[m.key for m in MANUALS] + ['pilot-kit'], help='compile one guide, or the pilot kit, only')
    # Sprint 7H: one council's custom copy - the customized Markdown, where to write it, and the image folder.
    parser.add_argument('--input', type=Path, help="the guide's Markdown to compile instead of its source (needs --only)")
    parser.add_argument('--output', type=Path, help='where to write the PDF instead of docs/ (needs --only)')
    parser.add_argument('--base', type=Path, help="the folder the guide's image links are relative to (default: the input's folder)")
    parser.add_argument('--prepared-for', default='', help='the council named on the title page')
    parser.add_argument(
        '--disabled-modules',
        type=parse_disabled_modules,
        default=[],
        help="the council's switched-off modules, comma-separated feature flag names (a council copy only)",
    )
    args = parser.parse_args(argv)
    if args.disabled_modules and not args.input:
        parser.error('--disabled-modules marks a council copy, so it needs --input')
    if (args.input or args.output) and args.only in (None, 'pilot-kit'):
        parser.error('--input and --output need --only with one guide')
    if args.only == 'pilot-kit':
        if not args.check:
            pilot_kit_pdf.compile_pilot_kit()
        return
    chosen = [m for m in MANUALS if args.only in (None, m.key)]
    source_of = lambda m: args.input or (ROOT / m.source)  # noqa: E731
    layout.PREPARED_FOR = args.prepared_for.strip()

    failed = False
    for manual in chosen:
        use(manual)
        problems = layout.check_nomenclature(source_of(manual).read_text(encoding='utf-8'))
        if problems:
            failed = True
            print(f'{manual.source}: the wording check failed:', file=sys.stderr)
            for problem in problems:
                print(f'  {problem}', file=sys.stderr)
    if failed:
        sys.exit(2)
    if args.check:
        print('wording check passed: ' + ', '.join(m.source for m in chosen))
        return

    for manual in chosen:
        use(manual)
        source = source_of(manual)
        if not args.disabled_modules:
            layout.compile_guide(source, args.output or (ROOT / manual.output), args.base)
            continue
        # Sprint 11 Revision 8.0: the council copy with its disabled banners, laid out from a temporary file; the images
        # are still read from the copy's own folder (or --base).
        marked = disabled_module_banners(source.read_text(encoding='utf-8'), args.disabled_modules)
        with tempfile.TemporaryDirectory() as work:
            copy = Path(work) / source.name
            copy.write_text(marked, encoding='utf-8')
            layout.compile_guide(copy, args.output or (ROOT / manual.output), args.base or source.parent)
    # Phase 7I: a full run also compiles the pilot kit into docs/ (a custom copy, --only, does not).
    if args.only is None:
        pilot_kit_pdf.compile_pilot_kit()


if __name__ == '__main__':
    main()
