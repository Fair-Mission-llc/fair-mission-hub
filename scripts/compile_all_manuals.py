#!/usr/bin/env python3
"""Compiles both user manuals into their print-ready PDF editions (Sprint 7G).

    py scripts/compile_all_manuals.py            docs/ADMIN_USER_GUIDE.md  -> docs/ADMIN_USER_GUIDE.pdf
                                                 docs/MEMBER_USER_GUIDE.md -> docs/MEMBER_USER_GUIDE.pdf
    py scripts/compile_all_manuals.py --check    run each guide's wording check only; write nothing
    py scripts/compile_all_manuals.py --only member

Both guides go through the same ReportLab layout as the Administrator guide (scripts/admin_guide_pdf.py): a title
page, the guide's own sections with clickable contents links and PDF bookmarks, its tables and screen captures, a
page footer and a closing disclaimer. The text is the Markdown text, word for word.

Each guide has its own title, its own closing disclaimer and its own wording check: the Administrator guide must name
the renamed screens ('Council Artifacts', 'Donations History', 'Credentials Vault'); both guides must avoid the retired
screen names and corporate jargon. A failed check prints each offending line and exits with status 2 before any PDF
is written. An image the guide names but the disk does not have is left out with a warning, as before.
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import admin_guide_pdf as layout  # noqa: E402  (the shared ReportLab layout)

ROOT = Path(__file__).resolve().parent.parent

MEMBER_DISCLAIMER = (
    'Informational notice. This guide describes the Knights of Columbus Tracking Platform for the Brother Knights who '
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
        required_screen_names=layout.REQUIRED_SCREEN_NAMES,
    ),
    Manual(
        key='member',
        source='docs/MEMBER_USER_GUIDE.md',
        output='docs/MEMBER_USER_GUIDE.pdf',
        title='Member User Guide',
        disclaimer=MEMBER_DISCLAIMER,
        required_screen_names=(),
    ),
)


def use(manual: Manual) -> None:
    """Points the shared layout at one manual: its title page, PDF metadata, wording check and disclaimer."""
    layout.DOCUMENT_TITLE = manual.title
    layout.SOURCE_LABEL = manual.source
    layout.DISCLAIMER = manual.disclaimer
    layout.REQUIRED_SCREEN_NAMES = manual.required_screen_names


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--check', action='store_true', help="run each guide's wording check only; write nothing")
    parser.add_argument('--only', choices=[m.key for m in MANUALS], help='compile one guide only')
    args = parser.parse_args(argv)
    chosen = [m for m in MANUALS if args.only in (None, m.key)]

    failed = False
    for manual in chosen:
        use(manual)
        problems = layout.check_nomenclature((ROOT / manual.source).read_text(encoding='utf-8'))
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
        layout.compile_guide(ROOT / manual.source, ROOT / manual.output)


if __name__ == '__main__':
    main()
