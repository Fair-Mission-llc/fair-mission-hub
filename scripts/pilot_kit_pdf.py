#!/usr/bin/env python3
"""Compiles the Conference Room Pilot kit (Phase 7I): two fillable scripts and three 11x17 wall posters.

Sprint 8M Extension: no individual step waits for another persona (the Treasurer pays the pre-released report 16), the
members take Venmo and cash at a $25.00 rate. Sprint 10 Revision 3.2 removed the parish split engine and its console:
the Treasurer's chapter 2 now shares the parking event's Venmo gift with the parish through the batch coder's Event
Split Override, the chart-of-accounts split that replaced it.

Sprint 8S Revision 8: the kit is one session anchored on a 6:15 PM gavel - Introduction (6:15-6:20), the Individual
Desk Coordinate Phase (6:20-6:40, the individual scripts), the Synchronized Group Workflow (6:40-7:20, the group
script), Open Exploration (7:20-7:40) and the Listening Session (7:40-8:00). Every web step starts from the Active Desks
row and the folders on each desk's filing spine (Sprints 8P and 8S Revision 7). Member Beta's pages print in large type
(Persona.large_print).

Sprint 8S Revision 9: in the individual phase Member Alpha and Member Beta work on their phones - the parking lot
collection on the Collect tab (set up by hand, nothing pre-selected), activity hours on the Report tab's tap grid and a
new expense report from Home > My expense reports. The officers' individual scripts and every group flow stay web-only
on the laptops.

Sprint 8S Revision 10: every persona stays in his own seat on his own laptop for the whole session - nobody walks to
another laptop, signs out or hands over a keyboard. Each laptop holds its own copy of the pilot data, so the group phase
is three seated flows on pre-seeded records: Flow 1 the expense pipeline gate by gate (FS signs 21, the Treasurer codes
22, the GK releases 23, the Treasurer pays 13), Flow 2 the charity request (Alpha proposes; the DGK claims, questions and
advances request 6) and Flow 3 the Flagged Hours Review gate (the DGK rejects Alpha's seeded 6.5-hour entry). The old
Flow 6 is gone. The phone's AMOUNT box opens filled with the session's $25.00 standard rate.

Sprint 8S Revision 10.2: the two phone tracks no longer overlap. Member Alpha alone sets up the Parish Parking Event
session, records the gate gifts and the cash box drop and concludes the session. Member Beta starts no session and
concludes nothing: he records one standalone gift (a $50.00 cash gift handed to him after Mass, type Unsolicited) from
the Collect tab's payment tiles, which the phone saves with no event.

Sprint 9 Revision 4.0: the pilot runs on the hub laptop. Every laptop and phone works on one database on that laptop's
disk (packages/backend/data/central-hub-vault.db), so a record saved on one device is on every device at once, and the
vault keeps every record, meeting log and check photo from one session to the next. The facilitator starts each
scripted rehearsal on a fresh vault (npm run hub:archive moves the last one into an archive folder; nothing is
deleted). The Collect tab's deposit photo is on the Check form only.

Sprint 9 Revision 5.0: GPS check-in is hidden (the phone checks in with the meeting PIN only). Members report their
own volunteer hours after the event; nobody checks them in on site.

    py scripts/pilot_kit_pdf.py                 writes all five PDFs under docs/
    py scripts/compile_all_manuals.py           compiles the two user guides, then this kit
    py scripts/compile_all_manuals.py --only pilot-kit

    docs/INDIVIDUAL_PILOT_SCRIPTS.pdf   one section per pilot persona: a Day in the Life panel, then numbered steps,
                                        each with where to go, what to do, the expected result, a check box and a
                                        fillable Notes field; the Attendee Feedback Questionnaire is the appendix
    docs/GROUP_CROSS_DESK_SCRIPT.pdf    the flows that pass work from desk to desk, in the same step layout, with
                                        the same questionnaire
    docs/POSTER_FINANCIAL_WORKFLOW.pdf  11x17: the expense pipeline and the money coming in
    docs/POSTER_CHARITY_LIFECYCLE.pdf   11x17: a charity grant from proposal to follow-up
    docs/POSTER_PERMISSIONS_MATRIX.pdf  11x17: which persona may do what

The scripts walk through the pilot data in Seed.sql (the seven @stmarys.org personas, the Parish Parking Event,
expense reports 13-23, charity requests 6-7, the first parking weekend's $400.00 (with its un-coded $150.00 Venmo gift)
and the two held time entries). Screen and button names are the web portal's and the phone app's own.
The PDFs are written to disk only; nothing is sent to a printer.
"""
from __future__ import annotations

import argparse
import datetime as dt
from dataclasses import dataclass, field
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import LETTER, TABLOID
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs'

NAVY = colors.HexColor('#002855')
GOLD = colors.HexColor('#D6A420')
RED = colors.HexColor('#B3261E')
LINE = colors.HexColor('#C9D1DC')
MUTED = colors.HexColor('#4A5568')
PANEL = colors.HexColor('#F3F5F8')
WHITE = colors.white

COUNCIL = "St. Mary's Cathedral Council 15295"
PILOT_EVENT = 'Parish Parking Event'

# ---------------------------------------------------------------- content ----


@dataclass(frozen=True)
class Step:
    where: str
    action: str
    expected: str
    who: str = ''  # group flows only: the persona who does the step, on his own laptop


@dataclass(frozen=True)
class Persona:
    key: str
    title: str
    email: str
    seat: str
    device: str
    day_in_life: str
    steps: tuple[Step, ...]
    # Sprint 8L: a reader with fading eyesight; his pages use the large-print styles (larger type and padding).
    large_print: bool = False
    # Sprint 8M Extension: a second chapter after the numbered steps (the Treasurer's revenue split chapter).
    # Its steps keep counting on from the first chapter's.
    chapter_title: str = ''
    chapter_intro: str = ''
    chapter_steps: tuple[Step, ...] = ()
    # Sprint 8S Revision 7: a Graphical Ledger Flow Diagram drawn before the chapter's steps - (stage, detail) boxes left
    # to right - and training notes printed under it.
    chapter_diagram: tuple[tuple[str, str], ...] = ()
    chapter_notes: tuple[str, ...] = ()


@dataclass(frozen=True)
class Flow:
    key: str
    title: str
    context: str
    steps: tuple[Step, ...]
    minutes: int = 10
    # what happens next, outside the session (printed under the flow's last step)
    after: str = ''


SIGN_IN_WEB = 'Web portal sign-in page'
# Sprint 8S Revision 9: the members' individual scripts run on the phone app.
SIGN_IN_PHONE = 'Phone app sign-in screen'
# Sprint 8S Revision 8: the web home of a member's hour reports (the Volunteer Check-In & Service Center).
HOUR_LEDGER = 'Member Actions Hub > Hour ledger tab'
# Sprint 8L: every web step starts from the Active Desks row (the folder tabs over every portal page). Sprint 8P: each
# module is a drawer on its desk (Sprint 8S Revision 7: a folder on the left filing spine, opened on the Desk Blotter); the Oversight Desk is gone (its Flagged Hours Review is a Grand Knight Desk drawer).
DESKS = 'Active Desks'

