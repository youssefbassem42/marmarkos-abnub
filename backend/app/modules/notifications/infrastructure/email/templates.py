"""Branded HTML email template for Marmarkos Abnub.

One standard layout that renders any transactional case (verification,
password reset, notifications...) by composing ``BrandEmailContent``.
Visual rules follow docs/Design-Guide.md strictly:

* Navy (#253D63) dominates; white body; mint (#53CB9E) only as the CTA;
  blue (#2672B0) for links; no gradients, no glassmorphism, no noise.
* Typography stacks mirror the brand fonts (Amiri for scripture,
  El Messiri for modern Arabic headings, Markazi Text for Arabic body,
  Poppins for Latin). Web fonts rarely load in email clients, so every
  stack degrades to a clean system font.
* Table-based, inline-styled markup: the only layout that renders
  consistently across Gmail / Outlook / mobile clients.
* Full RTL support for Arabic sections via ``dir="rtl"``.
"""

import html
from dataclasses import dataclass, field

NAVY = "#253D63"
BLUE = "#2672B0"
MINT = "#53CB9E"
WHITE = "#FFFFFF"
PAGE_BG = "#F3F6FA"
TEXT_MUTED = "#5A6B85"

FONT_EN = "'Poppins', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
_FONT_AR_STACK = "'El Messiri', 'Markazi Text', 'Amiri', 'Segoe UI', Tahoma, Arial, sans-serif"
FONT_VERSE = "'Amiri', 'Traditional Arabic', Georgia, serif"


@dataclass(frozen=True)
class EmailSection:
    """A headed block of paragraphs; ``rtl=True`` renders it right-to-left."""

    heading: str | None = None
    paragraphs: tuple[str, ...] = ()
    rtl: bool = False


@dataclass(frozen=True)
class BrandEmailContent:
    """Everything one branded email needs; cases differ only in this data."""

    subject: str
    preheader: str = ""
    sections: tuple[EmailSection, ...] = ()
    cta_label: str | None = None
    cta_url: str | None = None
    note: str | None = None
    extra_fields: dict[str, str] = field(default_factory=dict)


def _esc(value: str) -> str:
    return html.escape(value, quote=False)


def _paragraph(text: str, rtl: bool, size: int = 16) -> str:
    direction = "rtl" if rtl else "ltr"
    return (
        f'<p style="margin:0 0 14px;font-family:{_FONT_AR_STACK if rtl else FONT_EN};'
        f"font-size:{size}px;line-height:{1.9 if rtl else 1.65};color:{NAVY};"
        f'text-align:{("right" if rtl else "left")};direction:{direction};">{text}</p>'
    )


def _section_html(section: EmailSection) -> str:
    parts: list[str] = ['<tr><td style="padding:0 40px 8px;">']
    if section.heading:
        heading_font = _FONT_AR_STACK if section.rtl else FONT_EN
        heading_align = "right" if section.rtl else "left"
        heading_dir = "rtl" if section.rtl else "ltr"
        parts.append(
            f'<h3 style="margin:18px 0 10px;font-family:{heading_font};'
            f"font-size:20px;font-weight:700;color:{NAVY};"
            f"text-align:{heading_align};"
            f'direction:{heading_dir};">{_esc(section.heading)}</h3>'
        )
    for paragraph in section.paragraphs:
        parts.append(_paragraph(paragraph, section.rtl))
    parts.append("</td></tr>")
    return "".join(parts)


def _cta_html(label: str, url: str) -> str:
    safe_url = html.escape(url, quote=True)
    safe_label = _esc(label)
    return (
        '<tr><td style="padding:22px 40px 6px;" align="center">'
        f'<a href="{safe_url}" style="display:inline-block;background:{MINT};color:{WHITE};'
        f"font-family:{FONT_EN};font-size:15px;font-weight:700;letter-spacing:0.5px;"
        f"text-decoration:none;padding:14px 34px;border-radius:12px;"
        f'">{safe_label}</a></td></tr>'
        '<tr><td style="padding:14px 40px 0;" align="center">'
        f'<p style="margin:0;font-family:{FONT_EN};font-size:12px;line-height:1.6;'
        f'color:{TEXT_MUTED};word-break:break-all;">{safe_url}</p></td></tr>'
    )


