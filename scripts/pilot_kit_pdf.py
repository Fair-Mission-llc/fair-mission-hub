#!/usr/bin/env python3
"""Compiles the Conference Room Pilot kit (Phase 7I): two fillable scripts and three 11x17 wall posters.

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
expense reports 14-19 and the two held time entries). Screen and button names are the portal's and the phone's own.
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
    who: str = ''  # group flows only: the persona at the keyboard


@dataclass(frozen=True)
class Persona:
    key: str
    title: str
    email: str
    seat: str
    device: str
    day_in_life: str
    steps: tuple[Step, ...]


@dataclass(frozen=True)
class Flow:
    key: str
    title: str
    context: str
    steps: tuple[Step, ...]


SIGN_IN_WEB = 'Web portal sign-in page'
SIGN_IN_PHONE = 'Phone app sign-in screen'

PERSONAS: tuple[Persona, ...] = (
    Persona(
        key='gk',
        title='Grand Knight',
        email='gk_user@stmarys.org',
        seat='Grand Knight (GK User)',
        device='Laptop (web portal)',
        day_in_life=(
            'It is the week after the first weekend of the Parish Parking Event. The Grand Knight presides at the '
            'October business meeting, gives the final release on expense reports before the council pays them, and '
            'keeps an eye on the fundraiser he owns. The Financial Secretary and the Treasurer have already signed and '
            'coded the Historian\'s report for the Past Grand Knights frames, so it waits for him alone.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as gk_user@stmarys.org with the pilot password on the facilitator\'s board.',
                 'The sidebar opens with the seven pillars: Governance, Faith In Action, Finances, Performance, Resources, Answers and System Settings.'),
            Step('Finances > GK Expense Authorize', 'Read the waiting report from Historian User: Aaron Brothers, $89.99, frames for the Past Grand Knights wall.',
                 'Report 19 shows the Financial Secretary\'s written order and the Treasurer\'s coding (Miscellaneous Others, Council Operational Costs).'),
            Step('Finances > GK Expense Authorize', 'Click Final Release for Payment on report 19.',
                 'The row reads "Released to the Treasurer". The report is Approved and now waits in Bulk Check Disbursements.'),
            Step('Governance > Live Meeting Console', 'Choose the October Business Meeting in the Meeting list.',
                 'The navy top bar welcomes the council\'s elected chairs by name, starting with "Worthy Grand Knight GK User", then the council, St. Mary\'s Cathedral Council 15295.'),
            Step('Faith In Action > Event Planner', f'Open the {PILOT_EVENT}.',
                 'Six Lot attendants shifts from October 10 to October 25; each shift has its 2 volunteers signed up (Member Alpha and Member Beta).'),
            Step('Performance > Executive Dashboard', 'Scroll to the Volunteer Time Quarantine Desk. Do not decide the entries; the Deputy Grand Knight does that in his script.',
                 'Two held entries: Member Alpha, 6.5 hours on a 4-hour parking shift, and Member Beta, 6 hours of Ushering.'),
        ),
    ),
    Persona(
        key='fs',
        title='Financial Secretary',
        email='fs_user@stmarys.org',
        seat='Financial Secretary (FS User)',
        device='Laptop (web portal)',
        day_in_life=(
            'Monday evening after the parking weekend. Three new expense reports came in: cones and vests for the lot '
            'attendants, a cash box and receipt books, and archival sleeves for the council history. The Financial '
            'Secretary checks each receipt against the event and issues the written order, the first of the three '
            'signatures. A report without what the council needs goes back to the member with a reason.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as fs_user@stmarys.org with the pilot password.', 'The Finances pillar lists FS Expense Audit.'),
            Step('Finances > FS Expense Audit', 'Read the queue on the Financial Secretary Audit Desk.',
                 'Reports 14 (Member Alpha, Home Depot, $84.97), 15 (Member Beta, Office Depot, $32.48) and 16 (Historian User, Michaels, $46.20) wait for the written order.'),
            Step('Finances > FS Expense Audit', 'Click Verify & Sign Expense on report 14.',
                 'The row reads "Written order issued". Report 14 moves to the Treasurer Ledger Audit Desk.'),
            Step('Finances > FS Expense Audit', 'Click Verify & Sign Expense on report 16.', 'Report 16 moves to the Treasurer Ledger Audit Desk.'),
            Step('Finances > Leadership Auditing Queue', 'Find report 15. Type "Please add the receipt photo" in Reason for returning (required), then click Return to member.',
                 'Report 15 goes back to Member Beta as a Draft with your reason. Its signatures are cleared.'),
            Step('Finances > Donations History', f'Filter or scroll to the {PILOT_EVENT}.', 'The check donations the member personas take at the gate appear here with their check numbers.'),
        ),
    ),
    Persona(
        key='treasurer',
        title='Treasurer',
        email='treasurer_user@stmarys.org',
        seat='Treasurer (Treasurer User)',
        device='Laptop (web portal)',
        day_in_life=(
            'The Treasurer keeps the council\'s books honest. Every report that carries the written order comes to him '
            'to be charged to a line of the approved 2026-2027 budget and to a general ledger account. After the Grand '
            'Knight\'s final release, he writes the check. The Collusion Guard stops him from coding a report he ordered '
            'himself.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as treasurer_user@stmarys.org with the pilot password.', 'The Finances pillar lists Treasurer Ledger Audit Desk.'),
            Step('Finances > Treasurer Ledger Audit Desk', 'Read the queue.',
                 'Reports 17 (Member Alpha, FedEx Office yard signs, $118.50) and 18 (Member Beta, Safeway, $54.75) carry FS User\'s written order and wait for coding.'),
            Step('Finances > Treasurer Ledger Audit Desk', 'On report 17 choose Miscellaneous Others in Assign Ledger Budget Line Item and Event Operational Costs in Assign General Ledger Account, then click Categorize & Lock Expense.',
                 'The row reads "Coded to the ledger". Report 17 moves to GK Expense Authorize.'),
            Step('Finances > Treasurer Ledger Audit Desk', 'On report 18 choose Monthly Council Meetings and Council Operational Costs, then click Categorize & Lock Expense.',
                 'Report 18 moves to GK Expense Authorize.'),
            Step('Finances > Bulk Check Disbursements', 'After the Grand Knight releases report 19, select it, type check number 1201 and click Issue Disbursement Check.',
                 'Report 19 is Reimbursed and the check appears in the disbursement history.'),
            Step('Finances > General Ledger Spreadsheet', 'Read the Council Operational Costs and Event Operational Costs accounts.', 'The accounts list their postings; the chart of accounts matches the seeded 14 accounts plus Opening Balance Equity.'),
        ),
    ),
    Persona(
        key='dgk',
        title='Deputy Grand Knight',
        email='dgk_user@stmarys.org',
        seat='Deputy Grand Knight (DGK User)',
        device='Laptop (web portal)',
        day_in_life=(
            'The Deputy Grand Knight looks after the council\'s service-hour record. Two entries were held for '
            'leadership review because they crossed the council\'s limits: a parking shift reported 2.5 hours over its '
            'scheduled length, and a long Sunday of ushering. He talks with each brother before he decides, because a '
            'cleared entry counts toward every total and a rejected one never does.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as dgk_user@stmarys.org with the pilot password.', 'The Performance pillar lists Executive Dashboard.'),
            Step('Performance > Executive Dashboard', 'Scroll to the Volunteer Time Quarantine Desk and read both entries.',
                 'Member Alpha: 6.5 hours on Parish Parking Event - Lot attendants - Saturday, note "Stayed to restripe the overflow lot". Member Beta: 6 hours of Ushering, note "Ushered all three Sunday Masses".'),
            Step('Performance > Executive Dashboard', 'On Member Beta\'s entry click Approve & Add to Time Log.',
                 'The entry leaves the desk. Beta\'s 6 hours now count in the Member Center and on the dashboard.'),
            Step('Performance > Executive Dashboard', 'On Member Alpha\'s entry click Reject & Remove. Tell Alpha to report the 4 scheduled hours again.',
                 'The entry leaves the desk and its hours never count. Alpha can log the Saturday shift again from the phone Report tab.'),
            Step('Governance > Live Meeting Console', 'Choose the October Business Meeting.', 'The welcome line names "Worthy Deputy Grand Knight DGK User" after the Grand Knight.'),
            Step('Finances > Charity Vetting Queue', 'Read the pooled requests. Do not claim one in this script.', 'The Deputy Grand Knight may claim requests and override another officer\'s claim.'),
        ),
    ),
    Persona(
        key='historian',
        title='Council Historian',
        email='historian_user@stmarys.org',
        seat='Council Historian (Historian User)',
        device='Laptop (web portal)',
        day_in_life=(
            'The Council Historian is appointed by the Grand Knight to keep the council\'s annals. He records what the '
            'council did this fraternal year, writes the day\'s diary entry about the parking fundraiser, and files his '
            'own expense reports for history supplies like any other brother.'
        ),
        steps=(
            Step(SIGN_IN_WEB, 'Sign in as historian_user@stmarys.org with the pilot password.', 'The Performance pillar lists Council History.'),
            Step('Performance > Council History', 'Open Spiritual diary and oral history. Write two sentences about the first parking weekend, then click Save written entry.',
                 'The entry is saved under today\'s date. The portal allows one written entry per member per day.'),
            Step('Performance > Council History', 'Open the 2026-2027 year, edit Collective accomplishments to mention the Parish Parking Event, and click Save 2026-2027.',
                 'The year\'s annals show the new accomplishment.'),
            Step('Finances > My Expense Reports', 'Read the status of reports 16 and 19.',
                 'Report 16 shows its next signature; report 19 shows the Grand Knight\'s release, and Reimbursed once the Treasurer pays it.'),
            Step('Performance > Council History', 'Try the oral history recorder for 10 seconds and stop it.', 'The recording is listed for download. The recorder stops on its own at the platform limit.'),
        ),
    ),
    Persona(
        key='alpha',
        title='Member Alpha',
        email='member_alpha@stmarys.org',
        seat='Member (Member Alpha)',
        device='Phone app, then laptop',
        day_in_life=(
            'Member Alpha volunteers as a lot attendant on the parking weekends. Between cars he takes parking donations, '
            'often by check, and records each one on his phone. After his shifts he reports his time, and he files the '
            'receipt for the cones and vests he bought for the crew.'
        ),
        steps=(
            Step(SIGN_IN_PHONE, 'Sign in as member_alpha@stmarys.org with the pilot password.', 'The tab bar shows Home, Mtgs, Signup, Report and Donate.'),
            Step('Phone > Signup tab', f'Find the {PILOT_EVENT}.', 'You are signed up for all six Lot attendants shifts.'),
            Step('Phone > Report tab', 'Under Which shift? choose Lot attendants - Sunday (October 11). Under How long? enter 4 hours. Tap Save time.',
                 'A message confirms the hours were saved to Lot attendants - Sunday.'),
            Step('Phone > Donate tab', f'Tap Start accepting for an event, choose the {PILOT_EVENT} in EVENT, and tap Start. Under How is the donor giving? choose Check, type 1045 in CHECK NUMBER (REQUIRED), enter $20.00 and tap Record donation.',
                 'The $20.00 check appears under Recorded for this event. The event is offered only while it is at the gate (October 10-31, 2026).'),
            Step('Web > Finances > My Expense Reports', 'Sign in on the laptop and read reports 14 and 17.', 'Each report shows the signatures it has and the one it waits for.'),
            Step('Web > Finances > My Expense Reports', f'Click New expense report, link it to the {PILOT_EVENT}, add a line (Dollar Tree, $12.00, chalk for lot lane markings) and submit it.',
                 'The new report is Submitted and appears on the Financial Secretary Audit Desk.'),
        ),
    ),
    Persona(
        key='beta',
        title='Member Beta',
        email='member_beta@stmarys.org',
        seat='Member (Member Beta)',
        device='Phone app, then laptop',
        day_in_life=(
            'Member Beta works the same parking shifts and ushers at Mass. This week the Financial Secretary returned his '
            'cash-box report because the receipt photo was missing, so he fixes it and sends it back. He also takes '
            'check donations at the gate and reports his Saturday shift.'
        ),
        steps=(
            Step(SIGN_IN_PHONE, 'Sign in as member_beta@stmarys.org with the pilot password.', 'The tab bar shows Home, Mtgs, Signup, Report and Donate.'),
            Step('Phone > Report tab', 'Under Which shift? choose Lot attendants - Saturday (October 10). Under How long? enter 4 hours. Tap Save time.',
                 'A message confirms the hours were saved.'),
            Step('Phone > Donate tab', f'Start accepting for the {PILOT_EVENT}. Record a Check donation: CHECK NUMBER 2210, $25.00, donor name "Parishioner". Tap Record donation.',
                 'The $25.00 check appears under Recorded for this event.'),
            Step('Phone > Donate tab', 'Try to record a Check donation without a check number.', 'The phone refuses it: a check donation needs its check number.'),
            Step('Web > Finances > My Expense Reports', 'After the Financial Secretary returns report 15, open it and read the reason.',
                 'Report 15 is a Draft with "Please add the receipt photo" from leadership.'),
            Step('Web > Finances > My Expense Reports', 'Attach a receipt photo to report 15 and submit it again.', 'Report 15 is Submitted again and returns to the Financial Secretary Audit Desk.'),
        ),
    ),
)

GROUP_FLOWS: tuple[Flow, ...] = (
    Flow(
        key='expense',
        title='Flow 1 - An expense report from receipt to check',
        context=(
            'Member Alpha bought cones and vests for the lot attendants (report 14). The council pays nothing until three '
            'different officers have signed: the Financial Secretary\'s written order, the Treasurer\'s ledger coding and '
            'the Grand Knight\'s final release. Then the Treasurer writes the check. Everyone watches the report move.'
        ),
        steps=(
            Step('Finances > My Expense Reports', 'Show report 14 and its status line.', 'Report 14 is Submitted and waits for the written order.', who='Member Alpha'),
            Step('Finances > FS Expense Audit', 'Click Verify & Sign Expense on report 14.', 'Report 14 leaves the FS desk.', who='FS User'),
            Step('Finances > Treasurer Ledger Audit Desk', 'Choose Miscellaneous Others and Event Operational Costs on report 14, then Categorize & Lock Expense.', 'Report 14 leaves the Treasurer desk.', who='Treasurer User'),
            Step('Finances > GK Expense Authorize', 'Click Final Release for Payment on report 14.', 'Report 14 is Approved and released to the Treasurer.', who='GK User'),
            Step('Finances > Bulk Check Disbursements', 'Pay report 14 with check number 1202 (Issue Disbursement Check).', 'Report 14 is Reimbursed.', who='Treasurer User'),
            Step('Finances > My Expense Reports', 'Refresh report 14.', 'Report 14 shows Reimbursed with check 1202.', who='Member Alpha'),
        ),
    ),
    Flow(
        key='guards',
        title='Flow 2 - The approval guards',
        context=(
            'The platform enforces the council\'s accounting controls. Nobody signs his own report, and the Grand Knight '
            'cannot give the final release on a report he already signed as Financial Secretary or Treasurer (the '
            'Collusion Guard). The group tries each shortcut and sees it refused.'
        ),
        steps=(
            Step('Finances > My Expense Reports', 'File a small report of your own (any vendor, $5.00) and submit it.', 'The report waits on the Financial Secretary Audit Desk.', who='FS User'),
            Step('Finances > FS Expense Audit', 'Find your own report.', 'The row reads "Your own report"; Verify & Sign Expense is not offered. Another officer must sign it.', who='FS User'),
            Step('Finances > Leadership Auditing Queue', 'Return the report with the reason "Pilot test".', 'The report goes back to Draft.', who='FS User'),
            Step('Finances > Treasurer Ledger Audit Desk', 'Read report 16 (Historian User).', 'It waits for coding; the Treasurer may code it because he did not issue its written order.', who='Treasurer User'),
        ),
    ),
    Flow(
        key='hours',
        title='Flow 3 - Volunteer time held for review',
        context=(
            'Service hours feed the council\'s Supreme reports, so the platform holds an entry that crosses the council\'s '
            'limits (more than 5.0 hours on one activity in a day, or more than 1.0 hour past a scheduled shift) until '
            'the Grand Knight, the Deputy Grand Knight or an Admin decides it.'
        ),
        steps=(
            Step('Performance > Executive Dashboard', 'Open the Volunteer Time Quarantine Desk.', 'Member Alpha (6.5 hours, parking shift) and Member Beta (6 hours, Ushering) wait.', who='DGK User'),
            Step('Performance > Executive Dashboard', 'Approve & Add to Time Log on Member Beta\'s entry.', 'Beta\'s hours count from now on.', who='DGK User'),
            Step('Performance > Executive Dashboard', 'Reject & Remove on Member Alpha\'s entry.', 'Alpha\'s 6.5 hours never count.', who='DGK User'),
            Step('Phone > Report tab', 'Report the Saturday shift again with 4 hours and tap Save time.', 'The hours save directly; 4 hours is inside the shift and its 1.0-hour allowance.', who='Member Alpha'),
            Step('Phone > Report tab', 'Report 9 hours on the Sunday shift (October 11) and tap Save time.', 'The phone says the hours were sent to leadership review, and the entry appears on the desk.', who='Member Beta'),
        ),
    ),
    Flow(
        key='gate',
        title='Flow 4 - Check donations at the parking gate',
        context=(
            f'The {PILOT_EVENT} raises money at the cathedral lot during the weekend Masses. Both members take checks at the '
            'gate on their phones; the officers see each one at once in Donations History.'
        ),
        steps=(
            Step('Phone > Donate tab', f'Start accepting for the {PILOT_EVENT} and record a $20.00 check, number 1045.', 'The check appears under Recorded for this event.', who='Member Alpha'),
            Step('Phone > Donate tab', 'Record a $25.00 check, number 2210, on the same event.', 'Both phones show both checks under Recorded for this event.', who='Member Beta'),
            Step('Finances > Donations History', f'Read the {PILOT_EVENT} donations.', 'Both checks are listed with their check numbers and the member who recorded each.', who='FS User'),
            Step('Phone > Donate tab', 'Tap Stop accepting - the event is over.', 'The phone leaves the intake session.', who='Member Alpha'),
        ),
    ),
    Flow(
        key='meeting',
        title='Flow 5 - The October business meeting',
        context=(
            'The officers meet at the cathedral. The Grand Knight runs the Live Meeting Console from the laptop on the '
            'projector; members check in from their phones and follow the agenda.'
        ),
        steps=(
            Step('Governance > Live Meeting Console', 'Choose the October Business Meeting.', 'The welcome line names the elected chairs from their seats: Worthy Grand Knight GK User, Worthy Deputy Grand Knight DGK User and the other elected officers.', who='GK User'),
            Step('Governance > Live Meeting Console', 'Push the first agenda line to the floor.', 'The top bar shows the item and its countdown; every phone following the meeting shows the same clock.', who='GK User'),
            Step('Phone > Mtgs tab', 'Open the meeting and check in (GPS, or the meeting PIN the Grand Knight reads out).', 'The roster on the console shows you checked in.', who='Member Alpha'),
            Step('Performance > Council History', 'Write the day\'s diary entry about the meeting and click Save written entry.', 'The entry is saved for today.', who='Historian User'),
        ),
    ),
)

FEEDBACK_RATINGS: tuple[str, ...] = (
    'The steps were easy to follow.',
    'The screens used words I understand.',
    'I could find each page from the sidebar or the phone tabs.',
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


def styles() -> dict[str, ParagraphStyle]:
    base = ParagraphStyle('base', fontName='Helvetica', fontSize=10, leading=13.5, textColor=colors.black)
    return {
        'body': base,
        'small': ParagraphStyle('small', parent=base, fontSize=8.5, leading=11, textColor=MUTED),
        'title': ParagraphStyle('title', parent=base, fontName='Helvetica-Bold', fontSize=28, leading=34, textColor=NAVY, alignment=TA_CENTER),
        'subtitle': ParagraphStyle('subtitle', parent=base, fontSize=14, leading=18, textColor=MUTED, alignment=TA_CENTER),
        'h1': ParagraphStyle('h1', parent=base, fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=NAVY, spaceAfter=6),
        'h2': ParagraphStyle('h2', parent=base, fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=NAVY, spaceBefore=8, spaceAfter=4),
        'panel_head': ParagraphStyle('panel_head', parent=base, fontName='Helvetica-Bold', fontSize=11, textColor=NAVY),
        'step': ParagraphStyle('step', parent=base, fontSize=10, leading=13.5),
        'label': ParagraphStyle('label', parent=base, fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=MUTED),
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


# ------------------------------------------------------------ the scripts ----

CONTENT_W = LETTER[0] - 1.5 * inch


def day_in_life_panel(text: str, who: str, device: str, st) -> Table:
    body = [
        Paragraph('Day in the Life of the ' + escape(who), st['panel_head']),
        Spacer(1, 3),
        Paragraph(escape(text), st['body']),
        Spacer(1, 4),
        Paragraph(f'<b>Device:</b> {escape(device)}', st['small']),
    ]
    t = Table([[body]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PANEL),
        ('LINEBEFORE', (0, 0), (0, -1), 4, GOLD),
        ('BOX', (0, 0), (-1, -1), 0.5, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return t


def step_block(prefix: str, n: int, step: Step, st) -> KeepTogether:
    who = f'<b>{escape(step.who)}</b> &middot; ' if step.who else ''
    text = [
        Paragraph(f'<b>Step {n}.</b> {who}<font color="#4A5568">Go to:</font> <b>{escape(step.where)}</b>', st['step']),
        Spacer(1, 2),
        Paragraph(escape(step.action), st['step']),
        Spacer(1, 2),
        Paragraph(f'<font color="#002855"><b>Expected result:</b></font> {escape(step.expected)}', st['step']),
    ]
    box = FormCheckbox(f'{prefix}_step{n}_done', f'Step {n} done')
    row = Table([[box, text]], colWidths=[24, CONTENT_W - 24])
    row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (0, 0), 2)]))
    notes = Table(
        [[Paragraph('NOTES', st['label']), FormText(f'{prefix}_step{n}_notes', f'Notes for step {n}', CONTENT_W - 90, 40)]],
        colWidths=[84, CONTENT_W - 84],
    )
    notes.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 24), ('TOPPADDING', (0, 0), (-1, -1), 4)]))
    return KeepTogether([row, notes, Spacer(1, 10)])


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
                         bottomMargin=0.75 * inch, title=title, author='Knights of Columbus Tracking Platform', subject=f'Conference Room Pilot - {COUNCIL}')
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
        Paragraph(f'The pilot data: the {PILOT_EVENT} (October 10-31, 2026, six Lot attendants shifts), expense reports 14-19 '
                  'waiting on the officers\' desks, and two volunteer time entries held for review. Reloading the web portal '
                  'restores it in the browser; on a phone, clear the app\'s data or reinstall it. Run the individual scripts '
                  'and the group script on separate loads: both use the same reports.', st['small']),
        Spacer(1, 4),
        Paragraph(f'Compiled {generated}.', st['small']),
        PageBreak(),
    ]


def build_individual(output: Path, generated: str) -> None:
    st = styles()
    story = cover('Individual Pilot Scripts', 'One script per desk, for the seven pilot personas', st, generated)
    for i, p in enumerate(PERSONAS):
        if i:
            story.append(PageBreak())
        story += [Paragraph(f'{escape(p.title)} <font size="11" color="#4A5568">&middot; {escape(p.email)}</font>', st['h1']),
                  day_in_life_panel(p.day_in_life, p.title, p.device, st), Spacer(1, 12)]
        story += [step_block(p.key, n, s, st) for n, s in enumerate(p.steps, start=1)]
    story += feedback_appendix('individual', st)
    doc = ScriptDocument(str(output), 'Individual Pilot Scripts', generated)
    doc.build(story)
    print(f'wrote {output} ({output.stat().st_size // 1024} KB, {doc.page} pages)')


def build_group(output: Path, generated: str) -> None:
    st = styles()
    story = cover('Group Cross-Desk Script', 'The flows that pass work from desk to desk, played together', st, generated)
    story += [Paragraph('Before you start', st['h1']),
              Paragraph('Seat the seven personas around the table, each signed in on his own device. The facilitator reads each '
                        'flow\'s context aloud; the persona named in bold at each step takes the keyboard while the room watches '
                        'the projector. Play the flows in order: Flow 1 pays report 14, which Flow 2 and the individual scripts do '
                        'not touch.', st['body']),
              Spacer(1, 10)]
    for i, flow in enumerate(GROUP_FLOWS):
        if i:
            story.append(PageBreak())
        story += [Paragraph(escape(flow.title), st['h1']), day_in_life_panel(flow.context, 'council at the table', 'Every persona\'s own device, the GK laptop on the projector', st), Spacer(1, 12)]
        story += [step_block(f'group_{flow.key}', n, s, st) for n, s in enumerate(flow.steps, start=1)]
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
    c.drawString(PM, 0.28 * inch, f'Knights of Columbus Tracking Platform  |  Conference Room Pilot  |  {COUNCIL}')
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
    c.setAuthor('Knights of Columbus Tracking Platform')
    poster_frame(c, 'Financial Workflow', 'Three signatures before any check  |  every gift on the record', generated)
    col_w = PW * 0.58
    x = PM
    y = PH - 2.6 * inch
    h, gap = 148, 40
    stages = [
        ('1', 'File the expense report', 'Any member', 'Finances > My Expense Reports  |  phone Expenses',
         'New expense report: link the event or meeting, add each receipt line, submit. Status: Submitted.'),
        ('2', 'Written order', 'Financial Secretary', 'Finances > FS Expense Audit',
         'Check the receipts and click Verify & Sign Expense. The first signature.'),
        ('3', 'Ledger coding', 'Treasurer', 'Finances > Treasurer Ledger Audit Desk',
         'Assign the budget line and the general ledger account, then Categorize & Lock Expense.'),
        ('4', 'Final release', 'Grand Knight', 'Finances > GK Expense Authorize',
         'Final Release for Payment. The report is Approved and released to the Treasurer.'),
        ('5', 'Pay by check', 'Financial Secretary or Treasurer', 'Finances > Bulk Check Disbursements',
         'Type the check number and Issue Disbursement Check. Status: Reimbursed.'),
    ]
    for i, (n, title, who, screen, detail) in enumerate(stages):
        stage_box(c, x, y, col_w, h, n, title, who, screen, detail, GOLD if n == '5' else NAVY)
        if i < len(stages) - 1:
            arrow_down(c, x + col_w / 2, y - h, gap)
        y -= h + gap
    side_x, side_w = x + col_w + 24, PW - 2 * PM - col_w - 24
    side_y = PH - 2.6 * inch
    side_y -= 24 + note_panel(c, side_x, side_y, side_w, None, 'Guards', [
        'Nobody signs, codes or releases his own report.',
        'Collusion Guard: the Treasurer cannot code a report he ordered; the Grand Knight cannot release one he signed as FS or Treasurer.',
        'Council Admins may open the three desks but do not sign.',
    ])
    side_y -= 24 + note_panel(c, side_x, side_y, side_w, None, 'Sent back?', [
        'Leadership Auditing Queue: Return to member with a reason (required).',
        'The report goes back to Draft and its signatures are cleared; the member fixes it and submits again.',
    ], NAVY)
    note_panel(c, side_x, side_y, side_w, None, 'Money coming in', [
        'Phone Donate tab: Start accepting for an event, then Record donation (cash, card or check).',
        'A check needs its CHECK NUMBER.',
        'Officers see every gift in Finances > Donations History.',
        'FS and Treasurer post deposits and transfers in the General Ledger.',
    ], GOLD)
    c.showPage()
    c.save()
    print(f'wrote {output}')


def poster_charity(output: Path, generated: str) -> None:
    c = pdfcanvas.Canvas(str(output), pagesize=TABLOID)
    c.setTitle('Charity Lifecycle Poster')
    c.setAuthor('Knights of Columbus Tracking Platform')
    poster_frame(c, 'Charity Grant Lifecycle', 'Vetting  >  Presentation  >  Disbursement', generated)
    w = PW - 2 * PM
    x, y = PM, PH - 2.55 * inch
    h, gap = 112, 22
    stages = [
        ('1', 'Propose', 'Any member (the Knight Shepherd)', 'Finances > Propose Charity Grant',
         'Bring the organization, the amount and the reason. The Shepherd follows the request on his 3-step tracking notice.'),
        ('2', 'Claim and vet', 'An officer or Trustee - never the Shepherd', 'Finances > Charity Vetting Queue',
         'Claim the request and check it. Request More Info opens a private thread with the Shepherd; Request Officer Input asks the officers.'),
        ('3', 'Advance or decline', 'The vetting officer', 'Finances > Charity Vetting Queue',
         'Advance it to the council vote, or decline it with a reason. A declined request stops here.'),
        ('4', 'On the agenda', 'Automatic: the 10-day rule', 'Governance > Meeting Center',
         'An advanced request goes to the soonest Monthly meeting at least 10 days away, as a proposed motion.'),
        ('5', 'Council vote', 'The members at the meeting', 'Governance > Live Meeting Console',
         'Secret smartphone ballot, or the Recorder\'s hand tally. Decided Passed, Failed or Tabled.'),
        ('6', 'Pay the grant', 'Financial Secretary or Treasurer', 'Finances > Charitable Disbursements Ledger',
         'An approved grant is paid by check and recorded against the charity.'),
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
    ('Issue the written order (FS Expense Audit)', '--Y---V'),
    ('Code to budget line and ledger (Treasurer desk)', '---Y--V'),
    ('Final release for payment (GK Expense Authorize)', '-----YV'),
    ('Pay expense and charity checks', '--YY---'),
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
    c.setAuthor('Knights of Columbus Tracking Platform')
    poster_frame(c, 'Who Can Do What', 'The pilot personas and their seats', generated)
    left = PM
    label_w = 300
    col_w = (PW - 2 * PM - label_w) / len(MATRIX_COLUMNS)
    top = PH - 2.6 * inch
    head_h, row_h = 74, 40
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