PERSONAS: tuple[Persona, ...] = (
    Persona(
        key='gk',
        title='Grand Knight',
        email='gk_user@stmarys.org',
        seat='Grand Knight (GK User)',
        device='Laptop (web portal)',
        day_in_life=(
            'It is the week after the first weekend of the Parish Parking Event. The Grand Knight gives the final release '
            'on expense reports before the council pays them, keeps watch over the charity requests in vetting, and checks '
            'a point of order before the October meeting. Everything he needs is a drawer on the Grand Knight '
            'Desk; he never leaves the Active Desks row.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as gk_user@stmarys.org with the pilot password on the facilitator\'s board.',
                 'The Active Desks row opens on Home. Its tabs include Grand Knight Desk.'),
            Step(f'{DESKS} > Grand Knight Desk > Approved Expenses', 'Click the Approved Expenses folder at the top of the left filing spine (it has a red border) and read the sheets on the Desk Blotter.',
                 'Reports 19 (Historian User, Aaron Brothers, $89.99) and 23 (Member Alpha, Fred Meyer, $41.85) carry the payment request and the Treasurer\'s coding.'),
            Step(f'{DESKS} > Grand Knight Desk > Approved Expenses', 'Click Final Release for Payment on report 19, then click [ 🔀 Back to Desk Blotter ].',
                 'The row reads "Released to the Treasurer". Report 19 is Approved and waits for the Treasurer\'s check.'),
            Step(f'{DESKS} > Grand Knight Desk > Charitable Grant Requests Vetting Board', 'Click the folder on the left filing spine and read the Triage queue on the Desk Blotter.',
                 'Seven requests: four Submitted (including Northeast Portland Senior Meals and Cathedral Coat Closet), two Claimed by Trustee and one Advanced. Fold it away again.'),
            Step(f'{DESKS} > Grand Knight Desk > Constitutional Advisor Panels', 'Open the drawer, type "How much notice does a motion need?" and click Ask.',
                 'The answer names its Source Authority. Click [ 🔀 Back to Desk Blotter ].'),
            Step(f'{DESKS} > Grand Knight Desk > Connected Councils', 'Open the drawer and read the nearby councils.',
                 'St. Anthony Council is an active affiliate; Holy Redeemer\'s invite waits for your answer under Affiliation Invites.'),
            Step(f'{DESKS} > Home', 'Read the 📿 Community Prayer Request List card and click [ 🙏 Praying Hands ] on Member Beta\'s intention.',
                 'The card lists five open intentions. The count on Beta\'s intention goes up by one and the button greys out for today.'),
        ),
    ),
    Persona(
        key='fs',
        title='Financial Secretary',
        email='fs_user@stmarys.org',
        seat='Financial Secretary (FS User)',
        device='Laptop (web portal)',
        day_in_life=(
            'Monday evening after the parking weekend. New expense reports came in with the cones and the cash box, and '
            'two older September sheets are still waiting. The Financial Secretary checks each receipt and issues the '
            'payment request, the first of the three signatures. He also keeps the Trustees\' audit and the charity checkbook '
            'ready, each on his desk.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as fs_user@stmarys.org with the pilot password.', 'The Active Desks row shows the Financial Secretary Desk tab.'),
            Step(f'{DESKS} > Financial Secretary Desk > Auditing & Return Queue', 'Click the Auditing & Return Queue folder at the top of the left filing spine (it has a red border) and read the sheets on the Desk Blotter.',
                 'Reports 11 (Anthony Russo, Safeway, $86.40), 14 (Member Alpha, Home Depot, $84.97), 15 (Member Beta, Office Depot, $32.48), 20 (Member Alpha, Costco, $27.60) and 21 (Member Beta, Staples, $54.15) wait for the payment request.'),
            Step(f'{DESKS} > Financial Secretary Desk > Auditing & Return Queue', 'Click Verify & Sign Expense on report 14, then on report 20.',
                 'Each row reads "Payment request issued" and moves to the Treasurer Desk.'),
            Step(f'{DESKS} > Financial Secretary Desk > Auditing & Return Queue', 'Find report 15 and open its details. Type "Please add the receipt photo" in Reason for returning (required), then click Return to member. Click [ 🔀 Back to Desk Blotter ].',
                 'Report 15 goes back to Member Beta as a Draft with your reason. Its signatures are cleared.'),
            Step(f'{DESKS} > Financial Secretary Desk > Financial Inspections', 'Open the drawer and choose the July-December 2026 period.',
                 'The Financial Inspections opens in the drawer with its five steps; step 5 offers the Form 1295 report as a DRAFT until the Trustees sign.'),
            Step(f'{DESKS} > Financial Secretary Desk > Charity Check Issuance Console', 'Open the drawer and read Approved requests awaiting payment.',
                 'The panel is empty until the council votes a grant at its Monthly meeting.'),
        ),
    ),
    Persona(
        key='treasurer',
        title='Treasurer',
        email='treasurer_user@stmarys.org',
        seat='Treasurer (Treasurer User)',
        device='Laptop (web portal)',
        day_in_life=(
            'The Treasurer keeps the council\'s books honest. Every report that carries the payment request comes to him '
            'to be charged to a line of the approved 2026-2027 budget and to a general ledger account. Before he codes '
            'anything he reviews the budget sheet line by line, so he knows which lines still have room. He writes the '
            'checks for released reports, and he codes the electronic gifts, sharing the parish\'s part of a fundraiser. Nothing on his script '
            'waits for another officer.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as treasurer_user@stmarys.org with the pilot password.', 'The Active Desks row shows the Treasurer Desk tab.'),
            Step(f'{DESKS} > Treasurer Desk > Annual Budget vs Actuals Ledger Grid', 'Open the drawer. Read Budgeted vs. Current Actual Spend for each concluded event and meeting.',
                 'Each row shows its budgeted amount, the actual spend and the variance for fraternal year 2026-2027.'),
            Step(f'{DESKS} > Treasurer Desk > Annual Budget vs Actuals Ledger Grid', 'In the 📊 Budget Allocation & YOY Variance Analyzer, find Miscellaneous Others and Monthly Council Meetings. Write the room left on each line in Notes.',
                 'The analyzer lists each approved line against 2025-2026, with the total against the spending ceiling. Click [ 🔀 Back to Desk Blotter ].'),
            Step(f'{DESKS} > Treasurer Desk > [ 🔧 Accounting Configuration ] › Chart of Accounts & GL Setup', 'Before you code anything, click the Chart of Accounts & GL Setup folder under [ 🔧 Accounting Configuration ] on the left filing spine. Review the seeded accounts on the Desk Blotter, and check the Assets grid line by line.',
                 'The Assets grid shows your asset lines live: Operating Checking with Goal Account #1 and Goal Account #2 indented under it (each marked Virtual goal), General Savings, Charity Savings and Physical Assets. The Expenses grid lists Charitable Disbursements, Event Operational Costs, Council Operational Costs and Supreme Assessments. Click [ 🔀 Back to Desk Blotter ].'),
            Step(f'{DESKS} > Treasurer Desk > Ledger Line Coder', 'Click the Ledger Line Coder folder at the top of the left filing spine (it has a red border) and read the sheets on the Desk Blotter.',
                 'Reports 12 (Joseph Hernandez, Office Depot and FedEx Office, $88.49), 17 (Member Alpha, FedEx Office, $118.50), 18 (Member Beta, Safeway, $54.75) and 22 (Historian User, Walgreens, $63.40) carry a payment request. Report 14 shows here only after the Financial Secretary signs it in his own script. Code only the reports that the next steps name.'),
            Step(f'{DESKS} > Treasurer Desk > Ledger Line Coder', 'On report 17 choose Event Operational Costs in Assign General Ledger Account. There is no budget line to pick: read the green line under the account, then click Categorize & Lock Expense. Code report 18 to Council Operational Costs the same way.',
                 'Report 17 reads [ Inferred Budget: Automatically Mapped to Miscellaneous Others ] and report 18 reads [ Inferred Budget: Automatically Mapped to Monthly Council Meetings ]. Both rows read "Coded to the ledger" and move to the Grand Knight Desk.'),
            Step(f'{DESKS} > Treasurer Desk > Bank Statement Match-Window', 'Open the drawer and choose any bank statement CSV the facilitator gives you. Click Run electronic audit.',
                 'The window reports how many statement rows matched the ledger and lists the unmatched ones.'),
            Step(f'{DESKS} > Treasurer Desk > Expense Report (ER) Settlement', 'Report 16 (Historian User, Michaels, $46.20) is already in the queue: the Grand Knight released it on October 8. Select it, type check number 1201 and click Record Payment Made by Check.',
                 'Report 16 is Reimbursed and check 1201 appears in the payments-made history. You did not wait for anyone.'),
        ),
        chapter_title='Chapter 2 - Sharing Fundraiser Revenue with the Parish',
        chapter_intro=(
            'The parking lot belongs to the cathedral, so the parish receives half of what the Parish Parking Event '
            'collects. There is no parish split switch any more: the split comes from the chart of accounts. You code the '
            'event\'s $150.00 Venmo gift once, with an Event Split Override that sends half to the Parking Fundraising line '
            'and half to the Parish Fundraiser Share line.'
        ),
        chapter_diagram=(
            ('Un-coded Venmo gift', 'The Parish Parking Event\'s Venmo gift waits in the batch coder: $150.00.'),
            ('Revenue GL line', 'You code it to Parking Fundraising, the line the money belongs to.'),
            ('Event Split Override', 'For this one posting: 50% Parking Fundraising, 50% Parish Fundraiser Share.'),
            ('One posting', 'The ledger gets $75.00 on each line. Nothing is typed twice.'),
        ),
        chapter_notes=(
            'The engine keeps the budget for you. You code each expense sheet once: you choose its general ledger account, and '
            'the account decides the budget line (the green Inferred Budget line). The Annual Budget vs Actuals Ledger Grid and the YOY analyzer work out every actual from that coding. '
            'You never copy an amount into a budget sheet by hand, so the same money is never entered twice.',
            'Every revenue split comes from the chart of accounts: a Revenue account\'s saved split profile, or a one-time '
            'Event Split Override in the batch coder. You choose the shares; the coder works out the amounts.',
        ),
        chapter_steps=(
            Step(f'{DESKS} > Treasurer Desk > High-Volume Batch Transaction Coder', 'Open the drawer. Tick the Parish Parking Event\'s Venmo gift ($150.00) only.',
                 'The row reads Venmo, Parish Parking Event, $150.00. The button reads Code selected to this Revenue line (1 · $150.00).'),
            Step(f'{DESKS} > Treasurer Desk > High-Volume Batch Transaction Coder', 'Choose Parking Fundraising in Revenue GL line for the selection, then click ⚖️ Override Event Split. Set Destination 1 to Parking Fundraising at 50, click Add destination and set Destination 2 to Parish Fundraiser Share at 50.',
                 'The ⚖️ Override Event Split: Parish Parking Event box shows the two destinations, 50% each, for this one posting of $150.00.'),
            Step(f'{DESKS} > Treasurer Desk > High-Volume Batch Transaction Coder', 'Click Code selected to this Revenue line (1 · $150.00).',
                 'A message reads "Coded 1 donation ($150.00) to Parking Fundraising as one posting. Event Split Override: $75.00 to Parking Fundraising, $75.00 to Parish Fundraiser Share." The gift leaves the un-coded list.'),
        ),
    ),
    Persona(
        key='dgk',
        title='Deputy Grand Knight',
        email='dgk_user@stmarys.org',
        seat='Deputy Grand Knight (DGK User)',
        device='Laptop (web portal)',
        day_in_life=(
            'The Deputy Grand Knight holds every grant of the Grand Knight\'s seat and looks after the council\'s '
            'service-hour record. Two entries were held for leadership review because they crossed the council\'s limits. '
            'He talks with each brother before he decides, because a cleared entry counts toward every total and a '
            'rejected one never does. He decides Beta\'s entry now and Alpha\'s in group Flow 3.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as dgk_user@stmarys.org with the pilot password.', 'The Active Desks row shows the Grand Knight Desk.'),
            Step(f'{DESKS} > Grand Knight Desk > Flagged Hours Review', 'Click the Flagged Hours Review folder at the top of the left filing spine (it has a red border) and read both entries on the Desk Blotter.',
                 'Member Alpha: 6.5 hours on Parish Parking Event - Lot attendants - Saturday, note "Stayed to restripe the overflow lot". Member Beta: 6 hours of Ushering, note "Ushered all three Sunday Masses".'),
            Step(f'{DESKS} > Grand Knight Desk > Flagged Hours Review', 'On Member Beta\'s entry click Approve & Add to Time Log.',
                 'The entry leaves the desk. Beta\'s 6 hours now count in the Council Dashboard and on the Executive Dashboard.'),
            Step(f'{DESKS} > Grand Knight Desk > Flagged Hours Review', 'Read Member Alpha\'s entry again. Do not decide it now.',
                 'It stays on the desk. You decide it in group Flow 3.'),
            Step(f'{DESKS} > Grand Knight Desk > Charitable Grant Requests Vetting Board', 'Open the drawer and read the pooled requests. Do not claim one in this phase.',
                 'The Deputy Grand Knight sees the same board as the Grand Knight and may claim requests.'),
        ),
    ),
    Persona(
        key='historian',
        title='Council Historian',
        email='historian_user@stmarys.org',
        seat='Council Historian (Historian User)',
        device='Laptop (web portal)',
        day_in_life=(
            'The Council Historian is appointed by the Grand Knight to keep the council\'s annals. He files the parking '
            'weekend\'s photos into the Drive media vault and writes the month\'s bulletin.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as historian_user@stmarys.org with the pilot password.', 'The Active Desks row shows the Historian Desk tab.'),
            Step(f'{DESKS} > Historian Desk > Google Drive Media Gallery Sync Board', 'Open the drawer. Under Upload Photos choose Past event and the Parish Parking Event, add one photo and upload it.',
                 'The photo appears in the gallery mosaic under the Parish Parking Event.'),
            Step(f'{DESKS} > Historian Desk > Google Drive Media Gallery Sync Board', 'Under Find photos pick the Parish Parking Event, then save the selection as a Smart Album named "Parking 2026".',
                 'Parking 2026 is listed under Smart Albums, highlighted as the active filter, and the gold "Album: Parking 2026" tag shows over the photos. Click [ 🔀 Back to Desk Blotter ].'),
            Step(f'{DESKS} > Historian Desk > Monthly Newsletters', 'In the Monthly Newsletters drawer, write two sentences about the first parking weekend as this month\'s bulletin and save it.',
                 'The bulletin is saved for October 2026.'),
        ),
    ),
    Persona(
        key='alpha',
        title='Member Alpha',
        email='member_alpha@stmarys.org',
        seat='Member (Member Alpha)',
        device='Phone app',
        day_in_life=(
            'Member Alpha volunteers as a lot attendant on the parking weekends. Before the first car arrives he opens the '
            'gate: he sets the event, the donation type and the $25.00 standard rate on his phone. He is the only one '
            'who runs the gate session. After that the AMOUNT box fills in with $25.00. '
            'Cars pay the parking rate by Venmo or in cash, and at the end of the shift he records the cash box as '
            'one consolidated drop and concludes the session, which locks the logs so the Treasurer can count the cash box '
            'against them. Then he logs his planning time and files the receipt for the chalk he bought, all on his phone.'
        ),
        steps=(
            Step(SIGN_IN_PHONE, 'Sign in as member_alpha@stmarys.org with the pilot password.', 'The tab bar shows Home, Mtgs, Signup, Report and Collect.'),
            Step('Phone > Collect tab > Start collecting for event', f'This card is your on-device configuration drawer. Nothing is pre-selected. Choose the {PILOT_EVENT} in EVENT and Parking in DONATION TYPE yourself, type 25.00 in STANDARD RATE (OPTIONAL), and tap Start.',
                 'The ACCEPTING DONATIONS card shows the event and "Session setup: $25.00 · Parking".'),
            Step('Phone > Collect tab', 'Under How is the donor giving? tap the Venmo tile yourself. Let the "donor" scan the full-screen code, then close it. The AMOUNT box already shows 25.00 from your setup. Do not type. Tap Record donation.',
                 f'A message reads "Recorded $25.00 by Venmo for {PILOT_EVENT}". You typed nothing for this gift.'),
            Step('Phone > Collect tab', 'The cash box drop. Count the cash box (use $180.00 for the pilot). Tap the Cash tile, type 180.00 in AMOUNT, type "Cash box drop - Saturday lot" in DESCRIPTION, and tap Record donation.',
                 'One consolidated $180.00 cash donation is recorded for the event. The ACCEPTING DONATIONS card is still open.'),
            Step('Phone > Collect tab > [ 🛑 Conclude Event Session & Lock Logs ]', 'Close the gate. On the ACCEPTING DONATIONS card tap [ 🛑 Conclude Event Session & Lock Logs ]. Read the warning, then put your thumb on the gold circle and drag the Slide to Conclude & Lock bar to the right.',
                 f'A message reads "{PILOT_EVENT} is concluded and its logs are locked. The Treasurer can now count the cash box." The phone leaves the intake session and nobody can add or change a donation for the event.'),
            Step('Phone > Report tab', 'Under Tap an activity: 15 minutes per tap, tap the Planning tile four times (one hour). Drag the Slide to Log Hours bar at the bottom.',
                 'Each tap shows "Queued +15 min · Planning". After the slide a message reads "Logged 1 h for today."'),
            Step('Phone > Home > My expense reports', f'Tap New expense report. Under SPENT FOR choose Events and the {PILOT_EVENT}. Tap Scan Paper Receipt and photograph the receipt. Type Dollar Tree in VENDOR NAME, tap Today, type 12.00 in AMOUNT and "Chalk for lot lane markings" in DESCRIPTION. Tap Submit for approval.',
                 'The report is Submitted. It waits on the Financial Secretary Desk for the payment request.'),
        ),
    ),
    Persona(
        key='beta',
        title='Member Beta',
        email='member_beta@stmarys.org',
        seat='Member (Member Beta)',
        device='Phone app (large text layout), then laptop',
        large_print=True,
        day_in_life=(
            'Member Beta is a senior brother whose eyesight is fading. His profile opens the phone in the large text '
            'layout, and this handout is printed in large type. He works the parking shifts, ushers at Mass, and keeps an '
            'eye on his own expense reports. Member Alpha runs the gate, so Beta never opens or closes a parking session. '
            'After the 10:30 Mass a parishioner hands him $50.00 in cash for the council, and he records it on the spot '
            'as a standalone gift: no event, no session, straight from the Collect tab.'
        ),
        steps=(
            Step(SIGN_IN_PHONE, 'Sign in as member_beta@stmarys.org with the pilot password.', 'The phone opens in the large text layout: big type and big buttons.'),
            Step('Phone > Collect tab', 'Do not tap Start collecting for event. This gift belongs to no event. Under How is the donor giving? tap the Cash tile.',
                 'The Cash donation card opens. The AMOUNT box is empty because no session is running.'),
            Step('Phone > Collect tab > Cash donation', 'Type 50.00 in AMOUNT. Choose Unsolicited in DONATION TYPE. Type "Rita Kowalski" in DONOR NAME (OPTIONAL) and "Gift handed to me after the 10:30 Mass" in DESCRIPTION (OPTIONAL). Tap Record donation.',
                 'A message reads "Recorded $50.00 by Cash as a standalone donation. Thank the donor!" The card above still offers Start collecting for event; you started no session.'),
            Step('Phone > Report tab', 'Under Tap an activity: 15 minutes per tap, tap the Ushering tile eight times (two hours). Drag the Slide to Log Hours bar at the bottom.',
                 'A message reads "Logged 2 h for today."'),
            Step('Phone > Home > My expense reports', f'Tap New expense report. Under SPENT FOR choose Events and the {PILOT_EVENT}. Tap Scan Paper Receipt and photograph the receipt. Type Walgreens in VENDOR NAME, tap Today, type 6.49 in AMOUNT and "Batteries for the lot flashlights" in DESCRIPTION. Tap Submit for approval.',
                 'The report is Submitted. Report 15 (Office Depot, $32.48) is listed too, still waiting for the Financial Secretary.'),
            Step('Web > Active Desks > Home', 'Sign in on the laptop. Find your own intention on the 📿 Community Prayer Request List card.',
                 'Your intention for your eyes is on the card with the number of brothers praying for it.'),
        ),
    ),
)

