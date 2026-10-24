#!/usr/bin/env python3
"""Draws the Member Guide's meeting check-in illustration (Sprint 9 Revision 5.1).

    py scripts/pin_pad_placeholder.py   ->  generated/mobile_app_catalog/meeting_check_in_pin_pad.png

GPS check-in is hidden on the phone (GPS_UI_SUPPRESSED), so section 5.5 shows the PIN-only check-in box: the MEETING PIN
field, the Check in with PIN button and the phone's number pad. The picture is a labelled placeholder in the style of
the other phone captions in mobile_app_catalog (390 x 844, navy header, gold rule, five-tab bar). It is drawn at three
times the size and scaled down, so its lines and text stay sharp in print. The guide builder embeds raster images only.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'generated' / 'mobile_app_catalog' / 'meeting_check_in_pin_pad.png'

WIDTH, HEIGHT = 390, 844
SCALE = 3
NAVY = (0, 40, 85)
GOLD = (214, 164, 32)
WHITE = (255, 255, 255)
LINE = (225, 230, 238)
MUTED = (96, 108, 124)
TAB = (203, 210, 220)
KEYPAD = (236, 239, 244)

FONT_DIR = Path('C:/Windows/Fonts')


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Segoe UI, as in the other captions; DejaVu Sans where Segoe UI is not installed."""
    names = ['segoeuib.ttf', 'DejaVuSans-Bold.ttf'] if bold else ['segoeui.ttf', 'DejaVuSans.ttf']
    for name in names:
        for candidate in (FONT_DIR / name, Path(name)):
            try:
                return ImageFont.truetype(str(candidate), size * SCALE)
            except OSError:
                continue
    return ImageFont.load_default()


def s(*values: float) -> list[int]:
    return [round(v * SCALE) for v in values]


def text(d: ImageDraw.ImageDraw, xy: tuple[float, float], value: str, size: int, fill, bold: bool = False, anchor: str = 'la') -> None:
    d.text(tuple(s(*xy)), value, font=font(size, bold), fill=fill, anchor=anchor)


def backspace(d: ImageDraw.ImageDraw, cx: float, cy: float) -> None:
    """The delete key's arrow-tag outline with an x inside (drawn: the fonts carry no backspace glyph)."""
    outline = [(cx - 18, cy), (cx - 8, cy - 11), (cx + 16, cy - 11), (cx + 16, cy + 11), (cx - 8, cy + 11)]
    d.polygon([tuple(s(x, y)) for x, y in outline], outline=NAVY, width=2 * SCALE)
    for (x1, y1, x2, y2) in ((cx - 2, cy - 5, cx + 8, cy + 5), (cx - 2, cy + 5, cx + 8, cy - 5)):
        d.line(s(x1, y1, x2, y2), fill=NAVY, width=2 * SCALE)


def draw() -> Image.Image:
    img = Image.new('RGB', (WIDTH * SCALE, HEIGHT * SCALE), WHITE)
    d = ImageDraw.Draw(img)

    # Header and gold rule.
    d.rectangle(s(0, 0, WIDTH, 122), fill=NAVY)
    text(d, (20, 62), 'Meeting Console', 20, WHITE, bold=True, anchor='ls')
    text(d, (20, 92), 'Check in with the meeting PIN', 13, GOLD, anchor='ls')
    d.rectangle(s(0, 122, WIDTH, 128), fill=GOLD)

    # The CHECK IN box: the PIN field, the button and the hint.
    d.rounded_rectangle(s(16, 150, 374, 392), radius=10 * SCALE, outline=GOLD, width=3 * SCALE, fill=WHITE)
    text(d, (32, 182), 'CHECK IN', 12, NAVY, bold=True, anchor='ls')
    text(d, (32, 216), 'MEETING PIN', 12, NAVY, bold=True, anchor='ls')
    d.rounded_rectangle(s(32, 228, 358, 274), radius=8 * SCALE, outline=NAVY, width=2 * SCALE, fill=WHITE)
    for i in range(4):
        cx, cy = 52 + i * 18, 251
        d.ellipse(s(cx - 3, cy - 3, cx + 3, cy + 3), fill=NAVY)
    d.rounded_rectangle(s(32, 290, 358, 342), radius=8 * SCALE, fill=NAVY)
    text(d, (195, 316), 'Check in with PIN', 16, WHITE, bold=True, anchor='mm')
    text(d, (32, 372), 'Ask the Grand Knight for the PIN.', 12, MUTED, anchor='ls')

    # The phone's number pad.
    d.rectangle(s(0, 418, WIDTH, 742), fill=KEYPAD)
    keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
    key_w, key_h, gap, left, top = 114, 66, 10, 16, 432
    for i, label in enumerate(keys):
        col, row = i % 3, i // 3
        x0 = left + col * (key_w + gap)
        y0 = top + row * (key_h + gap)
        if label == '':
            continue
        d.rounded_rectangle(s(x0, y0, x0 + key_w, y0 + key_h), radius=8 * SCALE, fill=WHITE, outline=LINE, width=SCALE)
        if label == '⌫':
            backspace(d, x0 + key_w / 2, y0 + key_h / 2)
        else:
            text(d, (x0 + key_w / 2, y0 + key_h / 2), label, 24, NAVY, bold=True, anchor='mm')

    # Caption and the five-tab bar, Mtgs chosen.
    text(d, (195, 768), 'PLACEHOLDER · meeting_check_in_pin_pad.png', 11, MUTED, anchor='mm')
    d.line(s(0, 781, WIDTH, 781), fill=LINE, width=SCALE)
    for i in range(5):
        x0 = 25 + i * 78
        d.rounded_rectangle(s(x0, 800, x0 + 26, 826), radius=4 * SCALE, fill=NAVY if i == 1 else TAB)

    return img.resize((WIDTH, HEIGHT), Image.LANCZOS)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    draw().save(OUTPUT, optimize=True)
    print(f'wrote {OUTPUT}')


if __name__ == '__main__':
    main()