def _verse_html() -> str:
    verse = "«لاَ يَهْتِنَ أَحَدٌ فِي شَبَّابِكَ، بَلْ كُنْ مِثَالًا لِلْمُؤْمِنِينَ فِي الْكَلِمِ وَالسُّلُوكِ وَالْمَحَبَّةِ وَالإِيمَانِ وَالنَّقَاءِ»"
    return (
        '<tr><td style="padding:26px 48px;" align="center">'
        f'<p dir="rtl" lang="ar" style="margin:0 0 8px;font-family:{FONT_VERSE};'
        f"font-size:17px;line-height:1.9;color:{BLUE};"
        f'text-align:center;">{verse}</p>'
        f'<p style="margin:0;font-family:{FONT_EN};font-size:11px;font-weight:700;'
        f'letter-spacing:1.5px;color:{MINT};text-align:center;">1 TIMOTHY 4:12</p></td></tr>'
    )


def render_brand_email(
    content: BrandEmailContent,
    *,
    brand_name_ar: str = "إجتماع الشباب بأبنوب",
    brand_name_en: str = "Marmarkos Abnub",
    logo_url: str | None = None,
    contact_line: str | None = None,
) -> str:
    """Render the single branded layout for any case."""
    preheader = (
        f'<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">'
        f"{_esc(content.preheader)}</span>"
        if content.preheader
        else ""
    )

    if logo_url:
        brand_cell = (
            f'<img src="{html.escape(logo_url, quote=True)}" width="90" height="60" '
            f'alt="{_esc(brand_name_en)}" style="display:block;width:90px;height:60px;'
            f'object-fit:contain;margin:0 auto 6px;border:0;" />'
            f'<div style="font-family:{_FONT_AR_STACK};font-size:15px;color:{WHITE};">'
            f"{brand_name_ar}</div>"
        )
    else:
        brand_cell = (
            f'<div style="font-family:{_FONT_AR_STACK};font-size:20px;font-weight:700;'
            f'color:{WHITE};">{brand_name_ar}</div>'
            f'<div style="font-family:{FONT_EN};font-size:11px;font-weight:600;'
            f'letter-spacing:2.5px;color:{MINT};margin-top:4px;">{_esc(brand_name_en.upper())}</div>'
        )

    body_rows: list[str] = []
    for index, section in enumerate(content.sections):
        padding = "26px 40px 0" if index == 0 else "0 40px"
        row = _section_html(section).replace("padding:0 40px 8px;", f"padding:{padding};", 1)
        body_rows.append(row)

    if content.cta_label and content.cta_url:
        body_rows.append(_cta_html(content.cta_label, content.cta_url))

    if content.note:
        body_rows.append(
            '<tr><td style="padding:20px 40px 0;">'
            f'<p style="margin:0;font-family:{FONT_EN};font-size:13px;line-height:1.7;'
            f'color:{TEXT_MUTED};">{_esc(content.note)}</p></td></tr>'
        )

    contact_row = ""
    if contact_line:
        contact_row = (
            f'<p style="margin:14px 0 0;font-family:{FONT_EN};font-size:12px;color:#B9C6DA;">'
            f"{_esc(contact_line)}</p>"
        )

    page_table = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="background:{PAGE_BG};padding:32px 12px;">'
    )
    card_table = (
        '<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" '
        f'style="width:100%;max-width:640px;background:{WHITE};'
        'border-radius:16px;overflow:hidden;">'
    )
    brand_en_cell = (
        f'<div style="font-family:{FONT_EN};font-size:11px;font-weight:600;'
        f'letter-spacing:2px;color:{MINT};margin-top:3px;">{_esc(brand_name_en.upper())}</div>'
    )
    copyright_cell = (
        f'<p style="margin:12px 0 0;font-family:{FONT_EN};font-size:11px;color:#8DA0BE;">'
        f"&copy; {brand_name_en} &mdash; FAITH. FRIENDS. PURPOSE.</p>"
    )

    return f"""<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{_esc(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:{PAGE_BG};">
{preheader}
{page_table}
<tr><td align="center">
{card_table}
  <tr><td style="background:{NAVY};padding:28px 40px;text-align:center;">{brand_cell}</td></tr>
  {"".join(body_rows)}
  {_verse_html()}
  <tr><td style="height:1px;background:#E4EAF3;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="background:{NAVY};padding:24px 40px;text-align:center;">
    <div style="font-family:{_FONT_AR_STACK};font-size:14px;color:{WHITE};">{brand_name_ar}</div>
    {brand_en_cell}
    {contact_row}
    {copyright_cell}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


__all__ = [
    "BrandEmailContent",
    "EmailSection",
    "render_brand_email",
]