GROUP_FLOWS: tuple[Flow, ...] = (
    Flow(
        key='expense',
        title='Flow 1 - The expense report pipeline, gate by gate',
        minutes=16,
        context=(
            'The council pays nothing until three different officers have signed, and then the Treasurer writes the check. '
            'Every persona stays in his own seat on his own laptop. Every laptop works on the one hub database, so a record '
            'saved on one laptop is on every laptop at once. The room walks the pipeline gate by gate: Member Alpha files a '
            'new report, and each officer works the seeded report already waiting at his own gate. Read in order, the five '
            'steps are one report\'s path from receipt to check.'
        ),
        steps=(
            Step(f'{DESKS} > Member Desk > Open my expenses', 'Click New expense report. Under Spent for choose Events and the Parish Parking Event. Add a line dated today: Ace Hardware, $18.40, "Zip ties and sign stakes". Click + Add receipt, attach a photo and click Submit for approval.',
                 'The report is Submitted and waits for the Financial Secretary\'s payment request. Write its number in the Notes field.', who='Member Alpha'),
            Step(f'{DESKS} > Financial Secretary Desk > Auditing & Return Queue', 'Gate 1, the payment request. Find report 21 (Member Beta, Staples, $54.15), check its receipt and click Verify & Sign Expense.',
                 'The row reads "Payment request issued" and leaves your desk for the Treasurer\'s coding.', who='FS User'),
            Step(f'{DESKS} > Treasurer Desk > Ledger Line Coder', 'Gate 2, the ledger coding. On report 22 (Historian User, Walgreens, $63.40) choose Council Operational Costs in Assign General Ledger Account, read the green [ Inferred Budget: Automatically Mapped to Monthly Council Meetings ] line, then click Categorize & Lock Expense.',
                 'The row reads "Coded to the ledger" and leaves your desk for the Grand Knight\'s release.', who='Treasurer User'),
            Step(f'{DESKS} > Grand Knight Desk > Approved Expenses', 'Gate 3, the final release. Click Final Release for Payment on report 23 (Member Alpha, Fred Meyer, $41.85).',
                 'The row reads "Released to the Treasurer". Report 23 is Approved.', who='GK User'),
            Step(f'{DESKS} > Treasurer Desk > Expense Report (ER) Settlement', 'Gate 4, the check. Select report 13 (George Alvarez, Cash & Carry, $142.75), released in September. Type check number 1401 and click Record Payment Made by Check.',
                 'Report 13 is Reimbursed and check 1401 appears in the payments-made history.', who='Treasurer User'),
        ),
    ),
    Flow(
        key='charity',
        title='Flow 2 - The charitable donation request workflow',
        minutes=14,
        context=(
            'A food bank near the cathedral asked Member Alpha for help. He becomes its Knight Shepherd and files the '
            'request into the pooled vetting queue. A vetting officer, never the Shepherd, then claims a request, asks the '
            'Shepherd for what is missing and advances it to the council\'s vote. On his own laptop the Deputy Grand Knight '
            'vets the seeded Northeast Portland Senior Meals request, whose Shepherd is Member Beta.'
        ),
        steps=(
            Step(f'{DESKS} > Member Desk > Propose or follow a charity grant', 'Fill in the form: Organization or ministry name "Cathedral Neighbors Food Bank", a one-line Mission, a Mailing address, Relationship to the council "Local Nonprofit", Mission area "Community", Amount requested $350, Specific use "Groceries for 30 families". Click Save and submit for vetting.',
                 'The request appears in your requests at the Vetting step. A vetter\'s questions reach you here, under Request More Info.', who='Member Alpha'),
            Step(f'{DESKS} > Grand Knight Desk > Charitable Grant Requests Vetting Board', 'Open the drawer, find Northeast Portland Senior Meals ($400.00, Shepherd Member Beta) in the Triage queue and click Claim & Audit.',
                 'The request is Claimed by Trustee with DGK User as its vetter. Claiming is the assignment handshake: the board and the Shepherd\'s tracker both show who vets it.', who='DGK User'),
            Step(f'{DESKS} > Grand Knight Desk > Charitable Grant Requests Vetting Board', 'In the vetting drawer choose Request More Info and ask: "How many of the forty seniors live in our parish?"',
                 'A private thread opens between you and the Knight Shepherd. Only the two of you see it.', who='DGK User'),
            Step(f'{DESKS} > Grand Knight Desk > Charitable Grant Requests Vetting Board', 'Choose Food for Families (e.g., Lift Up) as the Target budget line and click Advance to vote. Then click Place on next agenda.',
                 'A notice reads "Request #6 is a Proposed Motion for" the soonest Monthly meeting at least 10 days away (November 3, 2026).', who='DGK User'),
        ),
        after=(
            'The council debates and votes on the request at that Monthly meeting. If it passes, the Grand Knight or Financial '
            'Secretary endorses it in the FS/GK Compliance Endorsements folder, and the Treasurer pays it from the Charitable '
            'Contribution Matches folder; neither the Shepherd nor the endorser writes the check.'
        ),
    ),
    Flow(
        key='hours',
        title='Flow 3 - The Flagged Hours Review gate',
        minutes=10,
        context=(
            'Service hours feed the council\'s Supreme reports, so the platform holds an entry that crosses the council\'s '
            'limits (more than 1.0 hour past a scheduled shift, or more than 5.0 hours on one activity in a day) until the '
            'Grand Knight or the Deputy Grand Knight decides it. Member Alpha sees the hold on his own screen; the Deputy '
            'Grand Knight decides Alpha\'s seeded 6.5-hour Saturday entry on his.'
        ),
        steps=(
            Step(HOUR_LEDGER, 'Under Report time on a shift choose the first Lot attendants - Sunday shift (the day after the first Saturday) in Shift I worked. Set Hours to 7 and click Save shift hours.',
                 'A notice says the 7 hours were sent to leadership review before they count toward your totals.', who='Member Alpha'),
            Step(f'{DESKS} > Grand Knight Desk > Flagged Hours Review', 'Open the Flagged Hours Review drawer. Read Member Alpha\'s Saturday entry (6.5 hours against a 4-hour shift) and its reason, then click Reject & Remove.',
                 'The entry leaves the desk; its 6.5 hours never count.', who='DGK User'),
            Step(HOUR_LEDGER, 'Report the Sunday shift again with its 4 scheduled hours and click Save shift hours.', 'A notice reads "Shift hours saved." Hours within the limits count at once.', who='Member Alpha'),
        ),
    ),
)

# Sprint 8S Revision 8: the Live Meeting session, anchored on the 6:15 PM gavel. Five phases, back to back;
# the group flows' minutes add up to GROUP_PHASE_MINUTES.
GAVEL_TIME = '6:15 PM'
INTRO_MINUTES = 5
INDIVIDUAL_PHASE_MINUTES = 20
GROUP_PHASE_MINUTES = 40
EXPLORATION_MINUTES = 20
LISTENING_MINUTES = 20
SESSION_TIMELINE: tuple[tuple[str, int, str], ...] = (
    ('6:15 - 6:20 PM', INTRO_MINUTES, f'Introduction: the gavel strikes at {GAVEL_TIME}. The facilitator welcomes the room, hands out the scripts, and every persona signs in to the web portal on his laptop'),
    ('6:20 - 6:40 PM', INDIVIDUAL_PHASE_MINUTES, 'Individual Desk Coordinate Phase (mobile and web): the officers work their scripts (INDIVIDUAL_PILOT_SCRIPTS.pdf) on the laptops; Member Alpha and Member Beta work theirs on the phone app; no step waits for another persona'),
    ('6:40 - 7:20 PM', GROUP_PHASE_MINUTES, 'Synchronized Group Workflow (web only): the three seated flows of GROUP_CROSS_DESK_SCRIPT.pdf - the expense pipeline, the charity request and the Flagged Hours Review gate - each persona at his own laptop'),
    ('7:20 - 7:40 PM', EXPLORATION_MINUTES, 'Open Exploration: each persona opens the other folders of his own desk and tries the work his office would do next month; the facilitator answers questions'),
    ('7:40 - 8:00 PM', LISTENING_MINUTES, 'Listening Session: each persona fills in the Attendee Feedback Questionnaire, then the facilitator hears every persona in turn and writes down what he says'),
)
SESSION_MINUTES = sum(m for _, m, _ in SESSION_TIMELINE)

# The group phase's timetable: (minutes, part).
GROUP_TIMETABLE: tuple[tuple[int, str], ...] = tuple((f.minutes, f.title) for f in GROUP_FLOWS)

# Done by the facilitator before the attendees arrive; not part of the timed phases.
FACILITATOR_PREP: tuple[str, ...] = (
    'On the hub laptop, start a fresh vault: stop the portal, run npm run hub:archive, then npm run dev:pilot and npm run '
    'dev:mobile:pilot. hub:archive moves the last session\'s vault into packages/backend/data/archive and deletes nothing. '
    'Every laptop opens the portal at the address that dev:pilot prints, and Member Alpha and Member Beta scan the phone '
    'QR code. All devices work on the one hub database, so every device starts from the same seeded records.',
    'To keep adding to the same records from one session to the next, skip npm run hub:archive. The vault keeps every '
    'record, meeting log and check photo, but the seeded records that the scripts use are then already worked.',
    'On the Deputy Grand Knight\'s laptop, signed in as DGK User, open Governance > Recurring Meetings and click Populate '
    'the year for 2026-2027 once. Flow 2 needs a Monthly meeting at least 10 days away to place the request on.',
    f'Hold the session while the {PILOT_EVENT} runs. Its three weeks follow the calendar: on load, the app moves the event by whole weeks so the pilot day is the week after its first weekend, and the members can collect for it on their phones. '
    f'Be seated before {GAVEL_TIME}: the gavel opens the session on time.',
    'Have a small bank statement CSV ready for the Treasurer\'s Bank Statement Match-Window step.',
    'Hand Member Beta the large-print pages of the individual scripts.',
)

FEEDBACK_RATINGS: tuple[str, ...] = (
    'The steps were easy to follow.',
    'The screens used words I understand.',
    'I found every module in a folder on my Active Desk, on the Member Actions Hub or on the phone tabs.',
    'The expected results matched what I saw.',
    'The approval steps match how our council handles money today.',
    'I would use this platform for my office or my volunteering.',
)

FEEDBACK_QUESTIONS: tuple[str, ...] = (
    'Which step was hardest, and why?',
    'What did you expect to see that was missing?',
    'Which words or labels were confusing?',
    'What would stop your council from using the platform next month?',
    'Anything else the team should know?',
)

# ---------------------------------------------------------------- styles ----


# Sprint 8L: the large-print pages (Member Beta) scale every type size and its leading by this much.
LARGE_PRINT_SCALE = 1.45
# Sprint 8M Extension: and space them out further - the line leading and the padding between a step's parts, its Notes
# field and the next step grow by this much on top of the scale.
LARGE_PRINT_SPACING = 1.3


def styles(scale: float = 1.0, spacing: float = 1.0) -> dict[str, ParagraphStyle]:
    """The script styles; `scale` > 1 gives the large-print pages (LARGE_PRINT_SCALE), `spacing` > 1 more room (LARGE_PRINT_SPACING)."""
    z = lambda n: round(n * scale, 1)  # noqa: E731
    base = ParagraphStyle('base', fontName='Helvetica', fontSize=z(10), leading=round(z(13.5) * spacing, 1), textColor=colors.black)
    return {
        'scale': scale,  # type: ignore[dict-item]  (read by step_block for the padding)
        'spacing': spacing,  # type: ignore[dict-item]
        'body': base,
        'small': ParagraphStyle('small', parent=base, fontSize=z(8.5), leading=z(11), textColor=MUTED),
        'title': ParagraphStyle('title', parent=base, fontName='Helvetica-Bold', fontSize=28, leading=34, textColor=NAVY, alignment=TA_CENTER),
        'subtitle': ParagraphStyle('subtitle', parent=base, fontSize=14, leading=18, textColor=MUTED, alignment=TA_CENTER),
        'h1': ParagraphStyle('h1', parent=base, fontName='Helvetica-Bold', fontSize=z(20), leading=z(24), textColor=NAVY, spaceAfter=6),
        'h2': ParagraphStyle('h2', parent=base, fontName='Helvetica-Bold', fontSize=z(13), leading=z(16), textColor=NAVY, spaceBefore=8, spaceAfter=4),
        'panel_head': ParagraphStyle('panel_head', parent=base, fontName='Helvetica-Bold', fontSize=z(11), leading=z(14), textColor=NAVY),
        'step': ParagraphStyle('step', parent=base, fontSize=z(10), leading=round(z(13.5) * spacing, 1)),
        'label': ParagraphStyle('label', parent=base, fontName='Helvetica-Bold', fontSize=z(8), leading=z(10), textColor=MUTED),
    }


# ------------------------------------------------------------ form fields ----


class FormCheckbox(Flowable):
    """An interactive check box (AcroForm), drawn where the flowable lands."""

    def __init__(self, name: str, tooltip: str, size: float = 14):
        super().__init__()
        self.name, self.tooltip, self.size = name, tooltip, size

    def wrap(self, availWidth, availHeight):  # noqa: N803 (ReportLab's signature)
        return self.size, self.size

    def draw(self):
        self.canv.acroForm.checkbox(
            name=self.name, tooltip=self.tooltip, x=0, y=0, size=self.size, buttonStyle='check',
            borderColor=NAVY, fillColor=WHITE, textColor=NAVY, borderWidth=1.2, forceBorder=True, relative=True,
        )


class FormText(Flowable):
    """An interactive text field (AcroForm); multi-line unless `single`."""

    def __init__(self, name: str, tooltip: str, width: float, height: float, single: bool = False):
        super().__init__()
        self.name, self.tooltip, self.width, self.height, self.single = name, tooltip, width, height, single

    def wrap(self, availWidth, availHeight):  # noqa: N803
        return self.width, self.height

    def draw(self):
        self.canv.acroForm.textfield(
            name=self.name, tooltip=self.tooltip, x=0, y=0, width=self.width, height=self.height,
            borderColor=LINE, fillColor=colors.HexColor('#FBFCFE'), textColor=colors.black, borderWidth=1,
            fontName='Helvetica', fontSize=9, fieldFlags='' if self.single else 'multiline', forceBorder=True, relative=True,
        )


class RatingRow(Flowable):
    """Five radio buttons (1-5) sharing one field name."""

    def __init__(self, name: str, tooltip: str, gap: float = 34):
        super().__init__()
        self.name, self.tooltip, self.gap = name, tooltip, gap

    def wrap(self, availWidth, availHeight):  # noqa: N803
        return self.gap * 5, 26

    def draw(self):
        for i in range(5):
            x = i * self.gap
            self.canv.setFont('Helvetica', 7.5)
            self.canv.setFillColor(MUTED)
            self.canv.drawCentredString(x + 7, 18, str(i + 1))
            self.canv.acroForm.radio(
                name=self.name, tooltip=self.tooltip, value=str(i + 1), selected=False, x=x, y=0, size=14,
                buttonStyle='circle', borderColor=NAVY, fillColor=WHITE, textColor=NAVY, forceBorder=True, relative=True,
            )


class LedgerFlowDiagram(Flowable):
    """Sprint 8S Revision 7: the Graphical Ledger Flow Diagram - numbered stage boxes left to right, joined by gold arrows."""

    def __init__(self, stages: tuple[tuple[str, str], ...], width: float, height: float = 130):
        super().__init__()
        self.stages, self.width, self.height = stages, width, height

    def wrap(self, availWidth, availHeight):  # noqa: N803
        return self.width, self.height

    def draw(self):
        c = self.canv
        n = len(self.stages)
        gap = 18
        box_w = (self.width - gap * (n - 1)) / n
        titles = [wrap_lines(title, 'Helvetica-Bold', 9, box_w - 22) for title, _ in self.stages]
        bar = 8 + 11 * max(len(t) for t in titles)
        for i, (title, detail) in enumerate(self.stages):
            x = i * (box_w + gap)
            c.setFillColor(WHITE)
            c.setStrokeColor(NAVY)
            c.setLineWidth(1.2)
            c.rect(x, 0, box_w, self.height, fill=1, stroke=1)
            c.setFillColor(NAVY)
            c.rect(x, self.height - bar, box_w, bar, fill=1, stroke=0)
            c.setFillColor(GOLD)
            c.setFont('Helvetica-Bold', 9)
            c.drawString(x + 6, self.height - 12, str(i + 1))
            c.setFillColor(WHITE)
            y = self.height - 12
            for line in titles[i]:
                c.drawString(x + 16, y, line)
                y -= 11
            c.setFillColor(colors.black)
            c.setFont('Helvetica', 8)
            y = self.height - bar - 12
            for line in wrap_lines(detail, 'Helvetica', 8, box_w - 12):
                c.drawString(x + 6, y, line)
                y -= 10
            if i < n - 1:
                ax = x + box_w + 2
                ay = self.height / 2
                c.setStrokeColor(GOLD)
                c.setFillColor(GOLD)
                c.setLineWidth(2.5)
                c.line(ax, ay, ax + gap - 8, ay)
                path = c.beginPath()
                path.moveTo(ax + gap - 4, ay)
                path.lineTo(ax + gap - 10, ay + 5)
                path.lineTo(ax + gap - 10, ay - 5)
                path.close()
                c.drawPath(path, fill=1, stroke=0)


# ------------------------------------------------------------ the scripts ----

CONTENT_W = LETTER[0] - 1.5 * inch


def notes_panel(notes: tuple[str, ...], st) -> Table:
    """Sprint 8S Revision 7: a chapter's training notes, one paragraph each, on the Day in the Life panel's style."""
    body = [Paragraph('Training notes: the engine keeps the books', st['panel_head']), Spacer(1, 3)]
    for note in notes:
        body += [Paragraph(escape(note), st['body']), Spacer(1, 4)]
    scale = st.get('scale', 1.0)
    t = Table([[body]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PANEL),
        ('LINEBEFORE', (0, 0), (0, -1), 4, GOLD),
        ('BOX', (0, 0), (-1, -1), 0.5, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 12 * scale), ('RIGHTPADDING', (0, 0), (-1, -1), 10 * scale),
        ('TOPPADDING', (0, 0), (-1, -1), 8 * scale), ('BOTTOMPADDING', (0, 0), (-1, -1), 8 * scale),
    ]))
    return t


def day_in_life_panel(text: str, who: str, device: str, st, heading: str | None = None) -> Table:
    body = [
        Paragraph(escape(heading or 'Day in the Life of the ' + who), st['panel_head']),
        Spacer(1, 3),
        Paragraph(escape(text), st['body']),
        Spacer(1, 4),
        Paragraph(f'<b>Device:</b> {escape(device)}', st['small']),
    ]
    scale = st.get('scale', 1.0)
    t = Table([[body]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PANEL),
        ('LINEBEFORE', (0, 0), (0, -1), 4, GOLD),
        ('BOX', (0, 0), (-1, -1), 0.5, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 12 * scale), ('RIGHTPADDING', (0, 0), (-1, -1), 10 * scale),
        ('TOPPADDING', (0, 0), (-1, -1), 8 * scale), ('BOTTOMPADDING', (0, 0), (-1, -1), 8 * scale),
    ]))
    return t


def step_block(prefix: str, n: int, step: Step, st) -> KeepTogether:
    scale = st.get('scale', 1.0) * st.get('spacing', 1.0)
    pad = 2 * scale
    who = f'<b>{escape(step.who)}</b> &middot; ' if step.who else ''
    text = [
        Paragraph(f'<b>Step {n}.</b> {who}<font color="#4A5568">Go to:</font> <b>{escape(step.where)}</b>', st['step']),
        Spacer(1, pad),
        Paragraph(escape(step.action), st['step']),
        Spacer(1, pad),
        Paragraph(f'<font color="#002855"><b>Expected result:</b></font> {escape(step.expected)}', st['step']),
    ]
    box_size = 14 * scale
    box = FormCheckbox(f'{prefix}_step{n}_done', f'Step {n} done', size=box_size)
    gutter = box_size + 10
    row = Table([[box, text]], colWidths=[gutter, CONTENT_W - gutter])
    row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (0, 0), 2)]))
    notes = Table(
        [[Paragraph('NOTES', st['label']), FormText(f'{prefix}_step{n}_notes', f'Notes for step {n}', CONTENT_W - 90, 40 * scale)]],
        colWidths=[84, CONTENT_W - 84],
    )
    notes.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), gutter), ('TOPPADDING', (0, 0), (-1, -1), 4 * scale)]))
    return KeepTogether([row, notes, Spacer(1, 10 * scale)])


def sign_in_card(st) -> Table:
    head = ParagraphStyle('head', parent=st['body'], fontName='Helvetica-Bold', textColor=WHITE)
    rows = [[Paragraph('Persona', head), Paragraph('Login', head), Paragraph('Seat', head)]]
    for p in PERSONAS:
        rows.append([Paragraph(escape(p.title), st['body']), Paragraph(escape(p.email), st['body']), Paragraph(escape(p.seat), st['body'])])
    t = Table(rows, colWidths=[CONTENT_W * 0.25, CONTENT_W * 0.42, CONTENT_W * 0.33], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY), ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PANEL]),
    ]))
    return t


def feedback_appendix(prefix: str, st) -> list:
    out: list = [PageBreak(), Paragraph('Appendix - Attendee Feedback Questionnaire', st['h1']),
                 Paragraph('Fill in this form on screen or on paper and hand it to the facilitator. Rate each statement from 1 (disagree) to 5 (agree).', st['body']),
                 Spacer(1, 10)]
    ident = Table([
        [Paragraph('NAME (OPTIONAL)', st['label']), FormText(f'{prefix}_fb_name', 'Name', 200, 18, single=True),
         Paragraph('PERSONA PLAYED', st['label']), FormText(f'{prefix}_fb_persona', 'Persona played', 150, 18, single=True)],
        [Paragraph('DATE', st['label']), FormText(f'{prefix}_fb_date', 'Date', 200, 18, single=True),
         Paragraph('OFFICE IN YOUR COUNCIL', st['label']), FormText(f'{prefix}_fb_office', 'Office in your council', 150, 18, single=True)],
    ], colWidths=[70, 210, 90, 160])
    ident.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    out += [ident, Spacer(1, 10)]
    rating_rows = [[Paragraph(f'{i + 1}. {escape(q)}', st['body']), RatingRow(f'{prefix}_fb_rating{i + 1}', q)] for i, q in enumerate(FEEDBACK_RATINGS)]
    rt = Table(rating_rows, colWidths=[CONTENT_W - 180, 180])
    rt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LINEBELOW', (0, 0), (-1, -1), 0.5, LINE),
                            ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    out += [rt, Spacer(1, 12)]
    for i, q in enumerate(FEEDBACK_QUESTIONS):
        out.append(KeepTogether([Paragraph(f'<b>{escape(q)}</b>', st['body']), Spacer(1, 3),
                                 FormText(f'{prefix}_fb_q{i + 1}', q, CONTENT_W, 54), Spacer(1, 10)]))
    return out


class ScriptDocument(BaseDocTemplate):
    def __init__(self, path: str, title: str, generated: str):
        super().__init__(path, pagesize=LETTER, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.8 * inch,
                         bottomMargin=0.75 * inch, title=title, author='Fraternal Council Archives™', subject=f'Conference Room Pilot - {COUNCIL}')
        self.label, self.generated = title, generated
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='body')
        self.addPageTemplates([PageTemplate(id='page', frames=[frame], onPage=self.decorate)])

    def decorate(self, canv, doc):
        canv.saveState()
        canv.setFillColor(NAVY)
        canv.rect(0, LETTER[1] - 0.42 * inch, LETTER[0], 0.42 * inch, stroke=0, fill=1)
        canv.setFillColor(WHITE)
        canv.setFont('Helvetica-Bold', 9)
        canv.drawString(0.75 * inch, LETTER[1] - 0.27 * inch, f'{self.label}  |  Conference Room Pilot')
        canv.drawRightString(LETTER[0] - 0.75 * inch, LETTER[1] - 0.27 * inch, COUNCIL)
        canv.setFillColor(MUTED)
        canv.setFont('Helvetica', 8)
        canv.drawString(0.75 * inch, 0.45 * inch, f'Compiled {self.generated} by scripts/pilot_kit_pdf.py  |  pilot data from Seed.sql')
        canv.drawRightString(LETTER[0] - 0.75 * inch, 0.45 * inch, f'Page {doc.page}')
        canv.restoreState()


def cover(title: str, subtitle: str, st, generated: str) -> list:
    return [
        Spacer(1, 1.6 * inch),
        Paragraph(escape(title), st['title']),
        Spacer(1, 10),
        Paragraph(escape(subtitle), st['subtitle']),
        Spacer(1, 6),
        Paragraph(escape(COUNCIL), st['subtitle']),
        Spacer(1, 0.4 * inch),
        Paragraph(
            'How to use this packet: work through each step in order. Tick the box when the step is done and the result '
            'matches. Write anything surprising in the Notes field under the step. The fields can be filled in on screen '
            'in any PDF reader, or on paper.', st['body']),
        Spacer(1, 12),
        Paragraph('Pilot logins (the password is on the facilitator\'s board)', st['h2']),
        sign_in_card(st),
        Spacer(1, 12),
        Paragraph(f'The {SESSION_MINUTES}-minute session: the gavel strikes at {GAVEL_TIME}', st['h2']),
        session_timeline(st),
        Spacer(1, 8),
        Paragraph(f'The pilot data: the {PILOT_EVENT} (three weeks moved to the pilot day, six Lot attendants shifts, $400.00 collected the first weekend), expense reports 14-23 '
                  'waiting on the officers\' desks, charity requests on the vetting board, three prayer intentions and two volunteer '
                  'time entries held for review. The data is on the hub laptop: a fresh vault (npm run hub:archive, then npm run dev:pilot) restores it, '
                  'and reloading a browser or a phone app changes nothing. The individual and group phases '
                  'run on the same vault: the group flows use the seeded records the individual scripts leave untouched.', st['small']),
        Spacer(1, 4),
        Paragraph(f'Compiled {generated}.', st['small']),
        PageBreak(),
    ]


def session_timeline(st) -> Table:
    """The web-only session (Sprint 8S Revision 8): five phases from the 6:15 PM gavel."""
    rows = [[Paragraph('<b>Clock</b>', st['body']), Paragraph('<b>Minutes</b>', st['body']), Paragraph('<b>Phase</b>', st['body'])]]
    rows += [[Paragraph(clock, st['body']), Paragraph(str(m), st['body']), Paragraph(escape(part), st['body'])] for clock, m, part in SESSION_TIMELINE]
    rows.append([Paragraph('', st['body']), Paragraph(f'<b>{sum(m for _, m, _ in SESSION_TIMELINE)}</b>', st['body']), Paragraph('<b>Total</b>', st['body'])])
    t = Table(rows, colWidths=[96, 56, CONTENT_W - 152])
    t.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, 0), 1, NAVY), ('LINEABOVE', (0, -1), (-1, -1), 1, NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [WHITE, PANEL]), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t


def build_individual(output: Path, generated: str) -> None:
    st = styles()
    story = cover('Individual Pilot Scripts', f'The {INDIVIDUAL_PHASE_MINUTES}-minute Individual Desk Coordinate Phase, one script per pilot persona', st, generated)
    for i, p in enumerate(PERSONAS):
        if i:
            story.append(PageBreak())
        ps = styles(LARGE_PRINT_SCALE, LARGE_PRINT_SPACING) if p.large_print else st
        print_note = ' <font size="11" color="#B3261E">&middot; LARGE PRINT</font>' if p.large_print else ''
        story += [Paragraph(f'{escape(p.title)} <font size="11" color="#4A5568">&middot; {escape(p.email)}</font>{print_note}', ps['h1']),
                  day_in_life_panel(p.day_in_life, p.title, p.device, ps), Spacer(1, 12)]
        story += [step_block(p.key, n, s, ps) for n, s in enumerate(p.steps, start=1)]
        if p.chapter_steps:
            story += [Spacer(1, 6), Paragraph(escape(p.chapter_title), ps['h1'])]
            if p.chapter_intro:
                story += [Paragraph(escape(p.chapter_intro), ps['body']), Spacer(1, 10)]
            if p.chapter_diagram:
                story += [KeepTogether([
                    Paragraph('Graphical Ledger Flow Diagram: the Revenue Split lifecycle', ps['h2']),
                    Spacer(1, 6),
                    LedgerFlowDiagram(p.chapter_diagram, CONTENT_W),
                ]), Spacer(1, 10)]
            if p.chapter_notes:
                story += [notes_panel(p.chapter_notes, ps), Spacer(1, 10)]
            story += [step_block(p.key, n, s, ps) for n, s in enumerate(p.chapter_steps, start=len(p.steps) + 1)]
    story += feedback_appendix('individual', st)
    doc = ScriptDocument(str(output), 'Individual Pilot Scripts', generated)
    doc.build(story)
    print(f'wrote {output} ({output.stat().st_size // 1024} KB, {doc.page} pages)')


def timetable(st) -> Table:
    rows = [[Paragraph('<b>Minutes</b>', st['body']), Paragraph('<b>Part</b>', st['body'])]]
    rows += [[Paragraph(str(m), st['body']), Paragraph(escape(part), st['body'])] for m, part in GROUP_TIMETABLE]
    rows.append([Paragraph(f'<b>{sum(m for m, _ in GROUP_TIMETABLE)}</b>', st['body']), Paragraph('<b>Total</b>', st['body'])])
    t = Table(rows, colWidths=[70, CONTENT_W - 70])
    t.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, 0), 1, NAVY), ('LINEABOVE', (0, -1), (-1, -1), 1, NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [WHITE, PANEL]), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t


def build_group(output: Path, generated: str) -> None:
    st = styles()
    story = cover('Group Cross-Desk Script', f'The {GROUP_PHASE_MINUTES}-minute Synchronized Group Workflow: live records passed from desk to desk', st, generated)
    story += [Paragraph('Before you start', st['h1']),
              Paragraph('Seat the seven personas around the table, each signed in to the web portal on his own laptop. Nobody changes seats, '
                        'uses another laptop or signs out during the session. Every laptop works on the one hub database, so a record saved on one '
                        'laptop is on every laptop at once. Every officer works the seeded record waiting at his own gate, and the members file '
                        'their new records on their own laptops. The '
                        "facilitator reads each flow's context aloud; the persona named in bold at each step does it on his own laptop while the "
                        'room follows along. Every web step starts from the Active Desks row; a module is a folder on its desk\'s left '
                        'filing spine that opens on the Desk Blotter.', st['body']),
              Spacer(1, 8),
              Paragraph('Facilitator preparation (before the attendees arrive)', st['h2'])]
    story += [Paragraph(f'{i}. {escape(item)}', st['body']) for i, item in enumerate(FACILITATOR_PREP, start=1)]
    story += [Spacer(1, 8), Paragraph(f'Timetable of the {GROUP_PHASE_MINUTES}-minute group phase', st['h2']), timetable(st)]
    for flow in GROUP_FLOWS:
        story.append(PageBreak())
        story += [Paragraph(f'{escape(flow.title)} <font size="11" color="#4A5568">&middot; {flow.minutes} minutes</font>', st['h1']),
                  day_in_life_panel(flow.context, 'council at the table', "Every persona's own laptop, at his own seat", st), Spacer(1, 12)]
        story += [step_block(f'group_{flow.key}', n, s, st) for n, s in enumerate(flow.steps, start=1)]
        if flow.after:
            story.append(day_in_life_panel(flow.after, '', 'Not played in this session', st, heading='After the session'))
    story += feedback_appendix('group', st)
    doc = ScriptDocument(str(output), 'Group Cross-Desk Script', generated)
    doc.build(story)
    print(f'wrote {output} ({output.stat().st_size // 1024} KB, {doc.page} pages)')


# ---------------------------------------------------------------- posters ----

PW, PH = TABLOID  # 792 x 1224 points, 11 x 17 inches portrait
PM = 0.6 * inch


def wrap_lines(text: str, font: str, size: float, width: float) -> list[str]:
    from reportlab.pdfbase.pdfmetrics import stringWidth
    words, lines, line = text.split(), [], ''
    for w in words:
        trial = f'{line} {w}'.strip()
        if stringWidth(trial, font, size) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def draw_text(c, text: str, x: float, y: float, width: float, font='Helvetica', size=14, color=colors.black, leading=None) -> float:
    """Draws wrapped text from the top line at y; answers the y below the last line."""
    leading = leading or size * 1.25
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap_lines(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


# Sprint 9 Revision 4.0: the footer line of every poster.
HUB_POSTER_LINE = 'Pilot hub: every laptop and phone works on one database on the hub laptop. Records are kept from session to session.'


def poster_frame(c, title: str, subtitle: str, generated: str) -> None:
    c.setFillColor(NAVY)
    c.rect(0, PH - 2.1 * inch, PW, 2.1 * inch, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.rect(0, PH - 2.1 * inch - 10, PW, 10, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 46)
    c.drawString(PM, PH - 1.05 * inch, title)
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 19)
    c.drawString(PM, PH - 1.6 * inch, subtitle)
    c.setFillColor(NAVY)
    c.rect(0, 0, PW, 0.7 * inch, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont('Helvetica', 11)
    # Sprint 9 Revision 4.0: where the room's data lives.
    c.drawString(PM, 0.5 * inch, HUB_POSTER_LINE)
    c.drawString(PM, 0.28 * inch, f'Fraternal Council Archives™  |  Conference Room Pilot  |  {COUNCIL}')
    c.drawRightString(PW - PM, 0.28 * inch, f'Compiled {generated}  |  11 x 17 in')


def stage_box(c, x: float, y_top: float, w: float, h: float, n: str, title: str, who: str, screen: str, detail: str, accent=NAVY) -> None:
    c.setFillColor(WHITE)
    c.setStrokeColor(accent)
    c.setLineWidth(3)
    c.roundRect(x, y_top - h, w, h, 14, stroke=1, fill=1)
    c.setFillColor(accent)
    c.circle(x + 38, y_top - 38, 24, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 22)
    c.drawCentredString(x + 38, y_top - 46, n)
    tx, tw = x + 76, w - 92
    y = draw_text(c, title, tx, y_top - 34, tw, 'Helvetica-Bold', 20, NAVY)
    y = draw_text(c, who, tx, y - 2, tw, 'Helvetica-Bold', 13, accent)
    y = draw_text(c, screen, tx, y - 2, tw, 'Helvetica-Oblique', 12, MUTED)
    draw_text(c, detail, tx, y - 4, tw, 'Helvetica', 12, colors.black, 15)


def arrow_down(c, x: float, y_top: float, length: float, color=GOLD) -> None:
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(6)
    c.line(x, y_top, x, y_top - length + 14)
    p = c.beginPath()
    p.moveTo(x - 14, y_top - length + 16)
    p.lineTo(x + 14, y_top - length + 16)
    p.lineTo(x, y_top - length)
    p.close()
    c.drawPath(p, stroke=0, fill=1)


NOTE_SIZE, NOTE_LEADING = 13, 16


def note_panel_height(w: float, heading: str, lines: list[str]) -> float:
    rows = sum(len(wrap_lines('- ' + line, 'Helvetica', NOTE_SIZE, w - 32)) for line in lines)
    return 28 + len(wrap_lines(heading, 'Helvetica-Bold', 16, w - 32)) * 20 + rows * NOTE_LEADING + len(lines) * 4 + 14


def note_panel(c, x: float, y_top: float, w: float, h: float | None, heading: str, lines: list[str], accent=RED) -> float:
    """Draws the panel (`h` None: as tall as its text); answers its height."""
    h = h or note_panel_height(w, heading, lines)
    c.setFillColor(PANEL)
    c.setStrokeColor(accent)
    c.setLineWidth(2)
    c.roundRect(x, y_top - h, w, h, 10, stroke=1, fill=1)
    y = draw_text(c, heading, x + 16, y_top - 28, w - 32, 'Helvetica-Bold', 16, accent)
    for line in lines:
        y = draw_text(c, '- ' + line, x + 16, y - 4, w - 32, 'Helvetica', NOTE_SIZE, colors.black, NOTE_LEADING)
    return h


def poster_financial(output: Path, generated: str) -> None:
    c = pdfcanvas.Canvas(str(output), pagesize=TABLOID)
    c.setTitle('Financial Workflow Poster')
    c.setAuthor('Fraternal Council Archives™')
    poster_frame(c, 'Financial Workflow', 'Three signatures before any check  |  every gift on the record', generated)
    col_w = PW * 0.58
    x = PM
    y = PH - 2.6 * inch
    h, gap = 148, 40
    stages = [
        ('1', 'File the expense report', 'Any member', 'Active Desks > Member Desk > Open my expenses  |  phone Expenses',
         'New expense report: link the event or meeting, add each receipt line, submit. Status: Submitted.'),
        ('2', 'Payment request', 'Financial Secretary', 'Active Desks > Financial Secretary Desk',
         'Check the receipts and click Verify & Sign Expense. The first signature.'),
        ('3', 'Ledger coding', 'Treasurer', 'Active Desks > Treasurer Desk',
         'Assign the general ledger account (it decides the budget line), then Categorize & Lock Expense.'),
        ('4', 'Final release', 'Grand Knight', 'Active Desks > Grand Knight Desk',
         'Final Release for Payment. The report is Approved and released to the Treasurer.'),
        ('5', 'Pay by check', 'Financial Secretary or Treasurer', 'Active Desks > Treasurer Desk > Expense Report (ER) Settlement',
         'Type the check number and Record Payment Made by Check. Status: Reimbursed.'),
    ]
    for i, (n, title, who, screen, detail) in enumerate(stages):
        stage_box(c, x, y, col_w, h, n, title, who, screen, detail, GOLD if n == '5' else NAVY)
        if i < len(stages) - 1:
            arrow_down(c, x + col_w / 2, y - h, gap)
        y -= h + gap
    side_x, side_w = x + col_w + 24, PW - 2 * PM - col_w - 24
    side_y = PH - 2.6 * inch
    side_y -= 16 + note_panel(c, side_x, side_y, side_w, None, 'Guards', [
        'Nobody signs, codes or releases his own report.',
        'Collusion Guard: the Treasurer cannot code a report he ordered; the Grand Knight cannot release one he signed as FS or Treasurer.',
        'Council Admins may open the three desks but do not sign.',
    ])
    side_y -= 16 + note_panel(c, side_x, side_y, side_w, None, 'Sent back?', [
        'Leadership Auditing Queue (Financial Secretary Desk): Return to member with a reason (required).',
        'The report goes back to Draft and its signatures are cleared; the member fixes it and submits again.',
    ], NAVY)
    side_y -= 16 + note_panel(c, side_x, side_y, side_w, None, 'Money coming in', [
        'Phone Collect tab: Start collecting for event, then Record donation (cash, card, or check with its check number).',
        'Officers see every gift in Finances > Donations History.',
        'FS and Treasurer post deposits and transfers in the General Ledger.',
        "Revenue splits: coded once; the chart-of-accounts split shares the parish part.",
    ], GOLD)
    note_panel(c, side_x, side_y, side_w, None, 'Charity grants going out', [
        'After the council votes a grant, the FS or GK endorses it in the FS/GK Compliance Endorsements folder.',
        'Treasurer (or FS, if he did not endorse it): Pay approved request, one check for the approved amount.',
        "The grant's budget line is charged; the Shepherd cannot pay it.",
    ], NAVY)
    c.showPage()
    c.save()
    print(f'wrote {output}')


def poster_charity(output: Path, generated: str) -> None:
    c = pdfcanvas.Canvas(str(output), pagesize=TABLOID)
    c.setTitle('Charity Lifecycle Poster')
    c.setAuthor('Fraternal Council Archives™')
    poster_frame(c, 'Charity Grant Lifecycle', 'Vetting  >  Presentation  >  Payment Made', generated)
    w = PW - 2 * PM
    x, y = PM, PH - 2.55 * inch
    h, gap = 112, 22
    stages = [
        ('1', 'Propose', 'Any member (the Knight Shepherd)', 'Active Desks > Member Desk > Propose or follow a charity grant',
         'Bring the organization, the amount and the reason. The Shepherd follows the request on his 3-step tracking notice.'),
        ('2', 'Claim and vet', 'An officer or Trustee - never the Shepherd', 'Active Desks > Grand Knight Desk > Charitable Grant Requests Vetting Board',
         'Claim the request and check it. Request More Info opens a private thread with the Shepherd; Request Officer Input asks the officers.'),
        ('3', 'Advance or decline', 'The vetting officer', 'Active Desks > Grand Knight Desk > Charitable Grant Requests Vetting Board',
         'Advance it to the council vote, or decline it with a reason. A declined request stops here.'),
        ('4', 'On the agenda', 'The vetting officer - the 10-day rule', 'Active Desks > Grand Knight Desk > Charitable Grant Requests Vetting Board',
         'Place on next agenda puts it on the soonest Monthly meeting at least 10 days away, as a proposed motion.'),
        ('5', 'Council vote', 'The members at the meeting', 'Governance > Live Meeting Console',
         'The Recorder\'s hand tally on the console. Decided Passed, Failed or Tabled.'),
        ('6', 'Endorse and pay', 'FS or GK endorses; another finance officer pays - never the Shepherd', 'Active Desks > FS/GK Compliance Endorsements, then Treasurer Desk > Charitable Contribution Matches',
         'FS/GK Compliance Endorsement, then Pay approved request: one check for the approved amount, charged to the budget line.'),
        ('7', 'Follow up', 'The Trustees', 'Six months after filing',
         'The Trustees are prompted for a status report on what the grant did.'),
    ]
    for i, (n, title, who, screen, detail) in enumerate(stages):
        accent = RED if n == '3' else GOLD if n in ('6', '7') else NAVY
        stage_box(c, x, y, w, h, n, title, who, screen, detail, accent)
        if i < len(stages) - 1:
            arrow_down(c, PW / 2, y - h, gap)
        y -= h + gap
    c.showPage()
    c.save()
    print(f'wrote {output}')


# Columns of the permissions poster, and each row: (capability, marks per column). Y allowed, V view only, - no.
MATRIX_COLUMNS = ('Member', 'Historian', 'FS', 'Treasurer', 'DGK', 'GK', 'Council Admin')
MATRIX_ROWS: tuple[tuple[str, str], ...] = (
    ('File own expense reports', 'YYYYYYY'),
    ('Issue the payment request (FS Expense Audit)', '--Y---V'),
    ('Code to budget line and ledger (Treasurer desk)', '---Y--V'),
    ('Final release for payment (GK Expense Authorize)', '----YYV'),
    ('Pay expense checks', '--YY---'),
    ('Pay approved charity grants', '--YY---'),
    ('Code a gift with an event split (parish share)', '---Y--V'),
    ('Post to the general ledger', '--YY---'),
    ('Read the general ledger and dashboards', '--YYYYY'),
    ('Review held volunteer time', '----YYY'),
    ('Log own volunteer hours', 'YYYYYYY'),
    ('Record a donation at the gate (phone)', 'YYYYYYY'),
    ('Propose a charity grant', 'YYYYYYY'),
    ('Vet charity requests', '--YYYYY'),
    ('Run the Live Meeting Console', '--YYYYY'),
    ('Keep the council annals', '-YYYYYY'),
    ('Diary entry and oral history', 'YYYYYYY'),
    ('Change Council Wide Settings', '--YYYYY'),
)


def poster_permissions(output: Path, generated: str) -> None:
    c = pdfcanvas.Canvas(str(output), pagesize=TABLOID)
    c.setTitle('Permissions Matrix Poster')
    c.setAuthor('Fraternal Council Archives™')
    poster_frame(c, 'Who Can Do What', 'The pilot personas and their seats', generated)
    left = PM
    label_w = 300
    col_w = (PW - 2 * PM - label_w) / len(MATRIX_COLUMNS)
    top = PH - 2.6 * inch
    head_h, row_h = 74, 36  # Sprint 8M Extension: 36 (was 40) so the rows fit above the notes
    c.setFillColor(NAVY)
    c.rect(left, top - head_h, PW - 2 * PM, head_h, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 15)
    c.drawString(left + 12, top - 44, 'Capability')
    for i, name in enumerate(MATRIX_COLUMNS):
        cx = left + label_w + col_w * (i + 0.5)
        lines = wrap_lines(name, 'Helvetica-Bold', 13, col_w - 6)
        yy = top - 42 + (len(lines) - 1) * 8
        c.setFont('Helvetica-Bold', 13)
        for line in lines:
            c.drawCentredString(cx, yy, line)
            yy -= 15
    y = top - head_h
    for r, (capability, marks) in enumerate(MATRIX_ROWS):
        c.setFillColor(PANEL if r % 2 else WHITE)
        c.rect(left, y - row_h, PW - 2 * PM, row_h, stroke=0, fill=1)
        cap_lines = wrap_lines(capability, 'Helvetica-Bold', 12.5, label_w - 20)
        draw_text(c, capability, left + 12, y - row_h / 2 + 4 + (len(cap_lines) - 1) * 7, label_w - 20, 'Helvetica-Bold', 12.5, NAVY, 14)
        for i, mark in enumerate(marks):
            cx, cy = left + label_w + col_w * (i + 0.5), y - row_h / 2
            if mark == 'Y':
                c.setFillColor(NAVY)
                c.circle(cx, cy, 11, stroke=0, fill=1)
            elif mark == 'V':
                c.setStrokeColor(NAVY)
                c.setLineWidth(3)
                c.circle(cx, cy, 10, stroke=1, fill=0)
            else:
                c.setStrokeColor(LINE)
                c.setLineWidth(3)
                c.line(cx - 9, cy, cx + 9, cy)
        y -= row_h
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.rect(left, y, PW - 2 * PM, top - y, stroke=1, fill=0)
    # legend and notes
    y -= 40
    c.setFillColor(NAVY)
    c.circle(left + 14, y + 5, 10, stroke=0, fill=1)
    c.setFont('Helvetica', 13)
    c.setFillColor(colors.black)
    c.drawString(left + 32, y, 'Allowed')
    c.setStrokeColor(NAVY)
    c.setLineWidth(3)
    c.circle(left + 154, y + 5, 9, stroke=1, fill=0)
    c.drawString(left + 172, y, 'Opens the desk, does not sign')
    c.setStrokeColor(LINE)
    c.line(left + 400, y + 5, left + 418, y + 5)
    c.drawString(left + 430, y, 'Not allowed')
    note_panel(c, left, y - 26, PW - 2 * PM, None, 'Read this with the matrix', [
        'Access follows the seat: a member gains a desk the moment he is seated, and loses it when he leaves the seat.',
        'Nobody signs, codes, releases or pays his own expense report; the Collusion Guard keeps the three signatures with three different officers.',
        'The Shepherd of a charity request never vets it. Super Admins can do everything for every council.',
    ], NAVY)
    c.showPage()
    c.save()
    print(f'wrote {output}')


# ------------------------------------------------------------------- main ----

OUTPUTS = {
    'INDIVIDUAL_PILOT_SCRIPTS.pdf': build_individual,
    'GROUP_CROSS_DESK_SCRIPT.pdf': build_group,
    'POSTER_FINANCIAL_WORKFLOW.pdf': poster_financial,
    'POSTER_CHARITY_LIFECYCLE.pdf': poster_charity,
    'POSTER_PERMISSIONS_MATRIX.pdf': poster_permissions,
}


def compile_pilot_kit(out_dir: Path = DOCS) -> None:
    """Writes the five pilot kit PDFs into `out_dir`."""
    generated = dt.date.today().isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, build in OUTPUTS.items():
        build(out_dir / name, generated)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--out-dir', type=Path, default=DOCS, help='where to write the PDFs (default: docs/)')
    args = parser.parse_args(argv)
    compile_pilot_kit(args.out_dir)


if __name__ == '__main__':
    main()
